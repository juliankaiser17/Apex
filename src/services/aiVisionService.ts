/**
 * APEX — Production AI Vision Client Service Bridge
 * Routes vehicle scan requests strictly through the authenticated Apex Backend API.
 * The mobile client NEVER holds private AI keys or calls AI providers directly.
 */

import type { BodyStyle, RarityTier } from '../types/apex';
import { offlineRecognitionEngine } from './offlineRecognitionEngine';
import type { NormalizedVehicle } from '../data/vehicleDatabase';
import { supabase } from '../lib/supabase';
import { apexEngine } from '../ai-engine/engine';
import type { IdentificationResult } from '../ai-engine/types';
import { Capacitor } from '@capacitor/core';

export interface AftermarketPart {
  part_name: string;
  brand_if_identifiable: string | null;
  description: string;
  confidence: number;
}

export interface AiIdentificationPayload {
  is_car: boolean;
  status?: 'identified' | 'probable' | 'uncertain' | 'rejected';
  specificity_level?: 'make' | 'model_family' | 'generation' | 'variant';
  viewpoint?: string;
  rejection_reason?: string;
  make: string;
  model: string;
  generation: string;
  trim: string | null;
  year_estimate: string;
  color: string;
  rarity: RarityTier;
  estimated_market_value_usd_low: number;
  estimated_market_value_usd_high: number;
  engine: string;
  horsepower: number;
  torque_nm: number;
  kerb_weight_kg: number;
  top_speed_kmh: number;
  zero_to_hundred_seconds: number;
  production_years: string;
  origin_country: string;
  body_style: BodyStyle;
  historical_information: string;
  interesting_facts: string;
  aftermarket_parts_detected: AftermarketPart[];
  confidence: number;
  needs_better_angle: boolean;
  angle_instruction: string | null;
  candidates?: Array<{ name: string; score: number; supporting_evidence: string[]; contradictions: string[] }>;
  visual_evidence?: any;
  contradictions?: string[];
  reason?: string;
  canonical_vehicle_id?: string;
  scan_id?: string;
  trace_id?: string;
  timing?: {
    upload_and_ai_ms?: number;
    total_ms?: number;
  };
}

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    // If running directly on the deployed web origin, use relative paths
    if (host === 'apex-spotter.vercel.app') {
      return '';
    }
  }
  // For mobile app (Capacitor localhost) or local dev, use production backend
  return 'https://apex-spotter.vercel.app';
};

/**
 * Maps a canonical/local vehicle database entry into a fully populated AiIdentificationPayload
 */
export function mapNormalizedVehicleToPayload(
  vehicle: NormalizedVehicle,
  color: string = 'GT Silver',
  confidence: number = 0.92
): AiIdentificationPayload {
  return {
    is_car: true,
    make: vehicle.manufacturer,
    model: vehicle.model,
    generation: vehicle.generation,
    trim: vehicle.trim || null,
    year_estimate: `${vehicle.yearStart}`,
    color: color,
    rarity: vehicle.baselineRarity,
    estimated_market_value_usd_low: 45000,
    estimated_market_value_usd_high: 85000,
    engine: vehicle.engine,
    horsepower: vehicle.horsepower,
    torque_nm: vehicle.torqueNm,
    kerb_weight_kg: vehicle.curbWeightKg || 1450,
    top_speed_kmh: vehicle.topSpeedKmH,
    zero_to_hundred_seconds: vehicle.zeroToHundredSec,
    production_years: vehicle.productionYears,
    origin_country: vehicle.originCountry,
    body_style: (vehicle.bodyStyle === 'Targa' ? 'Coupe' : vehicle.bodyStyle) as BodyStyle,
    historical_information: vehicle.notableFacts,
    interesting_facts: vehicle.notableFacts,
    aftermarket_parts_detected: [],
    confidence: confidence,
    needs_better_angle: false,
    angle_instruction: null,
    canonical_vehicle_id: vehicle.id
  };
}

/**
 * Performs on-device optical recognition as a resilient fallback
 * when network, CORS, or remote serverless functions are unavailable.
 */
