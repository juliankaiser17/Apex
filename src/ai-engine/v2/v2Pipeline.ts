/**
 * APEX v2 — Master Identification Pipeline Orchestrator
 * 
 * Pipeline Execution Flow:
 * [Raw Image]
 *     ↓
 * Stage A: Quality Gate, Subject Crop, Privacy Plate/Face Blurring
 *     ↓ (Reject non-car / blur / dark)
 * Stage B: Feature Embedding & Reference Gallery k-NN Retrieval
 *     ↓ (Open-Set Detection -> not_in_catalogue)
 * [Margin Check: Is retrieval decisive?]
 *     ├── YES (margin >= 0.16) ────────┐
 *     └── NO  (close variants)         │
 *          ↓                           │
 * Stage C: Constrained VLM Adjudication│
 *     │   (Top 5 Candidates Comparison)│
 *     └───>────────────────────────────┘
 *     ↓
 * Stage D: Evidence Fusion (Retrieval + VLM Choice + Badge Text + Discriminator Veto)
 *     ↓
 * Stage E: Decision Policy & Guided Recovery
 *     ↓ ('identified' | 'identified_model' | 'needs_more_views' | 'uncertain' | 'rejected' | 'not_in_catalogue')
 * Stage F: Canonical Registry Spec Enrichment (Verified facts only; zero VLM stats)
 *     ↓
 * [V2 Result Contract]
 */

import { qualityGateAndCropEngine } from './stageA_qualityAndCrop';
import { galleryRetrievalEngine } from './stageB_galleryRetrieval';
import { constrainedVlmAdjudicator } from './stageC_constrainedAdjudicator';
import { evidenceFusionEngine } from './stageD_evidenceFusion';
import { decisionPolicyEngine } from './stageE_decisionPolicy';
import { specResolutionEngine } from './stageF_specResolver';
import { aiTelemetry } from './telemetry';
import type { V2IdentificationResult, VlmAdjudicationOutput } from './types';
import { vlmFirstEngine } from './vlmFirstEngine';
import crypto from 'crypto';

export interface V2ScanInput {
  imageDataUrl: string;
  traceId?: string;
  userId?: string;
  simulatedPerceptualHints?: {
    makeHint?: string | null;
    modelHint?: string | null;
    observableCues?: string[];
    badgeText?: string | null;
    rawVlmResponse?: string;
    isVehicleHint?: boolean;
  };
  sessionFramesCount?: number;
  customVlmCaller?: (prompt: string, imageDataUrl: string, modelName: string, timeoutMs: number) => Promise<{ rawText: string; tokens?: any }>;
}

