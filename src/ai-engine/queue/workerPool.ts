/**
 * APEX — Asynchronous AI Worker Fleet & Execution Pipeline
 * Pulls jobs from Priority Queue, executes multi-stage identification, handles backpressure,
 * retries with jitter, and updates job state.
 */

import type { IdentificationResult, ScanJob, ScanJobStatus, ScanQualityMetrics } from '../types';
import { jobQueue } from './jobQueue';
import { deadLetterQueue } from './deadLetterQueue';
import { qualityGate } from '../quality/qualityGate';
import { visualReferenceStore } from '../canonical/visualReferenceStore';
import { hardNegativesEngine } from '../canonical/hardNegativesRegistry';
import { aiProviderRouter } from '../providers/providerRouter';
import { deterministicValidator } from '../validation/deterministicValidator';
import { confidenceEngine } from '../validation/confidenceEngine';
import { identificationCache } from '../caching/identificationCache';
import { tracer } from '../observability/tracer';

export class WorkerPool {
  private isRunning: boolean = false;
  private concurrency: number = 8;
  private activeWorkers: number = 0;
  private intervalId: any = null;

  constructor(concurrency: number = 8) {
    this.concurrency = concurrency;
  }

  public start(concurrency: number = 8) {
    if (this.isRunning) return;
    this.concurrency = concurrency;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.tick();
    }, 50);
    (this.intervalId as any)?.unref?.();
  }

  public setConcurrency(concurrency: number) {
    this.concurrency = concurrency;
  }

  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getActiveWorkerCount(): number {
    return this.activeWorkers;
  }

  private async tick() {
    if (!this.isRunning) return;

    // Dynamically scale workers with queue depth bounded by max concurrency
    const queueDepth = jobQueue.size();
    const targetConcurrency = Math.min(this.concurrency, Math.max(4, Math.ceil(queueDepth / 10)));

    while (this.activeWorkers < targetConcurrency && jobQueue.size() > 0) {
      const job = jobQueue.dequeue();
      if (!job) break;

      this.activeWorkers += 1;
      this.processJob(job)
        .catch((_err) => {
          // Rejection is already handled and recorded on jobQueue
        })
        .finally(() => {
          this.activeWorkers = Math.max(0, this.activeWorkers - 1);
        });
    }
  }

  /**
   * Complete multi-stage vehicle identification pipeline execution
   */
  public async processJob(job: ScanJob): Promise<IdentificationResult> {
    const startTime = Date.now();
    job.attempts += 1;
    let quality: ScanQualityMetrics | null = null;

    try {
      // ─── STAGE 1: CACHE LOOKUP ───
      const cachedResult = identificationCache.getResult(job.imageHash);
      if (cachedResult) {
        jobQueue.completeJob(job.id, 'completed');
        job.result = cachedResult;
        tracer.recordScanTrace({
          scan_id: job.id,
          request_id: job.traceId,
          timestamp: new Date().toISOString(),
          image_hash: job.imageHash,
          image_size_bytes: job.imageDataUrl.length,
          provider_model: 'identification-cache',
          provider: 'cache',
          model: 'sha256-perceptual-cache',
          latency_ms: Date.now() - startTime,
          latency: Date.now() - startTime,
          status: 'completed',
          cache_hit: true,
          cache_key: job.imageHash,
          retry_count: Math.max(0, job.attempts - 1),
          error_code: null,
          fallback_used: false,
          abstention_reason: null,
          candidate_set: [],
          retrieved_references: [],
          prompt_summary: 'Cache Hit - bypass model inference',
          raw_model_response: null,
          classifier_output: null,
          final_result: cachedResult
        });
        return cachedResult;
      }

      // ─── STAGE 2: PRE-AI QUALITY GATING ───
      quality = await qualityGate.evaluateImageQuality(job.imageDataUrl, job.fileName);
      if (!quality.isUsable) {
        const abstainedResult: IdentificationResult = {
          scanId: job.id,
          idempotencyKey: job.idempotencyKey,
          userId: job.userId,
          status: 'abstained',
          make: 'Unknown Make',
          model: 'Unknown Model',
          generation: 'Unknown',
          yearEstimate: '2023',
          color: 'Unknown',
          rarity: 'common',
          engine: 'Standard Engine',
          horsepower: 0,
          torqueNm: 0,
          topSpeedKmH: 0,
          zeroToHundredSec: 0,
          kerbWeightKg: 0,
          productionYears: 'Unknown',
          originCountry: 'Global',
          bodyStyle: 'Coupe',
          historicalInformation: '',
          interestingFacts: '',
          aftermarketPartsDetected: [],
          confidence: {
            totalScore: 0.1,
            isConfident: false,
            shouldAbstain: true,
            abstentionReason: quality.rejectionReason || 'Visual quality insufficient to identify vehicle.',
            breakdown: {
              visualSimilarityWeight: 0,
              modelAgreementWeight: 0,
              candidateMarginWeight: 0,
              frameAgreementWeight: 0,
              databaseConsistencyWeight: 0,
              qualityPenalty: 0.9
            }
          },
          quality,
          topCandidates: [],
          processedAt: new Date().toISOString(),
          processingDurationMs: Date.now() - startTime,
          modelVersion: 'quality-gate-v2',
          promptVersion: 'apex-prompt-v2',
          pipelineVersion: job.pipelineVersion,
          cached: false,
          traceId: job.traceId
        };

        jobQueue.completeJob(job.id, 'abstained');
        job.result = abstainedResult;
        return abstainedResult;
      }

      // ─── STAGE 3: CANONICAL CANDIDATE RETRIEVAL ───
      const candidates = visualReferenceStore.retrieveTopKCandidates(
        {
          fileName: job.fileName,
          rawKeywords: [job.fileName || '']
        },
        15
      );

      // Distinguishing instructions for hard negatives
      const candidateIds = candidates.map((c) => c.vehicleId);
      const distinguishingNotes = hardNegativesEngine.getDistinguishingPromptInstructions(candidateIds);

      // ─── STAGE 4: AI ROUTER & CIRCUIT BREAKER ───
      const aiResponse = await aiProviderRouter.routeIdentification({
        scanId: job.id,
        traceId: job.traceId,
        imageDataUrl: job.imageDataUrl,
        multiFrames: job.multiFrames,
        candidates,
        distinguishingInstructions: distinguishingNotes,
        options: {
          disableFallback: job.disableFallback
        }
      });

      if (!aiResponse.success || !aiResponse.output) {
        // Provider failure is terminal at the worker layer: CloudflareVisionProvider owns retry authority.
        // workerPool MUST NOT re-enqueue, retry, or multiply inference requests.
        const errorType = aiResponse.errorType || 'PROVIDER_FAILURE';
        const abstentionReason = errorType === 'VISION_QUOTA_EXHAUSTED'
          ? 'VISION_QUOTA_EXHAUSTED'
          : errorType;

        const truthfulReason = errorType === 'VISION_QUOTA_EXHAUSTED'
          ? `[${aiResponse.providerName || 'CloudflareVisionProvider'}] VISION_QUOTA_EXHAUSTED: ${aiResponse.error || 'Cloudflare daily free allocation of 10,000 neurons exhausted.'}`
          : (aiResponse.error || `[${aiResponse.providerName || 'CloudflareVisionProvider'}] AI inference failed.`);

        const finalStatus: ScanJobStatus = 'uncertain';
        const finalResult: IdentificationResult = {
          scanId: job.id,
          idempotencyKey: job.idempotencyKey,
          userId: job.userId,
          status: finalStatus,
          canonicalVehicleId: undefined,
          make: null,
          model: null,
          generation: null,
          trim: null,
          yearEstimate: 'Unknown',
          color: 'Unknown',
          rarity: 'common',
          engine: 'Unknown',
          horsepower: 0,
          torqueNm: 0,
          topSpeedKmH: 0,
          zeroToHundredSec: 0,
          kerbWeightKg: 0,
          productionYears: 'Unknown',
          originCountry: 'Global',
          bodyStyle: 'Sedan',
          historicalInformation: '',
          interestingFacts: '',
          aftermarketPartsDetected: [],
          confidence: {
            totalScore: 0.0,
            isConfident: false,
            shouldAbstain: true,
            abstentionReason,
            breakdown: {
              visualSimilarityWeight: 0,
              modelAgreementWeight: 0,
              candidateMarginWeight: 0,
              frameAgreementWeight: 0,
              databaseConsistencyWeight: 0,
              qualityPenalty: 1.0
            }
          },
          quality: quality || { isUsable: false, blurScore: 0, luminanceScore: 0, contrastScore: 0, aspectRatio: 1, vehicleBoundingEstimated: false },
          topCandidates: [],
          processedAt: new Date().toISOString(),
          processingDurationMs: Date.now() - startTime,
          modelVersion: aiResponse.modelUsed || 'none',
          promptVersion: 'apex-master-v2.5',
          pipelineVersion: job.pipelineVersion,
          cached: false,
          traceId: job.traceId,
          canonicalResult: {
            status: 'uncertain',
            vehicle_present: true,
            image_quality: { usable: false, score: 0, issues: [truthfulReason] },
            viewpoint: 'unknown',
            visual_evidence: {
              body_style: null, grille: null, headlights: null, taillights: null, hood: null,
              roofline: null, windows: null, wheels: null, exhaust: null, aero: null, badges: null,
              text: null, body_proportions: null, distinctive_details: null
            },
            identification: { make: null, model_family: null, generation: null, variant: null },
            confidence: { make_score: 0, model_score: 0, generation_score: 0, variant_score: 0, overall_score: 0 },
            candidates: [],
            contradictions: [truthfulReason],
            specificity_level: 'make',
            reason: truthfulReason,
            needs_retake: true,
            needs_review: true
          }
        };

        tracer.recordScanTrace({
          scan_id: job.id,
          request_id: job.traceId,
          timestamp: new Date().toISOString(),
          image_hash: job.imageHash,
          image_size_bytes: job.imageDataUrl.length,
          provider_model: aiResponse.fallbackUsed ? (aiResponse.modelUsed || 'apex-local-embedded') : (aiResponse.providerName || 'CloudflareVisionProvider'),
          provider: aiResponse.providerName || 'CloudflareVisionProvider',
          model: aiResponse.modelUsed || '@cf/meta/llama-3.2-11b-vision-instruct',
          latency_ms: Date.now() - startTime,
          latency: Date.now() - startTime,
          status: finalStatus,
          cache_hit: false,
          cache_key: job.imageHash,
          retry_count: aiResponse.retriesAttempted ?? 0,
          error_code: aiResponse.providerErrorCode ? String(aiResponse.providerErrorCode) : (aiResponse.errorType || null),
          fallback_used: Boolean(aiResponse.fallbackUsed),
          abstention_reason: truthfulReason,
          candidate_set: candidates.map((c) => `${c.make} ${c.model}`),
          retrieved_references: candidates.slice(0, 5).map((c) => c.vehicleId),
          prompt_summary: 'APEX Evidence-First Hierarchical Multi-Candidate Prompt (Abstract Schema)',
          raw_model_response: null,
          classifier_output: finalResult.canonicalResult,
          final_result: finalResult
        });

        jobQueue.completeJob(job.id, finalStatus);
        job.result = finalResult;
        return finalResult;
      }

      // ─── STAGE 5: DETERMINISTIC VALIDATION ───
      const validationReport = deterministicValidator.validate(aiResponse.output);

      // ─── STAGE 6: INDEPENDENT CONFIDENCE ENGINE ───
      const confidence = confidenceEngine.computeConfidence({
        modelOutput: aiResponse.output,
        validationReport,
        qualityMetrics: quality,
        topCandidates: candidates
      });

      const finalStatus: ScanJobStatus = (aiResponse.canonicalResult?.status === 'uncertain' || aiResponse.output.abstentionReason === 'vision_provider_unavailable')
        ? 'uncertain'
        : confidence.shouldAbstain
        ? 'abstained'
        : validationReport.requiresHumanReview
        ? 'needs_review'
        : 'completed';

      const finalResult: IdentificationResult = {
        scanId: job.id,
        idempotencyKey: job.idempotencyKey,
        userId: job.userId,
        status: finalStatus,
        canonicalVehicleId: validationReport.canonicalRecord?.vehicleId || validationReport.canonicalIdentity?.canonicalId,
        make: validationReport.resolvedMake,
        model: validationReport.resolvedModel,
        generation: validationReport.resolvedGeneration,
        trim: validationReport.resolvedTrim,
        yearEstimate: validationReport.resolvedYear,
        color: aiResponse.output.color || 'Silver',
        rarity: validationReport.resolvedRarity,
        engine: validationReport.resolvedEngine,
        horsepower: validationReport.resolvedHorsepower,
        torqueNm: validationReport.resolvedTorqueNm,
        topSpeedKmH: validationReport.resolvedTopSpeed,
        zeroToHundredSec: validationReport.resolvedZeroToHundred,
        kerbWeightKg: validationReport.resolvedKerbWeight,
        productionYears: validationReport.resolvedProductionYears,
        originCountry: validationReport.resolvedOriginCountry,
        bodyStyle: validationReport.resolvedBodyStyle,
        historicalInformation: validationReport.canonicalRecord?.historicalInformation || aiResponse.output.historicalInformation,
        interestingFacts: validationReport.canonicalRecord?.notableFacts || aiResponse.output.interestingFacts,
        aftermarketPartsDetected: aiResponse.output.aftermarketPartsDetected,
        confidence,
        quality,
        topCandidates: candidates,
        processedAt: new Date().toISOString(),
        processingDurationMs: Date.now() - startTime,
        modelVersion: aiResponse.modelUsed,
        promptVersion: 'apex-master-v2.5',
        pipelineVersion: job.pipelineVersion,
        cached: false,
        traceId: job.traceId,
        canonicalResult: aiResponse.canonicalResult
      };

      // ─── STAGE 7: CACHE & FINALIZE ───
      if (confidence.isConfident && validationReport.isValid) {
        identificationCache.setResult(job.imageHash, finalResult);
      }

      tracer.recordScanTrace({
        scan_id: job.id,
        request_id: job.traceId,
        timestamp: new Date().toISOString(),
        image_hash: job.imageHash,
        image_size_bytes: job.imageDataUrl.length,
        provider_model: aiResponse.fallbackUsed ? (aiResponse.modelUsed || 'apex-local-embedded') : (aiResponse.providerName || 'CloudflareVisionProvider'),
        provider: aiResponse.providerName || 'CloudflareVisionProvider',
        model: aiResponse.modelUsed,
        latency_ms: Date.now() - startTime,
        latency: Date.now() - startTime,
        status: finalStatus,
        cache_hit: false,
        cache_key: job.imageHash,
        retry_count: aiResponse.retriesAttempted ?? 0,
        error_code: null,
        fallback_used: Boolean(aiResponse.fallbackUsed),
        abstention_reason: confidence.shouldAbstain ? (confidence.abstentionReason || 'Low confidence abstention') : null,
        candidate_set: candidates.map(c => `${c.make} ${c.model}`),
        retrieved_references: candidates.slice(0, 5).map(c => c.vehicleId),
        prompt_summary: 'APEX Evidence-First Hierarchical Multi-Candidate Prompt (Abstract Schema)',
        raw_model_response: aiResponse.output,
        classifier_output: aiResponse.canonicalResult,
        final_result: finalResult
      });

      jobQueue.completeJob(job.id, finalStatus);
      job.result = finalResult;
      return finalResult;
    } catch (err: any) {
      console.warn(`Job ${job.id} failed on attempt ${job.attempts}:`, err);

      // INVARIANT: Provider failure is terminal at the worker layer.
      // workerPool MUST NOT call enqueue(), setTimeout(), retry(), or equivalent for any failure.
      // All retry decisions belong exclusively to CloudflareVisionProvider.
      const isQuota = 
        err?.message?.includes('429') || 
        err?.message?.includes('quota') || 
        err?.message?.includes('Quota') || 
        err?.message?.includes('4006') ||
        err?.message?.includes('3036') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');

      const finalJobStatus: ScanJobStatus = 'uncertain';
      const errMessage = err?.message || 'Processing failed.';
      const abstentionReason = isQuota ? 'VISION_QUOTA_EXHAUSTED' : errMessage;
      
      job.error = errMessage;
      const errorResult: IdentificationResult = {
        scanId: job.id,
        idempotencyKey: job.idempotencyKey,
        userId: job.userId,
        status: finalJobStatus,
        make: null,
        model: null,
        generation: null,
        trim: null,
        yearEstimate: 'Unknown',
        color: 'Unknown',
        rarity: 'common',
        engine: 'Unknown',
        horsepower: 0,
        torqueNm: 0,
        topSpeedKmH: 0,
        zeroToHundredSec: 0,
        kerbWeightKg: 0,
        productionYears: 'Unknown',
        originCountry: 'Global',
        bodyStyle: 'Sedan',
        historicalInformation: '',
        interestingFacts: '',
        aftermarketPartsDetected: [],
        confidence: {
          totalScore: 0.0,
          isConfident: false,
          shouldAbstain: true,
          abstentionReason,
          breakdown: {
            visualSimilarityWeight: 0,
            modelAgreementWeight: 0,
            candidateMarginWeight: 0,
            frameAgreementWeight: 0,
            databaseConsistencyWeight: 0,
            qualityPenalty: 1.0
          }
        },
        quality: quality || { isUsable: false, blurScore: 0, luminanceScore: 0, contrastScore: 0, aspectRatio: 1, vehicleBoundingEstimated: false },
        topCandidates: [],
        processedAt: new Date().toISOString(),
        processingDurationMs: Date.now() - startTime,
        modelVersion: 'provider-failed',
        promptVersion: 'apex-prompt-v2',
        pipelineVersion: job.pipelineVersion,
        cached: false,
        traceId: job.traceId
      };

      job.result = errorResult;
      jobQueue.completeJob(job.id, finalJobStatus);
      deadLetterQueue.push(job, errMessage);
      return errorResult;
    }
  }
}

export const workerPool = new WorkerPool();
workerPool.start(10);