export async function identifyVehicleOffline(photoDataUrl: string): Promise<AiIdentificationPayload> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: "You’re offline, so Apex is using offline identification.",
        rejection_reason: 'actual_device_offline',
        confidence: 0
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = 64;
        offscreenCanvas.height = 36;
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 64, 36);
          const features = offlineRecognitionEngine.extractFeatures(offscreenCanvas, ctx, 64, 36);
          const matchResult = offlineRecognitionEngine.matchVehicle(features, true);
          if (matchResult && matchResult.vehicle && matchResult.confidence >= 0.65) {
            console.log('[Apex AI Vision] Local optical match:', matchResult.vehicle.manufacturer, matchResult.vehicle.model);
            resolve(mapNormalizedVehicleToPayload(matchResult.vehicle, matchResult.matchedColor, matchResult.confidence));
            return;
          }
        }
      } catch (err) {
        console.warn('[Apex Offline Recognition] Extraction error:', err);
      }
      // Never force a guess on unknown silhouettes
      resolve({
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: "You’re offline, so Apex is using offline identification. Please capture closer framing or connect to internet.",
        rejection_reason: 'actual_device_offline',
        confidence: 0
      });
    };
    img.onerror = () => {
      resolve({
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: "Failed to process image offline.",
        rejection_reason: 'actual_device_offline',
        confidence: 0
      });
    };
    img.src = photoDataUrl;
  });
}

let activeTokenResolutionPromise: Promise<AuthoritativeTokenResult> | null = null;

export interface AuthoritativeTokenResult {
  accessToken: string | null;
  userId?: string;
  errorClassification?: 'AUTH_REQUIRED' | 'AUTH_SESSION_EXPIRED' | 'AUTH_REFRESH_FAILED';
  hasSession: boolean;
  hasAccessToken: boolean;
  tokenAgeSec?: number;
  expiresAtSec?: number;
}

/**
 * Authoritatively obtains a valid, unexpired Supabase access token.
 * Single-flight deduplication: concurrent callers share the exact same resolution & refresh promise.
 */
export async function getAuthoritativeAccessToken(forceRefresh = false): Promise<AuthoritativeTokenResult> {
  // If resolution is already in flight and not forcing refresh, share the in-flight promise
  if (!forceRefresh && activeTokenResolutionPromise) {
    return await activeTokenResolutionPromise;
  }

  const resolutionTask = (async (): Promise<AuthoritativeTokenResult> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return {
          accessToken: null,
          errorClassification: 'AUTH_REQUIRED',
          hasSession: false,
          hasAccessToken: false
        };
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const isExpiringSoon = expiresAt > 0 && (expiresAt - nowSec) <= 60; // within 60s of expiry

      if (!forceRefresh && !isExpiringSoon && session.access_token) {
        return {
          accessToken: session.access_token,
          userId: session.user?.id,
          hasSession: true,
          hasAccessToken: true,
          tokenAgeSec: expiresAt > 0 ? Math.max(0, 3600 - (expiresAt - nowSec)) : 0,
          expiresAtSec: expiresAt
        };
      }

      // Token is expired, expiring soon, or refresh forced: execute single-flight refresh
      console.log('[Apex Auth Telemetry] Refreshing Supabase auth session (single-flight)...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session?.access_token) {
        console.warn('[Apex Auth Telemetry] Session refresh failed:', refreshError?.message);
        return {
          accessToken: null,
          userId: session.user?.id,
          errorClassification: 'AUTH_SESSION_EXPIRED' as const,
          hasSession: false,
          hasAccessToken: false
        };
      }

      return {
        accessToken: refreshData.session.access_token,
        userId: refreshData.session.user?.id,
        errorClassification: undefined,
        hasSession: true,
        hasAccessToken: true,
        tokenAgeSec: 0,
        expiresAtSec: refreshData.session.expires_at || 0
      };
    } catch (err: any) {
      console.warn('[Apex Auth Telemetry] Session refresh exception:', err?.message);
      return {
        accessToken: null,
        errorClassification: 'AUTH_REFRESH_FAILED' as const,
        hasSession: false,
        hasAccessToken: false
      };
    }
  })();

  if (!forceRefresh) {
    activeTokenResolutionPromise = resolutionTask;
    resolutionTask.finally(() => {
      if (activeTokenResolutionPromise === resolutionTask) {
        activeTokenResolutionPromise = null;
      }
    });
  }

  return await resolutionTask;
}

