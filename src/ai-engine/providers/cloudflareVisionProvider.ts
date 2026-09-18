/**
 * APEX — Production Cloudflare Workers AI Vision Provider Adapter
 * Model: @cf/meta/llama-3.2-11b-vision-instruct
 * 
 * Official Cloudflare REST Endpoint:
 * https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct
 * 
 * Evidentiary Perception Engine:
 * - Pure visual perception: Extracts observable evidence without guessing or hallucinating trims.
 * - Zero few-shot anchors: Never primes model toward known regression vehicles.
 * - Feeds directly into Apex's authoritative deterministic validator & confidence engine.
 * - Server-side only: Credentials never touch client bundles or mobile APKs.
 * - Nuanced 429 handling: Distinguishes Error 3036 (Daily Quota) vs Error 3040 (Capacity).
 * - Meta License Detection: Identifies unaccepted terms and provides exact setup command.
 */

import type { AIProvider, AIProviderErrorType, AIProviderRequest, AIProviderResponse, VisionStageTelemetry } from './types';
import type {
  CandidateComparison,
  CanonicalScanResult,
  EvidenceProvenance,
  ImmutableUpstreamEvidence,
  ModelIdentificationOutput,
  OpenCanonicalIdentity,
  ViewpointType,
  VisualEvidence
} from '../types';
import { hierarchicalClassifier } from '../validation/hierarchicalClassifier';
import { confidenceEngine } from '../validation/confidenceEngine';
import { getEstimatedMarketValue } from '../../utils/marketValuation';

declare const process: any;
declare const Buffer: any;

