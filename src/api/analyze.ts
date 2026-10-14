/**
 * MANDATORY COST TRANSPARENCY STATEMENT:
 * "One user action can cause at most 2 expensive operations."
 * - Expected operation count: Normal user path executes 0-1 VLM operations (Stage B retrieval cache or 1 adjudication call).
 * - Worst-case operation count: Degraded network or adversarial deadlock triggers at most 2 VLM operations.
 * - Failure behavior: Degrades gracefully to Stage B gallery retrieval or returns HTTP 429 / 503 maintenance response.
 * - Rollback strategy: Flag AI_PIPELINE=v1 or emergency kill switches (VISION_SCANNING_ENABLED=false, CLOUDFLARE_SCANNING_ENABLED=false, GEMINI_SCANNING_ENABLED=false).
 * - Regression test: scripts/test_acceptance_infrastructure.ts, test_production_regression_suite.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { apexEngine } from '../ai-engine/engine';
import { VISION_PIPELINE_VERSION } from '../ai-engine/caching/identificationCache';
import { canonicalVehicleRegistry } from '../ai-engine/canonical/canonicalVehicleRegistry';
import { pipelineConfig } from '../ai-engine/config/pipelineConfig';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

// ── Image-Hash Cache (Prevents duplicate expensive VLM calls on identical images) ──
interface CachedScanEntry {
  responsePayload: any;
  timestamp: number;
}
const scanResultImageCache = new Map<string, CachedScanEntry>();

// ── Global Daily Free-Tier Budget Tracking ──
let freeTierGlobalDailyCounter = 0;
let freeTierGlobalResetDay = new Date().getUTCDate();

function checkAndConsumeFreeTierGlobalBudget(): boolean {
  const currentDay = new Date().getUTCDate();
  if (currentDay !== freeTierGlobalResetDay) {
    freeTierGlobalDailyCounter = 0;
    freeTierGlobalResetDay = currentDay;
  }
  const maxBudget = pipelineConfig.freeTierBudgets.globalDailyScanBudget;
  if (freeTierGlobalDailyCounter >= maxBudget) {
    return false;
  }
  freeTierGlobalDailyCounter++;
  return true;
}

// Server-side Supabase client for distributed rate limiting
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Server-Side Multi-Tier Rate Limiting Configuration
export const RATE_LIMITS = {
  PER_MINUTE: { max: 30, windowSec: 60, name: 'minute' },
  PER_HOUR: { max: 120, windowSec: 3600, name: 'hour' },
  PER_DAY: { max: 300, windowSec: 86400, name: 'day' },
  GLOBAL_DAILY_BUDGET: { max: 5000, windowSec: 86400, name: 'global_daily' }
} as const;

interface RateLimitWindow {
  count: number;
  expiresAt: number;
}

const rateLimitMap = new Map<string, RateLimitWindow>();

// Prune expired entries periodically
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.expiresAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref?.();
}

function isRateLimitedInMemory(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(identifier, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetSeconds: Math.ceil(windowMs / 1000) };
  }

  const resetSeconds = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetSeconds };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count, resetSeconds };
}

async function checkSingleTier(
  identifier: string,
  maxRequests: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('check_and_consume_rate_limit', {
        p_identifier: identifier,
        p_max_requests: maxRequests,
        p_window_seconds: windowSec
      });

      if (!error && data && typeof data.allowed === 'boolean') {
        return {
          allowed: data.allowed,
          remaining: Number(data.remaining ?? 0),
          resetSeconds: Number(data.reset_seconds ?? windowSec)
        };
      }
    } catch (e) {
      console.warn('PostgreSQL rate limit check failed, falling back to in-memory:', e);
    }
  }

  return isRateLimitedInMemory(identifier, maxRequests, windowSec * 1000);
}

async function checkGlobalVisionBudgetAtomic(): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const budget = RATE_LIMITS.GLOBAL_DAILY_BUDGET;
  const identifier = `global_budget:${budget.name}`;

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('check_and_consume_rate_limit', {
        p_identifier: identifier,
        p_max_requests: budget.max,
        p_window_seconds: budget.windowSec
      });

      if (!error && data && typeof data.allowed === 'boolean') {
        return {
          allowed: data.allowed,
          remaining: Number(data.remaining ?? 0),
          resetSeconds: Number(data.reset_seconds ?? budget.windowSec)
        };
      }
      if (error) {
        console.warn('[api/analyze] Supabase global budget RPC error:', error.message);
      }
    } catch (err: any) {
      console.warn('[api/analyze] Supabase global budget exception:', err?.message);
    }
  }

  return isRateLimitedInMemory(identifier, budget.max, budget.windowSec * 1000);
}

async function checkRateLimit(
  identifier: string,
  isGuest: boolean
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number; tierExceeded?: string }> {
  // 1. ATOMIC GLOBAL DAILY VISION BUDGET (Must be enforced first for guest requests)
  if (isGuest) {
    const budgetCheck = await checkGlobalVisionBudgetAtomic();
    if (!budgetCheck.allowed) {
      return {
        ...budgetCheck,
        tierExceeded: 'global_daily_budget'
      };
    }
  }

  // 2. ATOMIC SLIDING-WINDOW PER-IP / PER-USER TIERS
  const tiers = [
    RATE_LIMITS.PER_MINUTE,
    RATE_LIMITS.PER_HOUR,
    RATE_LIMITS.PER_DAY
  ];

  for (const tier of tiers) {
    const tierIdentifier = `${identifier}:${tier.name}`;
    const check = await checkSingleTier(tierIdentifier, tier.max, tier.windowSec);
    if (!check.allowed) {
      return {
        ...check,
        tierExceeded: tier.name
      };
    }
  }

  // If all tiers pass, report minute tier remaining
  const minuteKey = `${identifier}:${RATE_LIMITS.PER_MINUTE.name}`;
  const minuteRecord = rateLimitMap.get(minuteKey);
  const remaining = minuteRecord ? Math.max(0, RATE_LIMITS.PER_MINUTE.max - minuteRecord.count) : RATE_LIMITS.PER_MINUTE.max;

  return { allowed: true, remaining, resetSeconds: 60 };
}

// ── Explicit CORS Origins Allowlist ──
const ALLOWED_ORIGINS = new Set([
  'https://apex-spotter.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:4173'
]);

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const rawOrigin = req.headers.origin as string | undefined;
  const origin = typeof rawOrigin === 'string' ? rawOrigin.trim() : undefined;
  console.log(`[api/analyze] CORS incoming: Origin="${origin ?? '<none>'}", Method="${req.method}", UserAgent="${req.headers['user-agent'] ?? '<none>'}"`);

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Native mobile HTTP bridge or direct service call
    res.setHeader('Access-Control-Allow-Origin', 'https://apex-spotter.vercel.app');
  } else {
    console.warn(`[api/analyze] CORS disallowed origin: "${origin}"`);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getTrustedClientIp(req: VercelRequest): string {
  // Trust proxy headers injected by Vercel edge runtime (cannot be spoofed from client)
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim()) {
    return vercelForwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || (req as any)?.connection?.remoteAddress || '127.0.0.1';
}

function formatScanResponse(r: any) {
  const v2 = r.v2Result;
  const canon = r.canonicalResult;

  const resolvedStatus: string = v2
    ? v2.status
    : canon?.status || (r.status === 'abstained' ? 'rejected' : r.status === 'uncertain' ? 'uncertain' : 'identified');

  const isNotInCatalogue = resolvedStatus === 'not_in_catalogue';
  const isModelExplicitlyUncertain =
    resolvedStatus === 'uncertain' ||
    resolvedStatus === 'rejected' ||
    resolvedStatus === 'invalid_image' ||
    resolvedStatus === 'provider_error' ||
    resolvedStatus === 'retrieval_unavailable' ||
    resolvedStatus === 'invalid_provider_response' ||
    canon?.specificity_level === 'make';

  const modelCandidate = v2?.model || canon?.identification?.model_family || canon?.canonical_identity?.modelFamily || r.model;
  const isModelUncertain = isNotInCatalogue
    ? false
    : (isModelExplicitlyUncertain || (!modelCandidate || String(modelCandidate).trim().toLowerCase() === 'unknown model' || String(modelCandidate).trim().toLowerCase() === 'null'));

  const finalMake = v2?.make || canon?.identification?.make || canon?.canonical_identity?.make || r.make || 'Unknown Make';
  const finalModel = isModelUncertain ? null : (v2?.model || modelCandidate || null);
  const finalGen = isModelUncertain ? null : (v2?.generation || canon?.identification?.generation || canon?.canonical_identity?.generation || r.generation || null);
  const finalTrim = isModelUncertain ? null : (v2?.variant || canon?.identification?.variant || canon?.canonical_identity?.variant || (r.trim || null));

  // Resolve canonical record ONLY if model is identified and not in catalogue limbo
  let finalCanonId = (isModelUncertain || isNotInCatalogue)
    ? null
    : (v2?.canonicalVehicleId || canon?.canonical_identity?.canonicalId || (canon as any)?.canonical_vehicle_id || r.vehicleId || null);

  let canonRecord = finalCanonId ? canonicalVehicleRegistry.getById(finalCanonId) : null;
  if (!canonRecord && !isModelUncertain && !isNotInCatalogue && finalMake && finalModel) {
    canonRecord = canonicalVehicleRegistry.lookupByTextOrAlias(`${finalMake} ${finalModel}`, finalMake);
    if (canonRecord) {
      finalCanonId = canonRecord.vehicleId;
    }
  }

  const inCatalogue = isNotInCatalogue
    ? false
    : (v2
      ? Boolean(v2.inCatalogue ?? (v2.status === 'identified' || v2.status === 'identified_model'))
      : Boolean(canon?.status === 'identified' && finalCanonId));

  const collectibleEligible = Boolean(
    inCatalogue &&
    (resolvedStatus === 'identified' || resolvedStatus === 'identified_model' || resolvedStatus === 'probable') &&
    finalCanonId &&
    !isModelExplicitlyUncertain
  );

  const finalDisplayName = isNotInCatalogue
    ? (v2?.displayName || (finalModel ? `${finalMake} ${finalModel}` : finalMake))
    : isModelUncertain
    ? finalMake
    : (v2?.displayName || canon?.canonical_identity?.displayName || canonRecord?.displayName || `${finalMake} ${finalModel}${finalGen ? ` (${finalGen})` : ''}`);

  const isCar = (resolvedStatus !== 'rejected' && resolvedStatus !== 'invalid_image' && r.status !== 'abstained');

  // Clamp confidence numbers to [0.0, 1.0] and ensure finite values
  const safeTotalScore = Number.isFinite(r.confidence?.totalScore) ? Math.max(0, Math.min(1, r.confidence.totalScore)) : 0.95;

  return {
    // ── Canonical Production Vision Contract ──
    status: resolvedStatus,
    in_catalogue: inCatalogue,
    collectible_eligible: collectibleEligible,
    vehicle_present: isCar,
    is_car: isCar,
    image_quality: canon?.image_quality || {
      usable: r.quality?.isUsable ?? true,
      score: r.quality?.blurScore || 0.9,
      issues: r.quality?.rejectionReason ? [r.quality.rejectionReason] : []
    },
    viewpoint: canon?.viewpoint || r.quality?.viewpoint || 'unknown',
    visual_evidence: canon?.visual_evidence || {
      body_style: r.bodyStyle,
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
    },
    identification: {
      make: finalMake,
      model_family: finalModel,
      generation: finalGen,
      variant: finalTrim
    },
    confidence: {
      ...(canon?.confidence || {
        make_score: safeTotalScore,
        model_score: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.2 : safeTotalScore,
        generation_score: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.1 : Number((safeTotalScore * 0.85).toFixed(3)),
        variant_score: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.0 : (r.trim ? Number((safeTotalScore * 0.75).toFixed(3)) : 0.2),
        overall_score: safeTotalScore
      }),
      abstentionReason: r.confidence?.abstentionReason || canon?.confidence?.abstentionReason || null
    },
    candidates: canon?.candidates || (r.topCandidates || []).map((c: any) => ({
      name: `${c.make} ${c.model}`,
      score: Number.isFinite(c.visualSimilarityScore) ? Math.max(0, Math.min(1, c.visualSimilarityScore)) : 0,
      supporting_evidence: c.distinguishingFeatures,
      contradictions: []
    })),
    contradictions: canon?.contradictions || [],
    specificity_level: isModelUncertain ? 'make' : (canon?.specificity_level || (r.trim ? 'variant' : 'model_family')),
    reason: isNotInCatalogue
      ? `Spotted ${finalDisplayName}! This vehicle is not currently in Apex's launch collectible catalogue.`
      : (canon?.reason || (r.confidence?.abstentionReason || 'Vehicle successfully identified.')),
    needs_retake: canon ? canon.needs_retake : (r.confidence?.shouldAbstain ?? (resolvedStatus === 'uncertain' || resolvedStatus === 'needs_more_views')),

    // ── Card & Client Specifications ──
    scan_id: r.scanId,
    make: finalMake,
    model: finalModel,
    generation: finalGen,
    trim: finalTrim,
    canonical_display_name: finalDisplayName,
    canonical_vehicle_id: collectibleEligible ? finalCanonId : null,
    specificity_level_numeric: (isModelUncertain || isNotInCatalogue) ? 0 : (canon?.specificity_level_numeric ?? canon?.canonical_identity?.specificityLevel ?? (canonRecord?.specificityLevel || 1)),
    year_estimate: (isModelUncertain || isNotInCatalogue) ? 'Unknown' : (r.yearEstimate || (canonRecord ? `${canonRecord.yearStart}` : 'Unknown')),
    color: r.color,
    rarity: (isModelUncertain || isNotInCatalogue) ? 'common' : (v2?.verifiedSpecs?.baselineRarity || r.rarity || canonRecord?.baselineRarity || 'rare'),
    engine: (isModelUncertain || isNotInCatalogue) ? 'Standard Engine' : (v2?.verifiedSpecs?.engine || r.engine || canonRecord?.engine || 'Standard Engine'),
    horsepower: (isModelUncertain || isNotInCatalogue) ? 0 : (v2?.verifiedSpecs?.horsepower || r.horsepower || canon?.canonical_identity?.specs?.horsepower || canonRecord?.horsepower || 0),
    torque_nm: (isModelUncertain || isNotInCatalogue) ? 0 : (v2?.verifiedSpecs?.torqueNm || r.torqueNm || canon?.canonical_identity?.specs?.torqueNm || canonRecord?.torqueNm || 0),
    top_speed_kmh: (isModelUncertain || isNotInCatalogue) ? 0 : (v2?.verifiedSpecs?.topSpeedKmH || r.topSpeedKmH || canon?.canonical_identity?.specs?.topSpeedKmH || canonRecord?.topSpeedKmH || 0),
    zero_to_hundred_seconds: (isModelUncertain || isNotInCatalogue) ? 0 : (v2?.verifiedSpecs?.zeroToHundredSec || r.zeroToHundredSec || canon?.canonical_identity?.specs?.zeroToHundredSec || canonRecord?.zeroToHundredSec || 0),
    kerb_weight_kg: (isModelUncertain || isNotInCatalogue) ? 0 : (v2?.verifiedSpecs?.kerbWeightKg || r.kerbWeightKg || canon?.canonical_identity?.specs?.kerbWeightKg || canonRecord?.kerbWeightKg || 0),
    production_years: (isModelUncertain || isNotInCatalogue) ? 'Unknown' : (v2?.verifiedSpecs?.productionYears || r.productionYears || canonRecord?.productionYears || 'Unknown'),
    origin_country: (isModelUncertain || isNotInCatalogue) ? 'Global' : (v2?.verifiedSpecs?.originCountry || r.originCountry || canonRecord?.originCountry || 'Global'),
    body_style: r.bodyStyle || v2?.verifiedSpecs?.bodyStyle || canonRecord?.bodyStyle,
    historical_information: (isModelUncertain || isNotInCatalogue) ? '' : (r.historicalInformation || canonRecord?.historicalInformation || ''),
    interesting_facts: (isModelUncertain || isNotInCatalogue) ? '' : (r.interestingFacts || canonRecord?.notableFacts || ''),
    aftermarket_parts_detected: r.aftermarketPartsDetected,
    legacy_confidence: safeTotalScore,
    needs_better_angle: canon ? (canon.status === 'uncertain' || canon.needs_retake) : (r.confidence?.shouldAbstain ?? (resolvedStatus === 'uncertain' || resolvedStatus === 'needs_more_views')),
    angle_instruction: (r.confidence?.abstentionReason === 'VISION_QUOTA_EXHAUSTED' || canon?.confidence?.abstentionReason === 'VISION_QUOTA_EXHAUSTED' || canon?.reason?.includes('VISION_QUOTA_EXHAUSTED'))
      ? 'Vehicle identification temporarily unavailable. Vision quota has been reached. Please try again later.'
      : (canon?.reason || r.confidence?.abstentionReason || null),
    upstream_evidence: canon?.upstream_evidence,
    canonical_identity: (isModelUncertain || isNotInCatalogue)
      ? (canon?.canonical_identity ? {
          ...canon.canonical_identity,
          canonicalId: null,
          modelFamily: null,
          generation: null,
          variant: null,
          displayName: finalDisplayName,
          specificityLevel: 0
        } : null)
      : (canon?.canonical_identity ? {
          ...canon.canonical_identity,
          canonicalId: finalCanonId,
          modelFamily: finalModel,
          generation: finalGen,
          variant: finalTrim,
          displayName: finalDisplayName
        } : null),
    provenance: canon?.provenance,
    cached: r.cached,
    trace_id: r.traceId,
    analysisVersion: VISION_PIPELINE_VERSION,
    providerRevision: (process.env.VISION_PROVIDER || 'cloudflare').toLowerCase().trim(),

    // ── V2 Additive Fields (Backward-compatible additions for v2 UI / clients) ──
    status_v2: resolvedStatus,
    calibrated_confidence: v2?.calibratedConfidence || {
      make: safeTotalScore,
      model: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.30 : safeTotalScore,
      generation: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.20 : 0.85,
      variant: (isModelExplicitlyUncertain || isNotInCatalogue) ? 0.00 : 0.75,
      overall: safeTotalScore
    },
    guided_recovery: v2?.guidedRecovery || null,
    candidate_options: v2?.candidateOptions || (r.topCandidates || []).map((c: any) => ({
      canonicalId: c.canonicalVehicleId || null,
      displayName: c.model || `${c.make} ${c.model}`,
      variant: c.variant || null,
      confidenceScore: Number.isFinite(c.visualSimilarityScore) ? Math.max(0, Math.min(1, c.visualSimilarityScore)) : 0.8,
      distinguishingFeatures: c.distinguishingFeatures || []
    })),
    session_frame_count: v2?.sessionFrameCount || 1,
    pipeline_mode: process.env.AI_PIPELINE || 'v1'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 0. Enable CORS with explicit origin allowlist
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Enforce POST Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  // Safe Diagnostic Logging (Never log token or secret values)
  console.log('[api/analyze] Diagnostics:', {
    provider: (process.env.VISION_PROVIDER || 'cloudflare').toLowerCase().trim(),
    cloudflareAccountConfigured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
    cloudflareTokenConfigured: Boolean(process.env.CLOUDFLARE_AUTH_TOKEN),
    scanningEnabled: process.env.CLOUDFLARE_SCANNING_ENABLED !== 'false',
    visionScanningEnabled: process.env.VISION_SCANNING_ENABLED !== 'false',
    allowMockFallback: process.env.ALLOW_MOCK_FALLBACK === 'true'
  });

  // 1.1 Server-Side Provider Validation & Emergency AI Kill Switch
  const rawProvider = (process.env.VISION_PROVIDER || 'cloudflare').toLowerCase().trim();
  if (rawProvider !== 'cloudflare' && rawProvider !== 'gemini') {
    return res.status(500).json({
      error: `Server misconfiguration: Invalid VISION_PROVIDER="${rawProvider}". Supported values are "cloudflare" or "gemini". Application fails closed.`
    });
  }

  const isCloudflare = rawProvider === 'cloudflare';
  const isKilled = process.env.VISION_SCANNING_ENABLED === 'false' ||
    (isCloudflare ? process.env.CLOUDFLARE_SCANNING_ENABLED === 'false' : process.env.GEMINI_SCANNING_ENABLED === 'false');

  if (isKilled) {
    return res.status(503).json({
      error: 'AI Vehicle Scanning is temporarily paused for maintenance. Please try again shortly.',
      maintenance: true
    });
  }

  // 2. Client Authentication via Supabase Bearer JWT Token
  let authenticatedUserId: string | null = null;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token && supabase) {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (user && !authErr) {
        authenticatedUserId = user.id;
      } else if (authErr) {
        console.warn('[api/analyze] Bearer token validation failed:', authErr.message);
        return res.status(401).json({
          error: 'Authentication session expired or invalid. Please refresh session.',
          code: 'AUTH_SESSION_EXPIRED'
        });
      }
    } catch (e: any) {
      console.warn('[api/analyze] Auth token verification error:', e?.message);
      return res.status(401).json({
        error: 'Authentication session verification failed.',
        code: 'AUTH_SESSION_EXPIRED'
      });
    }
  }

  const isGuest = !authenticatedUserId;
  const clientIp = getTrustedClientIp(req);
  const { imageBase64, mimeType, fileName, userId: clientUserId, idempotencyKey } = req.body || {};

  console.log('[BACKEND] analyze_request_received', {
    mimeType: mimeType || 'image/jpeg',
    payloadLength: imageBase64?.length ?? 0,
    hasIdempotencyKey: Boolean(idempotencyKey),
    clientIp
  });

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    console.warn('[BACKEND] image_decode_failure: Missing or non-string base64 data');
    return res.status(400).json({ error: 'Invalid payload: Missing base64 image data.' });
  }

  const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  if (!rawBase64 || rawBase64.length < 100) {
    console.warn('[BACKEND] image_decode_failure: Payload too small or corrupt base64');
    return res.status(400).json({ error: 'Corrupt or unparseable image payload.' });
  }
  const decodedByteLength = Math.floor((rawBase64.length * 3) / 4);
  console.log('[BACKEND] image_decode_success', {
    byteLength: decodedByteLength,
    mimeType: (mimeType || 'image/jpeg').toLowerCase()
  });

  // 3. Multi-Tier Distributed Rate Limiting & Global Daily Vision Budget
  const effectiveUserId = authenticatedUserId || clientUserId || 'anon_guest';
  const rateLimitKey = isGuest ? `guest:${clientIp}` : `user:${effectiveUserId}`;
  const rateCheck = await checkRateLimit(rateLimitKey, isGuest);

  res.setHeader('X-RateLimit-Limit', RATE_LIMITS.PER_MINUTE.max.toString());
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateCheck.resetSeconds.toString());

  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.resetSeconds.toString());
    const tierMsg = rateCheck.tierExceeded === 'global_daily_budget'
      ? 'Daily vision scan capacity reached for guest scans. Please sign in or try again tomorrow.'
      : rateCheck.tierExceeded 
      ? `Rate limit exceeded for ${rateCheck.tierExceeded} window. Please wait ${rateCheck.resetSeconds}s before scanning again.`
      : 'Rate limit exceeded: Please wait a few moments before scanning again.';
    return res.status(429).json({ 
      error: tierMsg,
      tier: rateCheck.tierExceeded,
      retryAfter: rateCheck.resetSeconds
    });
  }

  // 4. Cross-Instance Distributed Idempotency Protection
  const cleanKey = idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : null;
  if (cleanKey) {
    // Atomic check: max 1 consumption per version-scoped idempotency key for 1 hour
    const versionedIdemKey = `idem:${VISION_PIPELINE_VERSION}:${cleanKey}`;
    const idemCheck = await checkSingleTier(versionedIdemKey, 1, 3600);
    if (!idemCheck.allowed) {
      console.log(`[api/analyze] Idempotency deduplication triggered across instances for: ${versionedIdemKey}`);
      // Return 409 with version info or conflict message
      return res.status(409).json({
        error: 'Duplicate scan request: this scan job is already processing or completed.',
        code: 'IDEMPOTENCY_CONFLICT',
        idempotencyKey: cleanKey,
        analysisVersion: VISION_PIPELINE_VERSION
      });
    }
  }

  const sanitizedMime = (mimeType || 'image/jpeg').toLowerCase();
  const fullDataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${sanitizedMime};base64,${imageBase64}`;

  // 4.1 Server-Side User Daily Scan Cap Enforcement
  if (authenticatedUserId && supabase) {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_scans_count, daily_scans_reset_at')
        .eq('id', authenticatedUserId)
        .single();
      if (prof) {
        const resetAt = prof.daily_scans_reset_at ? new Date(prof.daily_scans_reset_at).getTime() : 0;
        const isStale = (Date.now() - resetAt) > 86400000;
        const effectiveScans = isStale ? 0 : (prof.daily_scans_count || 0);
        const userCap = pipelineConfig.freeTierBudgets.userDailyScanCap;
        if (effectiveScans >= userCap) {
          console.warn(`[api/analyze] User daily scan limit reached: ${effectiveScans}/${userCap} for user: ${authenticatedUserId}`);
          return res.status(429).json({
            error: `You have reached your daily scan limit of ${userCap} scans. Limit resets tomorrow.`,
            code: 'USER_DAILY_LIMIT_EXCEEDED',
            retryAfter: 86400
          });
        }
      }
    } catch (err: any) {
      console.warn('[api/analyze] User daily scan cap check error:', err?.message);
    }
  }

  // 4.2 Global Daily Free-Tier Budget Guard (Enforced BEFORE any AI provider call)
  if (!checkAndConsumeFreeTierGlobalBudget()) {
    console.warn('[api/analyze] Global daily free-tier scan budget exhausted. Failing closed with SCANNER_BUSY.');
    return res.status(503).json({
      error: 'Scanner busy, daily community quota reached. Please try tomorrow!',
      code: 'SCANNER_BUSY',
      maintenance: false
    });
  }

  // 4.3 Stage A Quality Gate (Decoded byte length & basic image sanity)
  if (decodedByteLength < 1024) {
    return res.status(400).json({
      error: 'Photo is too dark or empty. Please capture a clear photo of a vehicle.',
      code: 'PHOTO_TOO_DARK'
    });
  }

  // 4.4 Image-Hash Cache (Instant resolution on duplicate images without calling AI provider)
  const imageSha256 = crypto.createHash('sha256').update(rawBase64).digest('hex');
  const cachedScan = scanResultImageCache.get(imageSha256);
  if (cachedScan && (Date.now() - cachedScan.timestamp < 86400000)) {
    console.log(`[api/analyze] Image SHA256 cache HIT for ${imageSha256.slice(0, 12)} (zero provider calls consumed)`);
    return res.status(200).json({
      ...cachedScan.responsePayload,
      cached: true,
      trace_id: `cached_${imageSha256.slice(0, 8)}`
    });
  }

  try {
    console.log('[BACKEND] vision_provider_request_started', {
      provider: rawProvider,
      idempotencyKey: cleanKey || 'none',
      clientIp
    });

    const ingestion = await apexEngine.ingestScan({
      imageDataUrl: fullDataUrl,
      userId: effectiveUserId,
      idempotencyKey: cleanKey || undefined,
      priority: 'HIGH',
      fileName,
      clientIp
    });

    let finalResult = ingestion.result;

    // Bounded synchronous wait for worker pool completion (avoids serverless freeze / cross-container polling misses)
    let latestStatus = ingestion.status;
    let latestQueuePos = ingestion.queuePosition;

    if (!finalResult) {
      const waitStart = Date.now();
      const maxWaitMs = 35000;
      while (Date.now() - waitStart < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const current = apexEngine.getScanStatus(ingestion.scanId);
        latestStatus = current.status;
        latestQueuePos = current.queuePosition;

        if (current.status === 'completed' || current.status === 'needs_review' || current.status === 'abstained' || current.status === 'uncertain') {
          finalResult = current.result;
          break;
        }
        if (current.status === 'failed') {
          console.warn('[BACKEND] vision_provider_response: failed', { error: current.error });
          const errStr = String(current.error || '');
          if (errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
            return res.status(503).json({
              error: 'Scanner busy, daily community quota reached. Please try tomorrow!',
              code: 'SCANNER_BUSY'
            });
          }
          return res.status(500).json({
            error: current.error || 'Vehicle identification failed.',
            scan_id: ingestion.scanId,
            analysisVersion: VISION_PIPELINE_VERSION
          });
        }
      }
    }

    console.log('[BACKEND] vision_provider_response', {
      scanId: ingestion.scanId,
      status: finalResult?.status || latestStatus,
      make: finalResult?.make,
      model: finalResult?.model,
      confidence: finalResult?.confidence?.totalScore
    });

    // Return immediate or awaited completed result
    if (finalResult) {
      if (
        finalResult.error_code === 'VISION_QUOTA_EXHAUSTED' ||
        String(finalResult.error || '').includes('429') ||
        String(finalResult.v2Result?.guidedRecovery?.userPrompt || '').includes('429')
      ) {
        return res.status(503).json({
          error: 'Scanner busy, daily community quota reached. Please try tomorrow!',
          code: 'SCANNER_BUSY'
        });
      }
      const responsePayload = formatScanResponse(finalResult);

      // Non-sensitive production debug trace (never logs secrets, auth tokens, or base64)
      console.log('[api/analyze] Production Debug Trace:', {
        requestId: (req.headers['x-vercel-id'] as string) || ingestion.traceId,
        traceId: ingestion.traceId,
        analysisVersion: VISION_PIPELINE_VERSION,
        provider: rawProvider,
        model: isCloudflare ? '@cf/meta/llama-3.2-11b-vision-instruct' : (process.env.GEMINI_MODEL || 'gemini-3.5-flash'),
        imageSha256Short: ingestion.scanId?.substring(0, 12),
        cacheHit: Boolean(ingestion.isCachedHit),
        cacheVersion: VISION_PIPELINE_VERSION,
        idempotencyHit: Boolean(ingestion.isCachedHit),
        rawMake: finalResult.canonicalResult?.identification?.make || finalResult.make,
        rawModel: finalResult.canonicalResult?.identification?.model_family || finalResult.model,
        normalizedMake: responsePayload.make,
        normalizedModel: responsePayload.model,
        canonicalVehicleId: responsePayload.canonical_vehicle_id,
        specRecordId: responsePayload.canonical_vehicle_id || 'default'
      });

      scanResultImageCache.set(imageSha256, {
        responsePayload,
        timestamp: Date.now()
      });

      return res.status(200).json(responsePayload);
    }

    // Return Asynchronous Job Response if queue wait exceeded
    return res.status(202).json({
      scan_id: ingestion.scanId,
      status: latestStatus,
      queue_position: latestQueuePos,
      estimated_wait_ms: ingestion.estimatedWaitMs,
      trace_id: ingestion.traceId
    });
  } catch (err: any) {
    const errStr = String(err?.message || err || '');
    if (err?.status === 429 || errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
      return res.status(503).json({
        error: 'Scanner busy, daily community quota reached. Please try tomorrow!',
        code: 'SCANNER_BUSY'
      });
    }
    return res.status(500).json({
      error: 'Vehicle identification failed.',
      message: err?.message
    });
  }
}
