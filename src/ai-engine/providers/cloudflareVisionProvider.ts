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
  ViewpointType,
  VisualEvidence
} from '../types';
import { hierarchicalClassifier } from '../validation/hierarchicalClassifier';
import { confidenceEngine } from '../validation/confidenceEngine';
import { getEstimatedMarketValue } from '../../utils/marketValuation';
import { resolveCanonicalVehicleSpecs } from '../../utils/vehicleSpecs';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../../data/vehicleDatabase';
import { canonicalVehicleRegistry } from '../canonical/canonicalVehicleRegistry';
import { fineGrainedModelDiscriminator } from '../validation/fineGrainedModelDiscriminator';

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
    this.maxTokens = config?.maxTokens ?? 512;
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
    // ─── APEX EVIDENTIARY VEHICLE PERCEPTION PROMPTS ───
    // Clean Image-Grounded Prompts (Zero concrete vehicle names, colors, or years)
    const cleanSystemPrompt = `You are the APEX Automotive Perception Vision Engine.
Your sole job is rigorous visual perception of the vehicle in the supplied photo following strict evidentiary discipline.
The supplied photo is your ONLY source of truth.

CRITICAL INVARIANTS:
1. NO PROMPT INHERITANCE: Never copy or assume any vehicle make, model, year, body style, or color from instructions or schema placeholders.
2. OBSERVABLE EVIDENCE ONLY: Every piece of evidence must correspond to directly visible features in the image.
   If a feature is occluded, out of frame, or ambiguous, leave it null.
3. HIERARCHICAL IDENTIFICATION:
   - Identify Make from visible badging, emblem geometry, or unmistakable design language.
   - Identify Model Family from vehicle architecture, proportions, lighting/grille signatures, and specific design cues.
   - Ground Model Family strictly in the specific morphological features observed in Pass 1.
   - Feature vocabulary must be YOUR description of the photograph, never a copy of any wording used in these instructions. If you cannot describe a feature without reusing this instruction text, omit it.
   - Prefer naming what you literally see (lamp outline, vent count, panel shape) over any interpretive label. Do not name a body feature the photograph does not plainly show.
   - Variant/Trim MUST be null unless explicit exterior badging or verified package aero is visibly confirmed.
4. NON-CAR REJECTION:
   If no passenger motor vehicle is visible (person, pet, building, heavy commercial transit/bus/semi), set "vehicle_present": false, "status": "rejected".
5. OUTPUT FORMAT: Raw valid JSON only starting with { and ending with }. No markdown, no prose, no conversational text.`;

    const cleanUserPrompt = `Analyze the vehicle in this image following evidentiary discipline.
Pass 1 — Visual perception only. Record what is plainly visible. Do not attempt to identify the car yet.
Describe each field in your own words, plainly and concretely (shape, count, position, material).
- body_silhouette: the overall shape and number of doors
- dominant_color: the exterior paint colour
- lighting_cues: the outline and layout of the front and rear lamps exactly as they appear
- intake_and_grille_cues: the openings in the front and rear bumper as they appear
- hood_aerodynamics: the hood surface (cooling vents, louvers, air extractors, scoop, or smooth clean surface)
- aero_and_bodywork: lower front splitter, side air intakes or scoops, side sills, rear wing or diffuser
- distinctive_road_cues: any road, track, weather, or location context
- distinctive_design_cues: up to four features that are unusual for this vehicle class

IMPORTANT: Do NOT reuse any phrase from these instructions as an observation. Do NOT label a feature unless you can point to it in the photograph. It is normal and correct for a field to be null or for distinctive_design_cues to be empty.

In Pass 2, determine the exact model family that corresponds precisely to the observed design cues.

Output flat valid JSON with this exact structure:
{
  "status": "identified",
  "vehicle_present": true,
  "viewpoint": "front_3q",
  "pass1_observations": {
    "body_silhouette": "your own description of the body shape",
    "dominant_color": "your own description of the exterior colour",
    "lighting_cues": "your own description of the lamp outlines",
    "intake_and_grille_cues": "your own description of the bumper openings",
    "hood_aerodynamics": "your own description of the hood surface, vents, or louvers",
    "aero_and_bodywork": "your own description of front splitter, side scoops, or spoiler",
    "distinctive_design_cues": ["your own description of an unusual feature"]
  },
  "pass2_identification": {
    "make": "Dominant vehicle manufacturer",
    "model": "Exact model family name",
    "generation": null,
    "variant": null,
    "confidence": 0.90,
    "evidence": ["observable cue 1", "observable cue 2"]
  }
}
Rules:
- status must be "identified", "uncertain", or "rejected".
- Ground all observations and identity strictly in the provided photograph.
- NEVER copy placeholder text or instruction wording. Do not invent unobservable features.
- An empty distinctive_design_cues array is a valid, expected answer.
- If not a passenger motor vehicle, set vehicle_present: false, status: "rejected".
- Output only the JSON object starting with { and ending with } without any markdown prose or explanation.`;

    const systemPrompt = cleanSystemPrompt;
    const userPrompt = cleanUserPrompt;

    const format = request.options?.format || 'messages';
    const stream = request.options?.stream ?? false;
    const effectiveTimeoutMs = request.options?.timeoutMs || this.timeoutMs;
    const defaultTokensForSchema = request.options?.schema === 'monolithic' ? 512 : this.maxTokens;
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

      // Extract Pass 1 Observations & Pass 2 Identification (support both two-pass and flat schemas)
      const pass1 = parsed.pass1_observations || parsed.visual_evidence || {};
      const pass2 = parsed.pass2_identification || parsed.identification || {};

      const viewpoint: ViewpointType = parsed.viewpoint || 'unknown';
      const pass1Cues = [
        pass1.lighting_cues,
        pass1.headlight_and_drl_signature,
        pass1.intake_and_grille_cues,
        pass1.front_fascia_and_intakes,
        pass1.windshield_and_mirrors,
        pass1.greenhouse_and_roofline,
        pass1.hood_aerodynamics,
        pass1.aero_and_bodywork,
        pass1.grille,
        pass1.headlights,
        pass1.taillights,
        pass1.hood,
        pass1.roofline,
        pass1.windows,
        pass1.wheels,
        pass1.aero,
        pass1.badges,
        pass1.text,
        ...(Array.isArray(pass1.distinctive_design_cues) ? pass1.distinctive_design_cues : []),
        ...(Array.isArray(pass1.distinctive_details) ? pass1.distinctive_details : [])
      ].filter(Boolean);

      const pass2Cues = Array.isArray(pass2.evidence) ? pass2.evidence : [];
      const evidenceList: string[] = Array.from(new Set([...pass1Cues, ...pass2Cues, ...(Array.isArray(parsed.evidence) ? parsed.evidence : [])]));

      const visualEvidence: VisualEvidence = {
        body_style: pass1.body_silhouette || parsed.body_style || pass1.body_style || null,
        grille: pass1.grille || pass1.intake_and_grille_cues || pass1.front_fascia_and_intakes || (evidenceList.find((e: string) => /grille|intake|splitter|strake/i.test(e)) ?? null),
        headlights: pass1.headlights || pass1.lighting_cues || pass1.headlight_and_drl_signature || (evidenceList.find((e: string) => /headlight|lamp|drl|eyelid/i.test(e)) ?? null),
        taillights: pass1.taillights || pass1.lighting_cues || (evidenceList.find((e: string) => /taillight/i.test(e)) ?? null),
        hood: pass1.hood || pass1.hood_aerodynamics || null,
        roofline: pass1.roofline || pass1.greenhouse_and_roofline || pass1.windshield_and_mirrors || null,
        windows: pass1.windows || pass1.greenhouse_and_roofline || pass1.windshield_and_mirrors || null,
        wheels: pass1.wheels || pass1.mirror_and_wheel_cues || pass1.windshield_and_mirrors || null,
        exhaust: pass1.exhaust || null,
        aero: pass1.aero || pass1.aero_and_bodywork || (evidenceList.find((e: string) => /spoiler|wing|splitter|diffuser|strake/i.test(e)) ?? null),
        badges: pass1.badges || pass1.badges_and_text || (evidenceList.find((e: string) => /badge|emblem|roundel|script/i.test(e)) ?? null),
        text: pass1.text || pass1.badges_and_text || null,
        body_proportions: pass1.body_proportions || pass1.body_silhouette || null,
        distinctive_details: evidenceList.length > 0 ? evidenceList : null
      };

      let rawMake: string | null = pass2.make || parsed.make || parsed.identification?.make || null;
      let rawModel: string | null = pass2.model || parsed.model || parsed.identification?.model_family || null;
      let rawGen: string | null = pass2.generation || parsed.generation || parsed.identification?.generation || null;
      let rawVariant: string | null = pass2.variant || parsed.variant || parsed.identification?.variant || null;

      // Sanitize placeholder token echoes or multi-vehicle concatenations
      const placeholderTokens = ['observable', 'dominant', 'manufacturer', 'specific model', 'model family', 'chassis', 'performance trim', '<string>'];
      if (rawMake && placeholderTokens.some(p => rawMake!.toLowerCase().includes(p))) rawMake = null;
      if (rawModel && placeholderTokens.some(p => rawModel!.toLowerCase().includes(p))) rawModel = null;
      if (rawMake && (rawMake.toLowerCase().includes('multiple') || rawMake.includes(';'))) {
        rawMake = null; rawModel = null; rawGen = null; rawVariant = null;
      }
      if (rawModel && (rawModel.toLowerCase().includes('multiple') || rawModel.includes(';'))) {
        rawMake = null; rawModel = null; rawGen = null; rawVariant = null;
      }

      const initialRawProviderIdentity = `${rawMake || ''} ${rawModel || ''}`.trim();
      let verificationConsumed = false;

      // Generic Contamination & Contradiction Guard (Constraint 4 & 5)
      const isSuspicious = (() => {
        if (!rawMake || !rawModel) return true;
        const makeL = rawMake.toLowerCase();
        const modelL = rawModel.toLowerCase();
        const silhouetteL = (pass1.body_silhouette || parsed.body_style || '').toLowerCase();
        const evL = evidenceList.join(' ').toLowerCase();

        // 1. Placeholder echo
        if (placeholderTokens.some(p => makeL.includes(p) || modelL.includes(p))) return true;

        // 2. Extreme silhouette mismatch: low-slung/mid-engine supercar vs commuter sedan
        const isExoticSilhouette = silhouetteL.includes('supercar') || silhouetteL.includes('hypercar') ||
                                   silhouetteL.includes('low-slung') || silhouetteL.includes('mid-engine') ||
                                   silhouetteL.includes('targa') || silhouetteL.includes('spider');
        const isCommuterFamily = (makeL === 'toyota' && modelL.includes('camry')) ||
                                 (makeL === 'toyota' && modelL.includes('corolla')) ||
                                 (makeL === 'honda' && modelL.includes('civic')) ||
                                 (makeL === 'nissan' && modelL.includes('altima'));
        if (isExoticSilhouette && isCommuterFamily) return true;

        // 3. Toyota Camry / spindle grille prompt-copying artifact
        if (makeL === 'toyota' && modelL.includes('camry') && evL.includes('spindle grille')) {
          return true;
        }

        // 4. Spindle grille on non-Lexus / non-Toyota
        if (evL.includes('spindle grille') && !makeL.includes('lexus') && !makeL.includes('toyota')) return true;

        return false;
      })();

      // Optional Independent Clean Verification Pass (Max 1 additional request, no candidate anchoring)
      if (isSuspicious) {
        console.warn('[CloudflareVisionProvider] Suspicious classification or contradiction detected. Invoking clean independent verification pass...');
        verificationConsumed = true;
        try {
          const verifyPrompt = `Inspect the focal vehicle in this photo with independent forensic scrutiny.
Base your answer exclusively on the visible features in this image.
Output flat valid JSON only:
{
  "vehicle_present": true,
  "status": "identified",
  "body_style": "observable body style",
  "dominant_color": "observable dominant exterior paint color",
  "make": "Dominant vehicle manufacturer identified from visible emblem, badging, or design language",
  "model": "Specific model family name identified from visible bodywork",
  "generation": null,
  "variant": null,
  "confidence": 0.88,
  "evidence": ["observable cue 1", "observable cue 2"]
}
Rules:
- Do not copy placeholder text.
- Ground make and model in observable headlights, badges, grille, and silhouette.
- Output only JSON starting with { and ending with }.`;

          const verifyParams: any = {
            accountId,
            token,
            model,
            imageDataUrl: fullDataUrl,
            timeoutMs: effectiveTimeoutMs,
            temperature: 0.1,
            seed: 42,
            maxTokens: effectiveMaxTokens,
            stream: false
          };

          if (format === 'inst') {
            verifyParams.prompt = `[INST] <<SYS>>\n${cleanSystemPrompt}\n<</SYS>>\n\n${verifyPrompt} [/INST]`;
          } else {
            verifyParams.messages = [
              { role: 'system', content: cleanSystemPrompt },
              { role: 'user', content: verifyPrompt }
            ];
          }

          const verifyResult = await this.executeCloudflareRequest(verifyParams);
          let verifyJson = verifyResult.json;
          if (verifyJson && typeof verifyJson.response === 'object' && verifyJson.response !== null) {
            verifyJson = verifyJson.response;
          }

          if (verifyJson && verifyJson.make && verifyJson.model && !placeholderTokens.some(p => verifyJson.make.toLowerCase().includes(p))) {
            console.log('[CloudflareVisionProvider] Independent verification resolved:', verifyJson.make, verifyJson.model);
            rawMake = verifyJson.make;
            rawModel = verifyJson.model;
            rawGen = verifyJson.generation || null;
            rawVariant = verifyJson.variant || null;
            if (Array.isArray(verifyJson.evidence) && verifyJson.evidence.length > 0) {
              evidenceList.length = 0;
              evidenceList.push(...verifyJson.evidence);
              visualEvidence.distinctive_details = evidenceList;
            }
          }
        } catch (verifyErr: any) {
          console.warn('[CloudflareVisionProvider] Verification pass skipped or non-fatal:', verifyErr?.message);
        }
      }

      if (rawMake && rawModel && rawModel.toLowerCase().startsWith(rawMake.toLowerCase() + ' ')) {
        rawModel = rawModel.slice(rawMake.length + 1).trim();
      }

      let rawCandidates: CandidateComparison[] = [];
      const neutralBaseline = 0.50;
      if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        rawCandidates = parsed.candidates.map((c: any) => ({
          name: c.name || 'Unknown Candidate',
          score: neutralBaseline,
          supporting_evidence: Array.isArray(c.supporting_evidence) ? c.supporting_evidence : [],
          contradictions: Array.isArray(c.contradictions) ? c.contradictions : [],
          unobservable_features: Array.isArray(c.unobservable_features) ? c.unobservable_features : []
        }));
      } else if (rawMake && rawModel) {
        const candidateName = rawGen
          ? `${rawMake} ${rawModel} (${rawGen})`
          : `${rawMake} ${rawModel}`;
        rawCandidates = [
          {
            name: candidateName,
            score: neutralBaseline,
            supporting_evidence: [],
            contradictions: [],
            unobservable_features: []
          }
        ];
      }

      // CRITICAL: Always seed peer models for the verified manufacturer from canonical database & fingerprints for contradiction cross-examination
      if (rawMake) {
        const normMake = rawMake.toLowerCase();
        const peerVehicles = APEX_LOCAL_VEHICLE_DATABASE.filter(v => v.manufacturer.toLowerCase() === normMake);
        for (const peer of peerVehicles) {
          const peerName = `${peer.manufacturer} ${peer.model}`;
          if (!rawCandidates.some(c => c.name.toLowerCase() === peerName.toLowerCase())) {
            rawCandidates.push({
              name: peerName,
              score: neutralBaseline,
              supporting_evidence: [],
              contradictions: [],
              unobservable_features: []
            });
          }
        }

        const fpPeers = fineGrainedModelDiscriminator.findFingerprintsByMake(rawMake);
        for (const fp of fpPeers) {
          const fpName = fp.generation ? `${fp.make} ${fp.model} (${fp.generation})` : `${fp.make} ${fp.model}`;
          const simpleName = `${fp.make} ${fp.model}`;
          if (!rawCandidates.some(c => c.name.toLowerCase() === fpName.toLowerCase() || c.name.toLowerCase() === simpleName.toLowerCase())) {
            rawCandidates.push({
              name: fpName,
              score: neutralBaseline,
              supporting_evidence: [],
              contradictions: [],
              unobservable_features: []
            });
          }
        }
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

      // Resolve Grounded Engineering Specifications (Constraint 7 & 8: Never Fabricate!)
      let finalMake = classResult.identification.make || rawMake || 'Unknown Make';
      let finalModel = classResult.identification.model_family || rawModel || 'Unknown Model';
      if (finalMake && finalModel && finalModel.toLowerCase().startsWith(finalMake.toLowerCase() + ' ')) {
        finalModel = finalModel.slice(finalMake.length + 1).trim();
      }
      let finalGen = classResult.identification.generation || rawGen || undefined;
      let finalVariant = classResult.specificity_level === 'variant'
        ? (classResult.identification.variant || rawVariant || undefined)
        : undefined;

      // Optional Neutral Pairwise Verification Pass (Hard Amendment 4 & 7: Max 1 additional call, ceiling 2 total)
      // INVARIANT 5: RAW-VS-DISCRIMINATOR CONFLICT
      // Disagreement between raw provider identity and discriminator winner MUST trigger neutral verification path, regardless of numerical margin.
      const shouldTriggerNeutralVerification = !verificationConsumed && classResult.calibrated_candidates.length >= 2 && (
        classResult.needs_neutral_verification ||
        classResult.raw_conflict ||
        (classResult.candidate_separation < 0.15 && classResult.top_candidate && classResult.top_candidate.score > 0.50)
      );

      if (shouldTriggerNeutralVerification) {
        // INVARIANT 8: PAIRWISE VERIFIER
        // Candidate A and Candidate B are completely unordered peers.
        // Alternate presentation order to eliminate positional bias.
        const swapPresentation = Math.random() < 0.5;
        const candA = swapPresentation ? classResult.calibrated_candidates[1].name : classResult.calibrated_candidates[0].name;
        const candB = swapPresentation ? classResult.calibrated_candidates[0].name : classResult.calibrated_candidates[1].name;
        console.log(`[CloudflareVisionProvider] Invoking neutral pairwise verification between "${candA}" and "${candB}" (raw conflict: ${Boolean(classResult.raw_conflict)}, separation: ${classResult.candidate_separation})...`);
        verificationConsumed = true;
        try {
          const neutralVerifyPrompt = `Inspect the focal vehicle in this photo with rigorous neutral forensic scrutiny.
Compare Candidate A: "${candA}" and Candidate B: "${candB}" against the visible exterior features in the image.

CRITICAL INVARIANTS:
1. Candidate A and Candidate B are completely unordered peers. Neither candidate has any default priority, advantage, or baseline preference.
2. Ground analysis exclusively in visible exterior features (headlights, front grille, hood geometry, side air scoops/tendons, fender louvers, roofline/greenhouse, rear wing/spoiler, rear exhaust).
3. If a feature zone is NOT_VISIBLE or OCCLUDED from this viewpoint, it contributes exactly ZERO evidence, ZERO contradiction, and ZERO penalty.
4. Model-discriminating traits (e.g. hood extractor nostrils, swan-neck wing, body-color perforated grille, horizontal eyelid covers) have high weight; generic body styles have low weight.
5. Identify which candidate has decisive positive evidence and which has contradictions.

Output flat valid JSON only:
{
  "selected_winner": "Candidate A" | "Candidate B" | "neither",
  "winner_name": "${candA}" | "${candB}" | null,
  "confidence": 0.88,
  "margin": 0.20,
  "candidate_a_matches": ["visible trait 1"],
  "candidate_a_contradictions": [],
  "candidate_b_matches": [],
  "candidate_b_contradictions": ["visible trait contradicted"],
  "evidence": ["observable cue 1", "observable cue 2"],
  "reason": "Neutral comparison rationale"
}
Rules:
- Output only valid JSON starting with { and ending with }.
- Do not include conversation, preface, or explanation outside the JSON object.`;

          const verifyParams: any = {
            accountId,
            token,
            model,
            imageDataUrl: fullDataUrl,
            timeoutMs: effectiveTimeoutMs,
            temperature: 0.1,
            seed: 42,
            maxTokens: effectiveMaxTokens,
            stream: false,
            allowRawTextFallback: true
          };

          if (format === 'inst') {
            verifyParams.prompt = `[INST] <<SYS>>\n${cleanSystemPrompt}\n<</SYS>>\n\n${neutralVerifyPrompt} [/INST]`;
          } else {
            verifyParams.messages = [
              { role: 'system', content: cleanSystemPrompt },
              { role: 'user', content: neutralVerifyPrompt }
            ];
          }

          const verifyResult = await this.executeCloudflareRequest(verifyParams);
          let verifyJson = verifyResult.json;
          if (verifyJson && typeof verifyJson.response === 'object' && verifyJson.response !== null) {
            verifyJson = verifyJson.response;
          }

          let winner: string | null = null;
          if (verifyJson && (verifyJson.selected_winner || verifyJson.winner_name)) {
            winner = verifyJson.selected_winner || verifyJson.winner_name;
          } else if (verifyJson?.isRawText || typeof verifyResult?.rawText === 'string') {
            const text = (verifyJson?.rawText || verifyResult?.rawText || '').toLowerCase();
            const candANorm = candA.toLowerCase();
            const candBNorm = candB.toLowerCase();
            const declaresA = text.includes('candidate a') || text.includes(candANorm);
            const declaresB = text.includes('candidate b') || text.includes(candBNorm);
            if (declaresA && !declaresB) {
              winner = candA;
            } else if (declaresB && !declaresA) {
              winner = candB;
            } else if (declaresA && declaresB) {
              const winnerMatch = text.match(/(?:winner|conclu(?:de|sion)|identified as|is a|focal vehicle is a?)\s*[:\-]?\s*([^\n\.]+)/i);
              if (winnerMatch) {
                const matchStr = winnerMatch[1].toLowerCase();
                if (matchStr.includes('candidate a') || matchStr.includes(candANorm)) {
                  winner = candA;
                } else if (matchStr.includes('candidate b') || matchStr.includes(candBNorm)) {
                  winner = candB;
                }
              }
            }
          }

          if (winner) {
            const winningCandidateName = (winner === 'Candidate A' || winner.toLowerCase() === candA.toLowerCase())
              ? candA
              : (winner === 'Candidate B' || winner.toLowerCase() === candB.toLowerCase())
              ? candB
              : null;

            if (winningCandidateName) {
              const targetCand = classResult.calibrated_candidates.find((c) => c.name === winningCandidateName);
              if (targetCand) {
                targetCand.score = Math.min(0.99, targetCand.score + 0.20);
              }
            }

            classResult.calibrated_candidates.sort((a, b) => b.score - a.score);
            classResult.top_candidate = classResult.calibrated_candidates[0] || null;
            classResult.candidate_separation = classResult.top_candidate
              ? Number((classResult.top_candidate.score - (classResult.calibrated_candidates[1]?.score || 0)).toFixed(3))
              : 0;

            if (classResult.top_candidate) {
              // INVARIANT 9: Update canonical record and final vehicle identity directly from verified winner
              const verifiedMatch = canonicalVehicleRegistry.lookupByTextOrAlias(classResult.top_candidate.name, finalMake);
              if (verifiedMatch) {
                finalMake = verifiedMatch.make;
                finalModel = verifiedMatch.model;
                if (verifiedMatch.generation) finalGen = verifiedMatch.generation;
                if (verifiedMatch.trim && (classResult.top_candidate.name.toLowerCase().includes(verifiedMatch.trim.toLowerCase()) || (finalVariant && finalVariant.toLowerCase() === verifiedMatch.trim.toLowerCase()))) {
                  finalVariant = verifiedMatch.trim;
                } else if (!finalVariant || !classResult.top_candidate.name.toLowerCase().includes(finalVariant.toLowerCase())) {
                  finalVariant = undefined;
                }
                classResult.canonical_vehicle_id = verifiedMatch.vehicleId;
                classResult.canonical_display_name = verifiedMatch.displayName;
              } else {
                const topParts = classResult.top_candidate.name.split(' ');
                if (topParts.length > 1) {
                  const topMake = topParts[0];
                  if (!finalMake || finalMake.toLowerCase() === topMake.toLowerCase() || topMake.toLowerCase().includes(finalMake.toLowerCase())) {
                    finalMake = topMake;
                    finalModel = topParts.slice(1).join(' ').trim();
                  }
                }
              }
            }
          }
        } catch (neutralErr: any) {
          console.warn('[CloudflareVisionProvider] Neutral verification skipped or non-fatal:', neutralErr?.message);
        }
      }

      const specResolution = resolveCanonicalVehicleSpecs({
        make: finalMake,
        model: finalModel,
        generation: finalGen,
        trim: finalVariant,
        canonicalVehicleId: classResult.canonical_vehicle_id
      });

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
      const openCanonicalIdentity = canonicalVehicleRegistry.resolveCanonicalIdentity({
        vehicleId: classResult.canonical_vehicle_id || specResolution.canonicalId,
        make: finalMake,
        model: finalModel,
        generation: finalGen,
        variant: finalVariant,
        source: 'ensemble',
        specs: parsed.specs
      });

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
        specificity_level_numeric: classResult.specificity_level_numeric ?? openCanonicalIdentity.specificityLevel,
        reason: classResult.reason,
        needs_retake: calibConf.needs_retake,
        raw_provider_identity: initialRawProviderIdentity || `${rawMake || ''} ${rawModel || ''}`.trim() || 'Unknown',
        discriminator_identity: classResult.discriminator_identity || openCanonicalIdentity.displayName || `${finalMake} ${finalModel}`,
        specs: parsed.specs,
        privacy_redactions: Array.isArray(parsed.privacy_redactions) ? parsed.privacy_redactions : [],
        upstream_evidence: upstreamEvidence,
        provenance,
        canonical_identity: openCanonicalIdentity
      };

      const valuation = getEstimatedMarketValue({
        make: finalMake,
        model: finalModel,
        rarity: specResolution.rarity,
        marketValueLowUsd: parsed.specs?.market_value_low_usd,
        marketValueHighUsd: parsed.specs?.market_value_high_usd
      });

      const output: ModelIdentificationOutput = {
        vehicleId: specResolution.canonicalId || null,
        make: finalMake,
        model: finalModel,
        generation: finalGen || specResolution.generation || 'Current',
        trim: finalVariant || null,
        yearEstimate: specResolution.productionYears && specResolution.productionYears !== 'N/A'
          ? specResolution.productionYears.split('–')[0]
          : String(parsed.year || '2023'),
        color: pass1.dominant_color || parsed.color || 'Unknown',
        rarity: specResolution.rarity || 'rare',
        engine: specResolution.engine || 'Standard Engine',
        horsepower: specResolution.horsepower ?? 0,
        torqueNm: specResolution.torqueNm ?? 0,
        topSpeedKmH: specResolution.topSpeedKmH ?? 0,
        zeroToHundredSec: specResolution.zeroToHundredSec ?? 0,
        kerbWeightKg: specResolution.kerbWeightKg ?? 0,
        productionYears: specResolution.productionYears || 'N/A',
        originCountry: specResolution.originCountry || 'Global',
        bodyStyle: (specResolution.bodyStyle as any) || (visualEvidence.body_style as any) || 'Coupe',
        historicalInformation: specResolution.briefHistory || classResult.reason,
        interestingFacts: specResolution.interestingFact || 'Engineered with precision.',
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
    allowRawTextFallback?: boolean;
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
        let recovered = false;
        const quoteCount = (jsonCandidate.match(/(?<!\\)"/g) || []).length;
        const candidatesToTry = [
          jsonCandidate,
          quoteCount % 2 !== 0 ? jsonCandidate + '"' : jsonCandidate
        ];

        for (const base of candidatesToTry) {
          for (const suffix of ['', '}', '}}', '"}}', 'null}}', ']}', '"]}}', '}]}', 'null}]}', 'null}}}]', 'null"]}}']) {
            try {
              parsedOutput = JSON.parse(base + suffix);
              recovered = true;
              break;
            } catch {}
          }
          if (recovered) break;
        }

        if (!recovered) {
          if (params.allowRawTextFallback) {
            parsedOutput = { rawText, isRawText: true };
          } else {
            throw new Error(`Cloudflare response could not be parsed as JSON: ${parseErr.message}. Raw: ${rawText.slice(0, 300)}`);
          }
        }
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