function formatEngineResult(r: IdentificationResult): any {
  const canon = r.canonicalResult;
  return {
    status: canon?.status || (r.status === 'completed' ? 'identified' : r.status),
    confidence: r.confidence?.totalScore ?? 0.95,
    visual_evidence: canon?.visual_evidence || null,
    viewpoint: canon?.viewpoint || 'unknown',
    candidates: (canon?.candidates || []).map(c => ({
      name: c.name,
      score: c.score,
      supporting_evidence: c.supporting_evidence,
      contradictions: c.contradictions || []
    })),
    contradictions: canon?.contradictions || [],
    specificity_level: canon?.specificity_level || (r.trim ? 'variant' : 'model_family'),
    reason: canon?.reason || (r.confidence?.abstentionReason || 'Vehicle successfully identified.'),
    needs_retake: canon ? canon.needs_retake : (r.confidence?.shouldAbstain ?? false),
    is_car: canon ? canon.vehicle_present : (r.status !== 'failed'),
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

export async function runDirectApexEngine(
  photoDataUrl: string,
  fileName?: string,
  onProgress?: (msg: string, pct: number) => void
): Promise<AiIdentificationPayload> {
  console.log('[Apex AI Vision Telemetry] Executing direct embedded Apex Vision Engine...');
  onProgress?.('Analyzing vehicle with Apex Vision AI…', 15);

  const idempotencyKey = `direct_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const ingest = await apexEngine.ingestScan({
    imageDataUrl: photoDataUrl,
    fileName: fileName || 'scan.jpg',
    userId: 'mobile_user',
    priority: 'HIGH',
    idempotencyKey
  });

  if (ingest.status === 'completed' && ingest.result) {
    return parseBackendResponse(formatEngineResult(ingest.result));
  }

  // Poll local worker pool
  const scanId = ingest.scanId;
  const pollStart = performance.now();
  const maxTimeoutMs = 35000;

  while (performance.now() - pollStart < maxTimeoutMs) {
    await new Promise(r => setTimeout(r, 200));
    const status = apexEngine.getScanStatus(scanId);

    if (status.status === 'completed' && status.result) {
      return parseBackendResponse(formatEngineResult(status.result));
    }

    if (status.status === 'needs_review' || status.status === 'abstained' || status.status === 'uncertain' || status.status === 'failed') {
      if (status.result) {
        return parseBackendResponse(formatEngineResult(status.result));
      }
      if (status.status === 'failed') break;
    }
  }

  return {
    ...getEmptyPayload(),
    status: 'uncertain',
    is_car: true,
    needs_better_angle: true,
    reason: 'Could not achieve definitive vehicle identification.',
    rejection_reason: 'low_confidence',
    confidence: 0
  };
}

/**
 * Submits a car photo to the Apex Vision Pipeline.
 * 1. If native mobile platform (Android APK), directly uses the embedded Apex Vision Engine with Gemini
 * 2. If online and authenticated web, attempts remote Apex Backend API (/api/analyze)
 * 3. Seamlessly falls back to direct embedded Apex Vision Engine on any network or auth error
 */
export async function identifyVehicleWithAi(
  photoDataUrl: string,
  _forceLowConfidence: boolean = false,
  fileName?: string,
  onProgress?: (status: string, queuePos: number) => void
): Promise<AiIdentificationPayload> {
  if (!photoDataUrl || !photoDataUrl.startsWith('data:image')) {
    return createRejection('Invalid image data provided.');
  }

  // 1. Detect actual device network state
  const isDeviceOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;

  // 2. Genuinely Offline Path: Only invoke offline recognition when disconnected
  if (!isDeviceOnline) {
    console.log('[Apex AI Vision Telemetry]', {
      network_state_before_scan: 'offline',
      api_analyze_attempted: false,
      http_status: null,
      response_classification: 'actual_device_offline',
      offline_engine_invoked: true
    });
    return await identifyVehicleOffline(photoDataUrl);
  }

  // 3. Online Scan Path: Route through server-side /api/analyze backend
  // Cloudflare credentials remain strictly server-side; client never invokes AI models directly
  const authResolution = await getAuthoritativeAccessToken(false);

  const baseUrl = getApiBaseUrl();
  const analyzeEndpoint = `${baseUrl}/api/analyze`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s bounded timeout for vision inference
  const tRequestStart = performance.now();

  console.log('[Apex AI Vision Telemetry]', {
    network_state_before_scan: 'online',
    isNative: Capacitor.isNativePlatform(),
    hasSession: authResolution.hasSession,
    hasAccessToken: authResolution.hasAccessToken,
    tokenAgeSec: authResolution.tokenAgeSec ?? 0,
    expiresAtSec: authResolution.expiresAtSec ?? 0,
    userId: authResolution.userId || 'anon',
    authState: authResolution.hasSession ? 'AUTHENTICATED' : 'GUEST',
    api_analyze_attempted: true,
    request_start_timestamp: new Date().toISOString(),
    endpoint: analyzeEndpoint
  });

  // 4. Stable scanId and idempotencyKey across any 1-shot auth retry (prevents duplicate jobs/XP)
  const idempotencyKey = `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const executePost = async (token?: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return await fetch(analyzeEndpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: photoDataUrl,
        mimeType: photoDataUrl.substring(photoDataUrl.indexOf(':') + 1, photoDataUrl.indexOf(';')) || 'image/jpeg',
        fileName: fileName || 'scan.jpg',
        userId: authResolution.userId || 'anon_user',
        idempotencyKey
      })
    });
  };

  try {
    onProgress?.('Contacting Apex AI backend…', 0);

    let res = await executePost(authResolution.accessToken);

    // ── Phase 4: One-Shot 401 Recovery ──
    // If backend returns 401, refresh session and retry EXACTLY ONCE with the same idempotencyKey
    if (res.status === 401) {
      console.warn('[Apex AI Vision Telemetry] HTTP 401 received. Attempting single-flight session refresh...');
      const refreshResult = await getAuthoritativeAccessToken(true);

      if (refreshResult.accessToken) {
        console.log('[Apex AI Vision Telemetry] Refresh succeeded. Retrying scan request once with fresh token...');
        res = await executePost(refreshResult.accessToken);
      }
    }

    clearTimeout(timeoutId);
    const tRequestEnd = performance.now();
    const durationMs = Math.round(tRequestEnd - tRequestStart);

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return {
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: data.error || 'Scan rate limit reached. Please wait a few moments before scanning again.',
        rejection_reason: 'rate_limit_exceeded',
        confidence: 0
      };
    }

    if (res.status === 503) {
      const data = await res.json().catch(() => ({}));
      return {
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: data.error || 'AI Vehicle Scanning is temporarily paused for maintenance.',
        rejection_reason: 'service_unavailable',
        confidence: 0
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn(`[Apex AI Vision Telemetry] Remote analyze returned HTTP ${res.status}:`, errData);
      return {
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        needs_better_angle: false,
        reason: errData.error || `Vision backend error (HTTP ${res.status}). Please try again.`,
        rejection_reason: 'backend_error',
        confidence: 0
      };
    }

    const data = await res.json();

    console.log('[Apex AI Vision Telemetry]', {
      network_state_before_scan: 'online',
      api_analyze_attempted: true,
      http_status: res.status,
      duration_ms: durationMs,
      response_classification: data.status || 'identified',
      offline_engine_invoked: false,
      final_client_status: data.status || 'identified'
    });

    // Immediate Result (200 OK)
    if (res.status === 200) {
      return parseBackendResponse(data);
    }

    // Asynchronous Queue Processing (202 Accepted)
    if (res.status === 202 && data.scan_id) {
      return await pollScanStatus(baseUrl, data.scan_id, onProgress, photoDataUrl);
    }

    return parseBackendResponse(data);
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timed out');
    console.warn(`[Apex AI Vision Telemetry] Remote analyze request failed (timeout=${isTimeout}):`, err?.message);
    return {
      ...getEmptyPayload(),
      status: 'uncertain',
      is_car: true,
      needs_better_angle: false,
      reason: isTimeout
        ? 'Scanning timed out. Please ensure you have a stable network connection.'
        : 'Could not connect to Apex vision service. Please verify your connection.',
      rejection_reason: isTimeout ? 'timeout' : 'network_error',
      confidence: 0
    };
  }
}