export class V2IdentificationPipeline {
  /**
   * Execute full v2 Identification Pipeline
   */
  public async execute(input: V2ScanInput): Promise<V2IdentificationResult> {
    const t0 = performance.now();
    const traceId = input.traceId || `trace_v2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Phase 15 VLM-First Feature Flag:
    // Production behaviour remains completely unchanged until this flag is enabled!
    if (
      (typeof process !== 'undefined' && process.env?.VLM_FIRST_ENABLED === 'true') ||
      (typeof process !== 'undefined' && process.env?.AI_PIPELINE === 'vlm-first')
    ) {
      return vlmFirstEngine.execute({
        imageDataUrl: input.imageDataUrl,
        traceId,
        customVlmCaller: input.customVlmCaller,
        enableSecondOpinion: typeof process !== 'undefined' && process.env?.EXPENSIVE_VERIFICATION_ENABLED !== 'false'
      });
    }

    const imageHash = crypto.createHash('sha256').update(input.imageDataUrl).digest('hex');
    let vlmCallsCount = 0;

    // ── STAGE A: Quality Gate & Crop ──
    const tStageA = performance.now();
    const qualityResult = await qualityGateAndCropEngine.evaluateImage(
      input.imageDataUrl,
      { isVehicleHint: input.simulatedPerceptualHints?.isVehicleHint }
    );
    const latencyA = Math.round(performance.now() - tStageA);

    if (!qualityResult.isPassable) {
      const emptyRetrieval = {
        topCandidates: [],
        isDecisive: false,
        bestDistance: 1.0,
        isOpenSetAnomaly: false,
        marginToSecond: 0.0
      };
      const emptyConf = { make: 0, model: 0, generation: 0, variant: 0, overall: 0 };
      const policyOut = decisionPolicyEngine.evaluate({
        quality: qualityResult.quality,
        retrieval: emptyRetrieval,
        rankedCandidates: [],
        calibratedConfidence: emptyConf,
        viewpoint: qualityResult.quality.estimatedViewpoint,
        sessionFramesCount: input.sessionFramesCount
      });

      const totalLatency = Math.round(performance.now() - t0);
      aiTelemetry.recordTrace({
        traceId,
        timestamp: new Date().toISOString(),
        imageHash: imageHash.substring(0, 32),
        userConsented: false,
        pipelineVersion: 'v2.0.0',
        mode: 'v2',
        stageLatencies: {
          stageA_quality_ms: latencyA,
          stageB_retrieval_ms: 0,
          stageC_adjudication_ms: 0,
          stageD_fusion_ms: 0,
          stageE_policy_ms: 0,
          stageF_specs_ms: 0,
          total_ms: totalLatency
        },
        stageOutcomes: {
          qualityGatePassed: false,
          viewpoint: qualityResult.quality.estimatedViewpoint,
          retrievalCandidateCount: 0,
          retrievalTopSimilarity: 0,
          retrievalMargin: 0,
          isOpenSet: false,
          adjudicationOutcome: 'skipped',
          vlmCallsMade: 0,
          providerUsed: 'none',
          finalStatus: policyOut.status,
          canonicalId: null,
          make: null,
          model: null,
          variant: null,
          confidence: 0
        },
        costUsd: 0.0
      });

      return {
        status: policyOut.status,
        canonicalVehicleId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: policyOut.displayName,
        calibratedConfidence: emptyConf,
        verifiedSpecs: null,
        guidedRecovery: policyOut.guidedRecovery,
        candidateOptions: policyOut.candidateOptions,
        retrievalStage: emptyRetrieval,
        qualityStage: qualityResult.quality,
        sessionFrameCount: input.sessionFramesCount || 1,
        totalLatencyMs: totalLatency,
        estimatedCostUsd: 0.0,
        vlmCallsCount: 0,
        traceId
      };
    }

    // ── STAGE B: Reference Gallery Retrieval & Open-Set Detection ──
    const tStageB = performance.now();
    const queryVector = await galleryRetrievalEngine.generateQueryVector(
      qualityResult.croppedBase64 || input.imageDataUrl,
      input.simulatedPerceptualHints
    );

    const retrieval = galleryRetrievalEngine.searchGallery(
      queryVector,
      qualityResult.quality.estimatedViewpoint,
      {
        targetMake: input.simulatedPerceptualHints?.makeHint,
        topK: 5
      }
    );
    const latencyB = Math.round(performance.now() - tStageB);

    // ── STAGE C: Constrained VLM Adjudication ──
    const tStageC = performance.now();
    let adjudicationOutput: VlmAdjudicationOutput;
    const shouldAdjudicate = (
      !retrieval.isDecisive &&
      (retrieval.topCandidates.length > 0 || Boolean(input.simulatedPerceptualHints?.rawVlmResponse) || Boolean(input.customVlmCaller))
    );

    if (shouldAdjudicate) {
      adjudicationOutput = await constrainedVlmAdjudicator.adjudicate({
        candidates: retrieval.topCandidates,
        viewpoint: qualityResult.quality.estimatedViewpoint,
        imageDataUrl: qualityResult.croppedBase64 || input.imageDataUrl,
        simulatedRawEvidence: input.simulatedPerceptualHints,
        customVlmCaller: input.customVlmCaller
      });
      vlmCallsCount += adjudicationOutput.vlmCallsMade;
    } else {
      adjudicationOutput = {
        outcome: 'skipped_adjudication',
        chosenCandidateId: 'none',
        decidingCues: [],
        legibleBadgeText: null,
        rawConfidence: 0.0,
        vlmCallsMade: 0,
        latencyMs: 0
      };
    }
    const latencyC = Math.round(performance.now() - tStageC);

    // ── STAGE D: Evidence Fusion & Calibration ──
    const tStageD = performance.now();
    const fused = evidenceFusionEngine.fuse({
      retrieval,
      adjudication: adjudicationOutput,
      observableCues: input.simulatedPerceptualHints?.observableCues,
      viewpoint: qualityResult.quality.estimatedViewpoint,
      rawMakeHint: input.simulatedPerceptualHints?.makeHint,
      rawModelHint: input.simulatedPerceptualHints?.modelHint
    });
    const latencyD = Math.round(performance.now() - tStageD);

    // ── STAGE E: Decision Policy & Guided Recovery ──
    const tStageE = performance.now();
    const policy = decisionPolicyEngine.evaluate({
      quality: qualityResult.quality,
      retrieval,
      rankedCandidates: fused.rankedCandidates,
      calibratedConfidence: fused.calibratedConfidence,
      viewpoint: qualityResult.quality.estimatedViewpoint,
      sessionFramesCount: input.sessionFramesCount,
      adjudication: adjudicationOutput
    });
    const latencyE = Math.round(performance.now() - tStageE);

    // ── STAGE F: Verified Specs Resolution ──
    const tStageF = performance.now();
    const verifiedSpecs = specResolutionEngine.resolveSpecs(policy.canonicalId);
    const latencyF = Math.round(performance.now() - tStageF);

    const totalLatency = Math.round(performance.now() - t0);
    // Cost: $0 if retrieval-only, ~$0.0016 if 1 VLM call
    const estimatedCostUsd = vlmCallsCount * 0.0016;

    // Record Telemetry
    aiTelemetry.recordTrace({
      traceId,
      timestamp: new Date().toISOString(),
      imageHash: imageHash.substring(0, 32),
      userConsented: false,
      pipelineVersion: 'v2.0.0',
      mode: 'v2',
      stageLatencies: {
        stageA_quality_ms: latencyA,
        stageB_retrieval_ms: latencyB,
        stageC_adjudication_ms: latencyC,
        stageD_fusion_ms: latencyD,
        stageE_policy_ms: latencyE,
        stageF_specs_ms: latencyF,
        total_ms: totalLatency
      },
      stageOutcomes: {
        qualityGatePassed: true,
        viewpoint: qualityResult.quality.estimatedViewpoint,
        retrievalCandidateCount: retrieval.topCandidates.length,
        retrievalTopSimilarity: retrieval.topCandidates[0]?.similarityScore || 0,
        retrievalMargin: retrieval.marginToSecond,
        isOpenSet: retrieval.isOpenSetAnomaly,
        adjudicationOutcome: adjudicationOutput.outcome,
        vlmCallsMade: vlmCallsCount,
        providerUsed: vlmCallsCount > 0 ? 'gemini-3.5-flash' : 'retrieval_only',
        finalStatus: policy.status,
        canonicalId: policy.canonicalId,
        make: policy.make,
        model: policy.model,
        variant: policy.variant,
        confidence: fused.calibratedConfidence.overall
      },
      costUsd: estimatedCostUsd
    });

    return {
      status: policy.status,
      canonicalVehicleId: policy.canonicalId,
      make: policy.make,
      model: policy.model,
      generation: policy.generation,
      variant: policy.variant,
      displayName: policy.displayName,
      calibratedConfidence: fused.calibratedConfidence,
      openWorldIdentity: adjudicationOutput.openWorldIdentity,
      inCatalogue: policy.inCatalogue ?? (policy.status === 'identified' || policy.status === 'identified_model'),
      verifiedSpecs,
      guidedRecovery: policy.guidedRecovery,
      candidateOptions: policy.candidateOptions,
      retrievalStage: retrieval,
      adjudicationStage: adjudicationOutput,
      qualityStage: qualityResult.quality,
      sessionFrameCount: input.sessionFramesCount || 1,
      totalLatencyMs: totalLatency,
      estimatedCostUsd,
      vlmCallsCount,
      traceId
    };
  }
}

export const v2Pipeline = new V2IdentificationPipeline();
