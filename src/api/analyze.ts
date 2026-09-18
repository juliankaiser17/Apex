import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { apexEngine } from '../ai-engine/engine';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

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
  const canon = r.canonicalResult;

  return {
    // ── Canonical Production Vision Contract ──
    status: canon?.status || (r.status === 'abstained' ? 'rejected' : 'identified'),
    vehicle_present: canon ? canon.vehicle_present : (r.status !== 'abstained'),
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
    identification: canon?.identification || {
      make: r.make,
      model_family: r.model,
      generation: r.generation,
      variant: r.trim || null
    },
    confidence: {
      ...(canon?.confidence || {
        make_score: r.confidence?.totalScore ?? 0.95,
        model_score: r.confidence?.totalScore ?? 0.95,
        generation_score: Number(((r.confidence?.totalScore ?? 0.95) * 0.85).toFixed(3)),
        variant_score: r.trim ? Number(((r.confidence?.totalScore ?? 0.95) * 0.75).toFixed(3)) : 0.2,
        overall_score: r.confidence?.totalScore ?? 0.95
      }),
      abstentionReason: r.confidence?.abstentionReason || canon?.confidence?.abstentionReason || null
    },
    candidates: canon?.candidates || (r.topCandidates || []).map((c: any) => ({
      name: `${c.make} ${c.model}`,
      score: c.visualSimilarityScore,
      supporting_evidence: c.distinguishingFeatures,
      contradictions: []
    })),
    contradictions: canon?.contradictions || [],
    specificity_level: canon?.specificity_level || (r.trim ? 'variant' : 'model_family'),
    reason: canon?.reason || (r.confidence?.abstentionReason || 'Vehicle successfully identified.'),
    needs_retake: canon ? canon.needs_retake : (r.confidence?.shouldAbstain ?? false),

    // ── Card & Client Specifications ──
    is_car: canon ? canon.vehicle_present : (r.status !== 'abstained'),
    scan_id: r.scanId,
    make: canon?.identification?.make || r.make,
    model: canon?.identification?.model_family || r.model,
    generation: canon?.identification?.generation || r.generation,
    trim: canon?.identification?.variant ?? (r.trim || null),
    year_estimate: r.yearEstimate,
    color: r.color,
    rarity: r.rarity,
    engine: r.engine,
    horsepower: r.horsepower,
    torque_nm: r.torqueNm,
    top_speed_kmh: r.topSpeedKmH,
    zero_to_hundred_seconds: r.zeroToHundredSec,
    kerb_weight_kg: r.kerbWeightKg,
    production_years: r.productionYears,
    origin_country: r.originCountry,
    body_style: r.bodyStyle,
    historical_information: r.historicalInformation,
    interesting_facts: r.interestingFacts,
    aftermarket_parts_detected: r.aftermarketPartsDetected,
    legacy_confidence: r.confidence?.totalScore ?? 0.95,
    needs_better_angle: canon ? (canon.status === 'uncertain' || canon.needs_retake) : (r.confidence?.shouldAbstain ?? false),
    angle_instruction: canon?.reason || r.confidence?.abstentionReason || null,
    upstream_evidence: canon?.upstream_evidence,
    canonical_identity: canon?.canonical_identity,
    provenance: canon?.provenance,
    cached: r.cached,
    trace_id: r.traceId
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

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Invalid payload: Missing base64 image data.' });
  }

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
  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const cleanKey = idempotencyKey.trim();
    // Atomic check: max 1 consumption per idempotency key for 1 hour
    const idemCheck = await checkSingleTier(`idem:${cleanKey}`, 1, 3600);
    if (!idemCheck.allowed) {
      console.log(`[api/analyze] Idempotency deduplication triggered across instances for: ${cleanKey}`);
      // Return 200 with cached result or conflict message
      return res.status(409).json({
        error: 'Duplicate scan request: this scan job is already processing or completed.',
        code: 'IDEMPOTENCY_CONFLICT',
        idempotencyKey: cleanKey
      });
    }
  }

  const sanitizedMime = (mimeType || 'image/jpeg').toLowerCase();
  const fullDataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${sanitizedMime};base64,${imageBase64}`;

  try {
    const ingestion = await apexEngine.ingestScan({
      imageDataUrl: fullDataUrl,
      userId: effectiveUserId,
      idempotencyKey,
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
      const maxWaitMs = 22000;
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
          return res.status(500).json({
            error: current.error || 'Vehicle identification failed.',
            scan_id: ingestion.scanId
          });
        }
      }
    }

    // Return immediate or awaited completed result
    if (finalResult) {
      return res.status(200).json(formatScanResponse(finalResult));
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
    return res.status(500).json({
      error: 'Vehicle identification failed.',
      message: err?.message
    });
  }
}