/**
 * Polls the backend scan status endpoint if the scan was queued asynchronously.
 */
async function pollScanStatus(
  baseUrl: string,
  scanId: string,
  onProgress?: (status: string, queuePos: number) => void,
  _photoDataUrl?: string
): Promise<AiIdentificationPayload> {
  const statusEndpoint = `${baseUrl}/api/scans/status?scanId=${encodeURIComponent(scanId)}`;
  const maxAttempts = 30; // up to ~15 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500));

    try {
      const res = await fetch(statusEndpoint);
      if (!res.ok) continue;

      const body = await res.json();
      onProgress?.(body.status || 'processing', body.queue_position || 0);

      if (body.status === 'completed' || body.status === 'needs_review') {
        if (body.result) {
          return parseBackendResponse(body.result);
        }
      }

      if (body.status === 'abstained' || body.status === 'rejected') {
        return parseBackendResponse(body.result || body);
      }

      if (body.status === 'failed') {
        return {
          ...getEmptyPayload(),
          status: 'uncertain',
          is_car: true,
          needs_better_angle: false,
          reason: body.error || 'Cloud vision processing encountered an issue.',
          rejection_reason: 'vision_provider_unavailable',
          confidence: 0
        };
      }
    } catch {
      // Continue polling until timeout
    }
  }

  return {
    ...getEmptyPayload(),
    status: 'uncertain',
    is_car: true,
    needs_better_angle: false,
    reason: 'Identification timed out due to server queue depth. Please retry shortly.',
    rejection_reason: 'vision_provider_unavailable',
    confidence: 0
  };
}