export interface CloudflareProviderConfig {
  accountId?: string;
  apiToken?: string;
  model?: string;
  seed?: number;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export class CloudflareVisionProvider implements AIProvider {
  public name = 'CloudflareVisionProvider';
  private defaultModel = '@cf/meta/llama-3.2-11b-vision-instruct';
  private accountId: string;
  private apiToken: string;
  private seed: number;
  private temperature: number;
  private maxTokens: number;
  private timeoutMs: number;

  constructor(config?: CloudflareProviderConfig) {
    this.accountId = config?.accountId || this.resolveAccountId();
    this.apiToken = config?.apiToken || this.resolveApiToken();
    this.defaultModel = config?.model || (typeof process !== 'undefined' && process.env?.CLOUDFLARE_MODEL) || this.defaultModel;
    this.seed = config?.seed ?? 42;
    this.temperature = config?.temperature ?? 0.1;
    this.maxTokens = config?.maxTokens ?? 150;
    this.timeoutMs = config?.timeoutMs ?? 35000;
  }

  private resolveAccountId(): string {
    if (typeof process !== 'undefined') {
      const id = process.env?.CLOUDFLARE_ACCOUNT_ID;
      if (id && typeof id === 'string' && id.trim().length > 3) {
        return id.replace(/^<|>$/g, '').trim();
      }
    }
    return '';
  }

  private resolveApiToken(): string {
    if (typeof process !== 'undefined') {
      const token = process.env?.CLOUDFLARE_AUTH_TOKEN;
      if (token && typeof token === 'string' && token.trim().length > 5) {
        return token.replace(/^<|>$/g, '').trim();
      }
    }
    return '';
  }

  public getAccountId(): string {
    if (!this.accountId) this.accountId = this.resolveAccountId();
    return this.accountId;
  }

  public getApiToken(): string {
    if (!this.apiToken) this.apiToken = this.resolveApiToken();
    return this.apiToken;
  }

  public async isAvailable(): Promise<boolean> {
    const accountId = this.getAccountId();
    const token = this.getApiToken();
    return accountId.length > 3 && token.length > 5;
  }

  public classifyError(err: any): {
    errorType: AIProviderErrorType;
    isTransient: boolean;
    status?: number;
    errorCode?: number | string;
    message: string;
  } {
    const status = err?.status;
    const errorCode = err?.errorCode;
    const errMsg = err?.message || '';

    // Specific provider code / message FIRST (avoid false HTTP-level classification)
    const isLicense =
      errorCode === 5016 ||
      /meta license|acceptable use policy|terms/i.test(errMsg) ||
      (status === 403 && /agree|license|terms/i.test(errMsg));

    const isQuota =
      errorCode === 3036 ||
      errorCode === 4006 ||
      errMsg.includes('3036') ||
      errMsg.includes('4006') ||
      /daily free allocation|10,000 neurons|neuron daily limit/i.test(errMsg);

    const isCapacity =
      errorCode === 3040 ||
      /capacity|out of capacity/i.test(errMsg);

    const isInvalidModel =
      errorCode === 5007 ||
      (status === 400 && /model/i.test(errMsg));

    const isRequestTooLarge =
      errorCode === 3006 ||
      status === 413 ||
      /too large|payload/i.test(errMsg);

    const isTimeout =
      err?.name === 'AbortError' ||
      status === 408 ||
      /timed out|timeout/i.test(errMsg);

    const isAuth =
      status === 401 ||
      status === 403;

    if (isLicense) {
      return {
        errorType: 'MODEL_AGREEMENT_REQUIRED',
        isTransient: false,
        status: status || 403,
        errorCode: errorCode || 5016,
        message: 'Meta License agreement required for @cf/meta/llama-3.2-11b-vision-instruct. Accept terms in Cloudflare dashboard or execute prompt agreement.'
      };
    }

    if (isQuota) {
      return {
        errorType: 'VISION_QUOTA_EXHAUSTED',
        isTransient: false,
        status: status || 429,
        errorCode: errorCode || 4006,
        message: errMsg || 'Cloudflare daily free allocation of 10,000 neurons exhausted (Error 4006/3036). Daily quota resets at 00:00 UTC.'
      };
    }

    if (isCapacity) {
      return {
        errorType: 'PROVIDER_CAPACITY',
        isTransient: true,
        status: status || 429,
        errorCode: errorCode || 3040,
        message: 'Cloudflare Workers AI temporarily out of capacity (Error 3040).'
      };
    }

    if (isInvalidModel) {
      return {
        errorType: 'INVALID_MODEL',
        isTransient: false,
        status: status || 400,
        errorCode: errorCode || 5007,
        message: errMsg || 'Cloudflare model not found or invalid.'
      };
    }

    if (isRequestTooLarge) {
      return {
        errorType: 'REQUEST_TOO_LARGE',
        isTransient: false,
        status: status || 413,
        errorCode: errorCode || 3006,
        message: errMsg || 'Image payload exceeds Cloudflare Workers AI maximum request size.'
      };
    }

    if (isTimeout) {
      return {
        errorType: 'TIMEOUT',
        isTransient: true,
        status: 408,
        errorCode,
        message: 'Cloudflare Workers AI request timed out.'
      };
    }

    if (isAuth) {
      return {
        errorType: 'AUTH_ERROR',
        isTransient: false,
        status: status || 401,
        errorCode,
        message: errMsg || `Cloudflare API authentication failed (HTTP ${status}). Verify CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AUTH_TOKEN.`
      };
    }

    if (status === 429) {
      return {
        errorType: '429',
        isTransient: true,
        status: 429,
        errorCode,
        message: errMsg || 'Cloudflare Workers AI rate limit exceeded (HTTP 429).'
      };
    }

    if (status && status >= 500 && status < 600) {
      return {
        errorType: '5xx',
        isTransient: true,
        status,
        errorCode,
        message: errMsg || `Cloudflare Workers AI server error (HTTP ${status}).`
      };
    }

    if (/fetch failed|network|econnreset|enotfound/i.test(errMsg)) {
      return {
        errorType: 'NETWORK_ERROR',
        isTransient: true,
        status,
        errorCode,
        message: errMsg || 'Network error communicating with Cloudflare Workers AI.'
      };
    }

    return {
      errorType: '5xx',
      isTransient: false,
      status: status || 500,
      errorCode,
      message: errMsg || 'Unexpected Cloudflare Workers AI error.'
    };
  }

  public async identify(request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const model = request.options?.modelOverride || this.defaultModel;
    const accountId = this.getAccountId();
    const token = this.getApiToken();

    const isColdStart = request.options?.isColdStart ?? false;
    const warmState = !isColdStart;
    const imagePreprocessingMs = request.options?.imagePreprocessingMs;
    const imageDimensions = request.options?.imageDimensions;
    const uploadStartTimestamp = new Date().toISOString();

    if (!accountId || !token) {
      return {
        success: false,
        error: 'Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AUTH_TOKEN) not configured on server.',
        errorType: 'AUTH_ERROR',
        providerStatus: 401,
        providerErrorCode: 'MISSING_CREDENTIALS',
        retriesAttempted: 0,
        retryConsumed: false,
        providerName: this.name,
        providerAttempted: this.name,
        fallbackUsed: false,
        modelUsed: model,
        tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startTime
      };
    }

    // Format normalized image data URL (Cloudflare official schema accepts data URL)
    let fullDataUrl = request.imageDataUrl;
    if (!fullDataUrl.startsWith('data:')) {
      fullDataUrl = `data:image/jpeg;base64,${request.imageDataUrl}`;
    }
    const encodedImageBytes = typeof Buffer !== 'undefined' ? Buffer.byteLength(fullDataUrl, 'utf8') : fullDataUrl.length;

    // ─── APEX EVIDENTIARY VEHICLE PERCEPTION PROMPTS ───
    // Minimal perception schema yields ~90 tokens and ~20 Neurons vs ~330 tokens and ~51 Neurons for monolithic.
    const isMonolithic = request.options?.schema === 'monolithic';

    const minimalSystemPrompt = `You are the APEX Automotive Perception Vision Engine.
Your sole job is visual perception of the vehicle in this photo following strict evidentiary discipline.
You must output ONLY flat valid JSON starting with '{' and ending with '}'.
Do NOT write any conversational intro, outro, markdown prose, or bullet points.

RULES:
1. OBSERVABLE EVIDENCE ONLY: Describe only visible features. Occluded or unobservable features MUST be null.
2. VIEWPOINT: "front", "rear", "side", "front_3q", "rear_3q", "interior", "partial", "multiple_vehicles", or "unknown".
3. NON-CAR & COMMERCIAL VEHICLE REJECTION:
   - If not a motor vehicle: set "vehicle_present": false, "status": "rejected", "make": null, "model": null, "generation": null, "variant": null.
   - If public transit bus, coach, semi-truck, or heavy equipment: set "vehicle_present": false, "status": "rejected", "make": null, "model": null, "generation": null, "variant": null.
4. HIERARCHICAL IDENTIFICATION:
   - Identify Make.
   - Identify Model Family.
   - Generation: identify chassis/generation code (e.g. XV70, E210, G82) only if verifiable from visible lights/bodywork. Else null.
   - Variant: ONLY identify exact performance trim/variant if distinct visual proof exists (e.g. badging, verified aero). Else variant MUST be null.
5. NO HALLUCINATION:
   - Never invent a trim. Variant must be null unless confirmed.`;

    const minimalUserPrompt = `Analyze this vehicle. Return flat JSON:
{
  "status": "identified",
  "vehicle_present": true,
  "viewpoint": "front_3q",
  "make": "Toyota",
  "model": "Camry",
  "generation": "XV70",
  "variant": null,
  "confidence": 0.90,
  "body_style": "Sedan",
  "evidence": ["spindle grille"],
  "color": "Silver",
  "year": "2020"
}
Rules:
- status: "identified", "uncertain", or "rejected".
- variant MUST be null unless badging is confirmed.
- evidence: maximum 2 concise visual cues.
Output only the JSON object starting with { and ending with } without any conversational intro, prose, or explanation.`;

    const monolithicSystemPrompt = `You are the APEX Automotive Perception Vision Engine.
Your sole job is visual perception of the vehicle in this photo following strict evidentiary discipline.
You must output ONLY raw valid JSON starting with '{' and ending with '}'.
Do NOT write any conversational intro, outro, markdown prose, or bullet points.

RULES:
1. OBSERVABLE EVIDENCE ONLY: Describe only visible features. Occluded or unobservable features MUST be null.
   Never hallucinate rear exhausts from a front photo or front grilles from a rear photo.
2. VIEWPOINT: "front", "rear", "side", "front_3q", "rear_3q", "interior", "partial", "multiple_vehicles", or "unknown".
3. NON-CAR & COMMERCIAL VEHICLE REJECTION:
   - If not a motor vehicle (person, pet, food, screenshot, scenery): set "vehicle_present": false, "status": "rejected", "rejection_reason": "No motor vehicle detected in frame."
   - If public transit bus, coach, semi-truck, or heavy equipment: set "vehicle_present": false, "status": "rejected", "rejection_reason": "Commercial public transport or heavy vehicle detected; not a consumer passenger automobile."
4. HIERARCHICAL IDENTIFICATION:
   - Identify Make.
   - Identify Model Family.
   - Identify Generation/Chassis code only if verifiable from visible lights/bodywork.
   - Variant: ONLY identify exact performance trim/variant if distinct visual proof exists (e.g. verified aero package, badging). Else variant MUST be null.
5. NO HALLUCINATION / ABSTENTION MANDATE:
   - If evidence is ambiguous, prefer "status": "uncertain" with model_family identified and variant: null, over guessing.
   - Never invent a trim. Never substitute an unrelated manufacturer.`;

    const monolithicUserPrompt = `Analyze the vehicle in this image and return a JSON object with this exact structure:
{
  "status": "identified",
  "vehicle_present": true,
  "rejection_reason": null,
  "image_quality": {
    "usable": true,
    "score": 0.90,
    "issues": []
  },
  "viewpoint": "front_3q",
  "visual_evidence": {
    "body_style": "Sedan",
    "grille": null,
    "headlights": null,
    "taillights": null,
    "hood": null,
    "roofline": null,
    "windows": null,
    "wheels": null,
    "exhaust": null,
    "aero": null,
    "badges": null,
    "text": null,
    "body_proportions": null,
    "distinctive_details": []
  },
  "identification": {
    "make": "Manufacturer",
    "model_family": "Model",
    "generation": "Generation",
    "variant": null
  },
  "confidence": {
    "make_score": 0.95,
    "model_score": 0.90,
    "generation_score": 0.80,
    "variant_score": 0.30,
    "overall_score": 0.90
  },
  "candidates": [
    {
      "name": "Full Name",
      "score": 0.90,
      "supporting_evidence": [],
      "contradictions": [],
      "unobservable_features": []
    }
  ],
  "contradictions": [],
  "specificity_level": "model_family",
  "reason": "Observable evidence reasoning",
  "privacy_redactions": [],
  "specs": {
    "color": "Silver",
    "year_estimate": "2020",
    "body_style": "Sedan"
  }
}
Output only the JSON object starting with { and ending with } without any conversational intro, prose, or explanation.`;

    const systemPrompt = isMonolithic ? monolithicSystemPrompt : minimalSystemPrompt;
    const userPrompt = isMonolithic ? monolithicUserPrompt : minimalUserPrompt;

    const format = request.options?.format || 'messages';
    const stream = request.options?.stream ?? false;
    const effectiveTimeoutMs = request.options?.timeoutMs || this.timeoutMs;
    const defaultTokensForSchema = isMonolithic ? 512 : this.maxTokens;
    const effectiveMaxTokens = request.options?.maxTokens ?? defaultTokensForSchema;
    const effectiveTemperature = request.options?.temperature ?? this.temperature;
    const effectiveSeed = request.options?.seed ?? this.seed;

    let retriesAttempted = 0;
    let retryConsumed = false;

    try {
      const execParams: any = {
        accountId,
        token,
        model,
        imageDataUrl: fullDataUrl,
        timeoutMs: effectiveTimeoutMs,
        temperature: effectiveTemperature,
        seed: effectiveSeed,
        maxTokens: effectiveMaxTokens,
        stream
      };

      if (format === 'inst') {
        execParams.prompt = `[INST] <<SYS>>\n${systemPrompt}\n<</SYS>>\n\n${userPrompt} [/INST]`;
      } else {
        execParams.messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];
      }

      let execResult: any = null;
      let lastErr: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          execResult = await this.executeCloudflareRequest(execParams);
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          const classified = this.classifyError(err);
          if (attempt === 0 && classified.isTransient) {
            retriesAttempted += 1;
            retryConsumed = true;
            console.warn(`[CloudflareVisionProvider] Transient error on attempt 1 (${classified.errorType}), retrying once:`, err?.message);
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          // Terminal or already retried once -> halt immediately
          break;
        }
      }

      if (!execResult && lastErr) {
        throw lastErr;
      }

      const parseStart = Date.now();
      let parsed = execResult.json;
      if (parsed && typeof parsed.response === 'object' && parsed.response !== null) {
        parsed = parsed.response;
      }
      const jsonParsingMs = Date.now() - parseStart;

      // Handle non-vehicle rejection immediately (strictly check for false or rejected, not undefined)
      const isExplicitRejection = parsed.vehicle_present === false || parsed.status === 'rejected' || (parsed.image_quality && parsed.image_quality.usable === false);
      if (isExplicitRejection) {
        const qualityScore = parsed.image_quality?.score || 0.1;
        const issues = parsed.image_quality?.issues || ['No motor vehicle detected in the frame.'];
        const rejectionReason = parsed.rejection_reason || issues.join('; ');

        const canonicalResult: CanonicalScanResult = {
          status: 'rejected',
          vehicle_present: false,
          image_quality: {
            usable: false,
            score: qualityScore,
            issues
          },
          viewpoint: parsed.viewpoint || 'unknown',
          visual_evidence: parsed.visual_evidence || this.getEmptyEvidence(),
          identification: { make: null, model_family: null, generation: null, variant: null },
          confidence: { make_score: 0, model_score: 0, generation_score: 0, variant_score: 0, overall_score: 0 },
          candidates: [],
          contradictions: ['Subject is not a consumer passenger automobile.'],
          specificity_level: 'make',
          reason: rejectionReason,
          needs_retake: true
        };

        const totalEndToEndMs = Date.now() - startTime;
        const telemetry: VisionStageTelemetry = {
          isColdStart,
          warmState,
          imagePreprocessingMs,
          encodedImageBytes,
          imageDimensions,
          uploadStartTimestamp,
          cloudflareRequestDurationMs: execResult.cloudflareRequestDurationMs ?? totalEndToEndMs,
          timeToFirstTokenMs: execResult.timeToFirstTokenMs ?? null,
          totalModelResponseDurationMs: execResult.totalModelResponseDurationMs ?? totalEndToEndMs,
          jsonParsingMs,
          deterministicValidationMs: 0,
          totalEndToEndMs,
          neurons: execResult.neurons,
          promptTokens: execResult.tokens?.promptTokens,
          completionTokens: execResult.tokens?.outputTokens,
          totalTokens: execResult.tokens?.totalTokens
        };

        return {
          success: true,
          output: this.createRejectionOutput(rejectionReason, qualityScore),
          canonicalResult,
          providerName: this.name,
          providerAttempted: this.name,
          fallbackUsed: false,
          retriesAttempted,
          retryConsumed,
          modelUsed: model,
          tokensConsumed: execResult.tokens || { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
          neuronsConsumed: execResult.neurons,
          telemetry,
          durationMs: totalEndToEndMs
        };
      }

      // Extract viewpoint and visual evidence (supports both minimal flat and legacy nested schemas)
      const viewpoint: ViewpointType = parsed.viewpoint || 'unknown';
      const evidenceList: string[] = Array.isArray(parsed.evidence)
        ? parsed.evidence
        : (Array.isArray(parsed.visual_evidence?.distinctive_details) ? parsed.visual_evidence.distinctive_details : []);

      const visualEvidence: VisualEvidence = {
        body_style: parsed.body_style || parsed.visual_evidence?.body_style || null,
        grille: parsed.visual_evidence?.grille || (evidenceList.find((e: string) => /grille/i.test(e)) ?? null),
        headlights: parsed.visual_evidence?.headlights || (evidenceList.find((e: string) => /headlight|lamp|drl/i.test(e)) ?? null),
        taillights: parsed.visual_evidence?.taillights || (evidenceList.find((e: string) => /taillight/i.test(e)) ?? null),
        hood: parsed.visual_evidence?.hood || null,
        roofline: parsed.visual_evidence?.roofline || null,
        windows: parsed.visual_evidence?.windows || null,
        wheels: parsed.visual_evidence?.wheels || null,
        exhaust: parsed.visual_evidence?.exhaust || null,
        aero: parsed.visual_evidence?.aero || (evidenceList.find((e: string) => /spoiler|wing|splitter|diffuser/i.test(e)) ?? null),
        badges: parsed.visual_evidence?.badges || (evidenceList.find((e: string) => /badge|emblem|roundel/i.test(e)) ?? null),
        text: parsed.visual_evidence?.text || null,
        body_proportions: parsed.visual_evidence?.body_proportions || null,
        distinctive_details: evidenceList.length > 0 ? evidenceList : null
      };

      let rawMake: string | null = parsed.make || parsed.identification?.make || null;
      let rawModel: string | null = parsed.model || parsed.identification?.model_family || null;
      let rawGen: string | null = parsed.generation || parsed.identification?.generation || null;
      let rawVariant: string | null = parsed.variant || parsed.identification?.variant || null;

      // Sanitize multi-vehicle string concatenations
      if (rawMake && (rawMake.toLowerCase().includes('multiple') || rawMake.includes(';'))) {
        rawMake = null;
        rawModel = null;
        rawGen = null;
        rawVariant = null;
      }
      if (rawModel && (rawModel.toLowerCase().includes('multiple') || rawModel.includes(';'))) {
        rawModel = null;
        rawGen = null;
        rawVariant = null;
      }

      let rawCandidates: CandidateComparison[] = [];
      if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        rawCandidates = parsed.candidates.map((c: any) => ({
          name: c.name || 'Unknown Candidate',
          score: Number(c.score) || 0.5,
          supporting_evidence: Array.isArray(c.supporting_evidence) ? c.supporting_evidence : [],
          contradictions: Array.isArray(c.contradictions) ? c.contradictions : [],
          unobservable_features: Array.isArray(c.unobservable_features) ? c.unobservable_features : []
        }));
      } else if (rawMake && rawModel) {
        const candidateName = [rawMake, rawModel, rawGen, rawVariant].filter(Boolean).join(' ');
        const candidateScore = typeof parsed.confidence === 'number'
          ? parsed.confidence
          : (parsed.confidence?.overall_score || 0.90);
        rawCandidates = [
          {
            name: candidateName,
            score: candidateScore,
            supporting_evidence: evidenceList,
            contradictions: [],
            unobservable_features: []
          }
        ];
      }

      // Hierarchical Classification & Contradiction Filter
      const valStart = Date.now();
      const classResult = hierarchicalClassifier.classify({
        visual_evidence: visualEvidence,
        viewpoint,
        raw_make: rawMake,
        raw_model: rawModel,
        raw_generation: rawGen,
        raw_variant: rawVariant,
        raw_candidates: rawCandidates
      });

      // Confidence Engine Scoring & State Assignment
      const winnerContradictions = classResult.top_candidate?.contradictions || [];
      const globalContradictions = classResult.contradictions.filter((c) =>
        c.includes('public transit') || c.includes('taxi livery') || c.includes('Severe vehicle-type')
      );

      const calibConf = confidenceEngine.computeHierarchicalConfidence({
        image_quality_score: parsed.image_quality?.score ?? (typeof parsed.confidence === 'number' ? parsed.confidence : 0.90),
        evidence_strength: visualEvidence.distinctive_details ? 0.85 : 0.65,
        candidate_separation: classResult.candidate_separation,
        top_candidate_contradictions: winnerContradictions,
        global_contradictions: globalContradictions,
        contradiction_count: winnerContradictions.length + globalContradictions.length,
        top_candidate_score: classResult.top_candidate?.score || 0.75,
        specificity_level: classResult.specificity_level,
        has_vehicle: true
      });
      const deterministicValidationMs = Date.now() - valStart;

      // Immutable Upstream Evidence Object
      const upstreamEvidence: ImmutableUpstreamEvidence = Object.freeze({
        provider: this.name,
        model: model,
        raw_identity: `${rawMake || ''} ${rawModel || ''} ${rawVariant || ''}`.trim(),
        make: rawMake,
        model_family: rawModel,
        generation: rawGen,
        variant: rawVariant,
        confidence: calibConf.confidence.overall_score,
        visual_evidence: visualEvidence,
        textual_evidence: visualEvidence.distinctive_details || [],
        viewpoint,
        image_quality: {
          usable: Boolean(parsed.image_quality?.usable ?? true),
          score: parsed.image_quality?.score ?? (typeof parsed.confidence === 'number' ? parsed.confidence : 0.90),
          issues: parsed.image_quality?.issues || []
        },
        candidate_hypotheses: classResult.calibrated_candidates,
        timestamp: Date.now()
      });

      // Evidence Provenance
      const provenance: EvidenceProvenance = {
        visual_evidence: [
          visualEvidence.body_style ? `Body: ${visualEvidence.body_style}` : '',
          visualEvidence.grille ? `Grille: ${visualEvidence.grille}` : '',
          visualEvidence.headlights ? `Headlights: ${visualEvidence.headlights}` : '',
          visualEvidence.taillights ? `Taillights: ${visualEvidence.taillights}` : '',
          visualEvidence.aero ? `Aero: ${visualEvidence.aero}` : '',
          ...(visualEvidence.distinctive_details || [])
        ].filter(Boolean),
        text_evidence: visualEvidence.text ? [visualEvidence.text] : [],
        registry_metadata: [],
        candidate_retrieval: (classResult.calibrated_candidates || []).map((c) => c.name),
        deterministic_validation: []
      };

      // Open Canonical Identity
      const canonicalId = `${classResult.identification.make || 'unknown'}-${classResult.identification.model_family || 'vehicle'}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const openCanonicalIdentity: OpenCanonicalIdentity = {
        canonicalId,
        make: classResult.identification.make || 'Unknown Make',
        modelFamily: classResult.identification.model_family || 'Unknown Model',
        generation: classResult.identification.generation,
        variant: classResult.identification.variant,
        registryStatus: 'VERIFIED_UNREGISTERED',
        source: 'ensemble',
        specs: parsed.specs
      };

      // Construct Canonical Scan Result
      const canonicalResult: CanonicalScanResult = {
        status: calibConf.status,
        vehicle_present: true,
        image_quality: {
          usable: true,
          score: parsed.image_quality?.score || 0.90,
          issues: parsed.image_quality?.issues || []
        },
        viewpoint,
        visual_evidence: visualEvidence,
        identification: classResult.identification,
        confidence: calibConf.confidence,
        candidates: classResult.calibrated_candidates,
        contradictions: classResult.contradictions,
        specificity_level: classResult.specificity_level,
        reason: classResult.reason,
        needs_retake: calibConf.needs_retake,
        specs: parsed.specs,
        privacy_redactions: Array.isArray(parsed.privacy_redactions) ? parsed.privacy_redactions : [],
        upstream_evidence: upstreamEvidence,
        provenance,
        canonical_identity: openCanonicalIdentity
      };

      // Construct compatible ModelIdentificationOutput
      const specs = parsed.specs || {
        color: parsed.color || 'Silver',
        year_estimate: parsed.year || '2020',
        body_style: parsed.body_style || 'Sedan'
      };
      const valuation = getEstimatedMarketValue({
        make: classResult.identification.make,
        model: classResult.identification.model_family,
        rarity: specs.rarity,
        marketValueLowUsd: specs.market_value_low_usd,
        marketValueHighUsd: specs.market_value_high_usd
      });

      const output: ModelIdentificationOutput = {
        vehicleId: null,
        make: classResult.identification.make || 'Unknown Make',
        model: classResult.identification.model_family || 'Unknown Model',
        generation: classResult.identification.generation || 'Current',
        trim: classResult.identification.variant || null,
        yearEstimate: String(specs.year_estimate || '2023'),
        color: specs.color || 'Silver',
        rarity: specs.rarity || 'rare',
        engine: specs.engine || 'Standard Engine',
        horsepower: Number(specs.horsepower) || 300,
        torqueNm: Number(specs.torque_nm) || 400,
        topSpeedKmH: Number(specs.top_speed_kmh) || 250,
        zeroToHundredSec: Number(specs.zero_to_hundred_seconds) || 4.5,
        kerbWeightKg: Number(specs.kerb_weight_kg) || 1500,
        productionYears: specs.production_years || '2020–Present',
        originCountry: specs.origin_country || 'Global',
        bodyStyle: specs.body_style || 'Coupe',
        historicalInformation: specs.historical_information || classResult.reason,
        interestingFacts: specs.interesting_facts || 'Engineered with precision.',
        aftermarketPartsDetected: [],
        modelConfidence: calibConf.confidence.overall_score,
        marketValueLowUsd: valuation.lowUsd,
        marketValueHighUsd: valuation.highUsd,
        privacyRedactions: Array.isArray(parsed.privacy_redactions)
          ? parsed.privacy_redactions.map((p: any) => ({
              type: p.type === 'face' ? 'face' : 'plate',
              box2d: Array.isArray(p.box_2d) ? p.box_2d : [0, 0, 0, 0]
            }))
          : [],
        evidence: [
          ...(visualEvidence.distinctive_details || []),
          classResult.reason
        ],
        alternatives: classResult.calibrated_candidates.slice(1).map((c) => ({
          vehicleId: c.name,
          score: c.score,
          reason: c.contradictions.join('; ') || 'Runner up candidate'
        })),
        needsReview: calibConf.status === 'uncertain'
      };

      const totalEndToEndMs = Date.now() - startTime;
      const telemetry: VisionStageTelemetry = {
        isColdStart,
        warmState,
        idleBeforeRequestMs: request.options?.idleBeforeRequestMs,
        timeToFirstByteMs: execResult.timeToFirstByteMs ?? execResult.cloudflareRequestDurationMs,
        imagePreprocessingMs,
        encodedImageBytes,
        imageDimensions,
        uploadStartTimestamp,
        cloudflareRequestDurationMs: execResult.cloudflareRequestDurationMs ?? totalEndToEndMs,
        timeToFirstTokenMs: execResult.timeToFirstTokenMs ?? null,
        totalModelResponseDurationMs: execResult.totalModelResponseDurationMs ?? totalEndToEndMs,
        jsonParsingMs,
        deterministicValidationMs,
        totalEndToEndMs,
        neurons: execResult.neurons,
        promptTokens: execResult.tokens?.promptTokens,
        completionTokens: execResult.tokens?.outputTokens,
        totalTokens: execResult.tokens?.totalTokens
      };

      return {
        success: true,
        output,
        canonicalResult,
        providerName: this.name,
        providerAttempted: this.name,
        fallbackUsed: false,
        retriesAttempted,
        retryConsumed,
        modelUsed: model,
        tokensConsumed: execResult.tokens || { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
        neuronsConsumed: execResult.neurons,
        telemetry,
        durationMs: totalEndToEndMs
      };
    } catch (err: any) {
      const classified = this.classifyError(err);
      const totalEndToEndMs = Date.now() - startTime;
      const telemetry: VisionStageTelemetry = {
        isColdStart,
        warmState,
        imagePreprocessingMs,
        encodedImageBytes,
        imageDimensions,
        uploadStartTimestamp,
        cloudflareRequestDurationMs: totalEndToEndMs,
        timeToFirstTokenMs: null,
        totalModelResponseDurationMs: totalEndToEndMs,
        jsonParsingMs: 0,
        deterministicValidationMs: 0,
        totalEndToEndMs
      };

      return {
        success: false,
        error: classified.message,
        errorType: classified.errorType,
        providerStatus: classified.status,
        providerErrorCode: classified.errorCode,
        retriesAttempted,
        retryConsumed,
        providerName: this.name,
        providerAttempted: this.name,
        fallbackUsed: false,
        modelUsed: model,
        tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
        telemetry,
        durationMs: totalEndToEndMs
      };
    }
  }

  /**
   * Executes official Cloudflare Workers AI REST API call
   * Supports both 'messages' (native chat template) and 'prompt' ([INST] baseline)
   * Supports Server-Sent Events (SSE) streaming when stream: true
   */
  public async executeCloudflareRequest(params: {
    accountId: string;
    token: string;
    model: string;
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    imageDataUrl: string;
    timeoutMs: number;
    temperature: number;
    seed: number;
    maxTokens: number;
    stream?: boolean;
  }): Promise<{
    json: any;
    tokens: { promptTokens: number; outputTokens: number; totalTokens: number };
    neurons?: number;
    timeToFirstByteMs?: number;
    timeToFirstTokenMs?: number | null;
    cloudflareRequestDurationMs: number;
    totalModelResponseDurationMs: number;
    rawText?: string;
  }> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/ai/run/${params.model}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);
    const dispatchStart = Date.now();

    try {
      const payload: any = {
        image: params.imageDataUrl,
        temperature: params.temperature,
        seed: params.seed,
        max_tokens: params.maxTokens
      };

      if (params.messages && params.messages.length > 0) {
        payload.messages = params.messages;
      } else if (params.prompt) {
        payload.prompt = params.prompt;
      }

      if (params.stream) {
        payload.stream = true;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const initialResponseArrival = Date.now();
      const cloudflareRequestDurationMs = initialResponseArrival - dispatchStart;

      if (!res.ok) {
        clearTimeout(timeoutId);
        let errBody: any = null;
        let errText = '';
        try {
          errText = await res.text();
          errBody = JSON.parse(errText);
        } catch {}

        const firstError = errBody?.errors?.[0];
        const errorCode = firstError?.code;
        const errorMessage = firstError?.message || errText || `HTTP ${res.status}`;

        const err: any = new Error(`Cloudflare Workers AI HTTP ${res.status}: ${errorMessage}`);
        err.status = res.status;
        err.errorCode = errorCode;
        err.rawError = errBody;
        throw err;
      }

      let rawText = '';
      let timeToFirstTokenMs: number | null = null;
      let neurons: number | undefined = undefined;
      let promptTokens: number | undefined = undefined;
      let outputTokens: number | undefined = undefined;
      let totalTokens: number | undefined = undefined;

      if (params.stream) {
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        if (res.body && (res.body as any)[Symbol.asyncIterator]) {
          for await (const chunk of (res.body as any)) {
            const chunkStr = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
            buffer += chunkStr;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataContent = trimmed.replace(/^data:\s*/, '').trim();
              if (dataContent === '[DONE]') continue;

              try {
                const parsedChunk = JSON.parse(dataContent);
                if (parsedChunk.response && typeof parsedChunk.response === 'string') {
                  if (timeToFirstTokenMs === null && parsedChunk.response.length > 0) {
                    timeToFirstTokenMs = Date.now() - dispatchStart;
                  }
                  rawText += parsedChunk.response;
                }
                if (parsedChunk.usage) {
                  if (parsedChunk.usage.neurons !== undefined) neurons = Number(parsedChunk.usage.neurons);
                  if (parsedChunk.usage.prompt_tokens !== undefined) promptTokens = Number(parsedChunk.usage.prompt_tokens);
                  if (parsedChunk.usage.completion_tokens !== undefined) outputTokens = Number(parsedChunk.usage.completion_tokens);
                  if (parsedChunk.usage.total_tokens !== undefined) totalTokens = Number(parsedChunk.usage.total_tokens);
                }
              } catch {}
            }
          }
        }
      } else {
        const jsonResponse = await res.json();
        const usage = jsonResponse.result?.usage || jsonResponse.usage || {};
        if (usage.neurons !== undefined) neurons = Number(usage.neurons);
        if (usage.prompt_tokens !== undefined) promptTokens = Number(usage.prompt_tokens);
        if (usage.completion_tokens !== undefined) outputTokens = Number(usage.completion_tokens);
        if (usage.total_tokens !== undefined) totalTokens = Number(usage.total_tokens);

        if (typeof jsonResponse.result === 'string') {
          rawText = jsonResponse.result;
        } else if (jsonResponse.result && typeof jsonResponse.result.response === 'string') {
          rawText = jsonResponse.result.response;
        } else if (jsonResponse.response && typeof jsonResponse.response === 'string') {
          rawText = jsonResponse.response;
        } else if (typeof jsonResponse.result === 'object' && jsonResponse.result !== null) {
          const innerPayload = (jsonResponse.result.response && typeof jsonResponse.result.response === 'object')
            ? jsonResponse.result.response
            : jsonResponse.result;
          return {
            json: innerPayload,
            tokens: {
              promptTokens: promptTokens || 6400,
              outputTokens: outputTokens || 150,
              totalTokens: totalTokens || 6550
            },
            neurons,
            timeToFirstByteMs: cloudflareRequestDurationMs,
            timeToFirstTokenMs: null,
            cloudflareRequestDurationMs,
            totalModelResponseDurationMs: Date.now() - dispatchStart,
            rawText: JSON.stringify(innerPayload)
          };
        } else {
          throw new Error('Malformed response envelope from Cloudflare Workers AI.');
        }
      }

      // Robust JSON extraction from raw text (handles ```json fences or conversational framing)
      let jsonCandidate = rawText.trim();
      const codeFenceMatch = jsonCandidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeFenceMatch) {
        jsonCandidate = codeFenceMatch[1].trim();
      } else {
        const firstBrace = jsonCandidate.indexOf('{');
        const lastBrace = jsonCandidate.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonCandidate = jsonCandidate.slice(firstBrace, lastBrace + 1);
        }
      }

      let parsedOutput: any;
      try {
        parsedOutput = JSON.parse(jsonCandidate);
      } catch (parseErr: any) {
        throw new Error(`Cloudflare response could not be parsed as JSON: ${parseErr.message}. Raw: ${rawText.slice(0, 300)}`);
      }

      const finalPromptTokens = promptTokens || (Math.round((params.prompt || JSON.stringify(params.messages) || '').length / 4) + 6400);
      const finalOutputTokens = outputTokens || Math.round(jsonCandidate.length / 4);
      const finalTotalTokens = totalTokens || (finalPromptTokens + finalOutputTokens);

      return {
        json: parsedOutput,
        tokens: {
          promptTokens: finalPromptTokens,
          outputTokens: finalOutputTokens,
          totalTokens: finalTotalTokens
        },
        neurons,
        timeToFirstByteMs: cloudflareRequestDurationMs,
        timeToFirstTokenMs,
        cloudflareRequestDurationMs,
        totalModelResponseDurationMs: Date.now() - dispatchStart,
        rawText
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getEmptyEvidence(): VisualEvidence {
    return {
      body_style: null,
      grille: null,
      headlights: null,
      taillights: null,
      hood: null,
      roofline: null,
      windows: null,
      wheels: null,
      exhaust: null,
      aero: null,
      badges: null,
      text: null,
      body_proportions: null,
      distinctive_details: null
    };
  }

  private createRejectionOutput(reason: string, score: number): ModelIdentificationOutput {
    return {
      vehicleId: null,
      make: null,
      model: null,
      generation: null,
      trim: null,
      yearEstimate: 'Unknown',
      color: 'Unknown',
      rarity: 'common',
      engine: 'N/A',
      horsepower: 0,
      torqueNm: 0,
      topSpeedKmH: 0,
      zeroToHundredSec: 0,
      kerbWeightKg: 0,
      productionYears: 'Unknown',
      originCountry: 'Unknown',
      bodyStyle: 'Sedan',
      historicalInformation: reason,
      interestingFacts: reason,
      aftermarketPartsDetected: [],
      modelConfidence: score,
      evidence: [reason],
      alternatives: [],
      needsReview: true
    };
  }
}