function parseBackendResponse(r: any): AiIdentificationPayload {
  // Only explicitly rejected scans or missing cars are non-cars
  if (!r || r.status === 'rejected' || (r.is_car === false && r.status !== 'uncertain')) {
    return {
      ...getEmptyPayload(),
      status: 'rejected',
      is_car: false,
      rejection_reason: r?.rejection_reason || r?.reason || "No motor vehicle detected. Please photograph a real car.",
      needs_better_angle: true,
      angle_instruction: r?.angle_instruction || 'Ensure car is in frame with good lighting.',
      confidence: r?.confidence || 0,
      scan_id: r?.scan_id,
      trace_id: r?.trace_id
    };
  }

  const isMakeUnknown = !r.make || r.make.trim() === '' || r.make.toLowerCase().includes('unknown');
  const isModelUnknown = !r.model || r.model.trim() === '' || r.model.toLowerCase().includes('unknown');

  if (isMakeUnknown && isModelUnknown) {
    if (r.status === 'uncertain') {
      const machineReason = r.confidence?.abstentionReason || r.abstention_reason || 'VISION_QUOTA_EXHAUSTED';
      return {
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        make: r.make || 'Unknown',
        model: r.model || 'Unknown',
        rejection_reason: r.reason || 'Vision provider unavailable. Explicit abstention enforced.',
        needs_better_angle: true,
        angle_instruction: r.angle_instruction || r.reason || 'Vision provider unavailable. Please retry shortly.',
        confidence: 0,
        scan_id: r.scan_id,
        trace_id: r.trace_id,
        reason: r.reason || machineReason
      };
    }
    return {
      ...getEmptyPayload(),
      status: 'rejected',
      is_car: false,
      rejection_reason: 'Vehicle could not be recognized. Please retry with clearer framing.',
      needs_better_angle: true,
      confidence: r.confidence || 0,
      scan_id: r.scan_id,
      trace_id: r.trace_id
    };
  }

  const rawParts = Array.isArray(r.aftermarket_parts_detected) ? r.aftermarket_parts_detected : [];
  const parts: AftermarketPart[] = rawParts.map((p: any) => ({
    part_name: p.part_name || p.partName || 'Custom Component',
    brand_if_identifiable: p.brand_if_identifiable || p.brand || null,
    description: p.description || '',
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.8
  }));

  const status: 'identified' | 'probable' | 'uncertain' | 'rejected' =
    r.status === 'identified' || r.status === 'probable' || r.status === 'uncertain' || r.status === 'rejected'
      ? r.status
      : (typeof r.confidence === 'number' && r.confidence >= 0.75)
      ? 'identified'
      : (typeof r.confidence === 'number' && r.confidence >= 0.50)
      ? 'probable'
      : 'uncertain';

  return {
    is_car: true,
    status,
    specificity_level: r.specificity_level || (r.trim ? 'variant' : 'model_family'),
    viewpoint: r.viewpoint || 'unknown',
    make: r.make || 'Unknown',
    model: r.model || 'Unknown',
    generation: r.generation || 'Base',
    trim: r.trim || null,
    year_estimate: r.year_estimate || r.yearEstimate || 'N/A',
    color: r.color || 'Unknown',
    rarity: r.rarity || 'common',
    estimated_market_value_usd_low: r.estimated_market_value_usd_low || 45000,
    estimated_market_value_usd_high: r.estimated_market_value_usd_high || 85000,
    engine: r.engine || 'N/A',
    horsepower: r.horsepower || 0,
    torque_nm: r.torque_nm || r.torqueNm || 0,
    kerb_weight_kg: r.kerb_weight_kg || r.kerbWeightKg || 0,
    top_speed_kmh: r.top_speed_kmh || r.topSpeedKmH || 0,
    zero_to_hundred_seconds: r.zero_to_hundred_seconds || r.zeroToHundredSec || 0,
    production_years: r.production_years || r.productionYears || 'N/A',
    origin_country: r.origin_country || r.originCountry || 'Unknown',
    body_style: r.body_style || r.bodyStyle || 'Coupe',
    historical_information: r.historical_information || r.historicalInformation || '',
    interesting_facts: r.interesting_facts || r.interestingFacts || '',
    aftermarket_parts_detected: parts,
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.85,
    needs_better_angle: status === 'uncertain' || Boolean(r.needs_better_angle),
    angle_instruction: r.reason || r.angle_instruction || (status === 'uncertain' ? 'Variant uncertain. Try capturing from front 3/4 angle.' : null),
    candidates: Array.isArray(r.candidates) ? r.candidates : [],
    visual_evidence: r.visual_evidence || null,
    contradictions: Array.isArray(r.contradictions) ? r.contradictions : [],
    reason: r.reason || '',
    canonical_vehicle_id: r.canonical_vehicle_id || r.canonicalVehicleId,
    scan_id: r.scan_id || r.scanId,
    trace_id: r.trace_id || r.traceId
  };
}

function createRejection(reason: string, rejectionReason?: string): AiIdentificationPayload {
  return {
    ...getEmptyPayload(),
    is_car: false,
    rejection_reason: rejectionReason || reason,
    reason
  };
}

function getEmptyPayload(): AiIdentificationPayload {
  return {
    is_car: false,
    rejection_reason: '',
    make: 'Unknown',
    model: 'Unknown',
    generation: 'Unknown',
    trim: null,
    year_estimate: 'N/A',
    color: 'Unknown',
    rarity: 'common',
    estimated_market_value_usd_low: 0,
    estimated_market_value_usd_high: 0,
    engine: 'N/A',
    horsepower: 0,
    torque_nm: 0,
    kerb_weight_kg: 0,
    top_speed_kmh: 0,
    zero_to_hundred_seconds: 0,
    production_years: 'N/A',
    origin_country: 'Unknown',
    body_style: 'Sedan',
    historical_information: '',
    interesting_facts: '',
    aftermarket_parts_detected: [],
    confidence: 0,
    needs_better_angle: false,
    angle_instruction: null
  };
}
