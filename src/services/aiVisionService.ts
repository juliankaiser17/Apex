/**
 * APEX — Production AI Vision Client Service Bridge
 * Routes vehicle scan requests strictly through the authenticated Apex Backend API.
 * The mobile client NEVER holds private AI keys or calls AI providers directly.
 */

import type { BodyStyle, RarityTier } from '../types/apex';
import { offlineRecognitionEngine } from './offlineRecognitionEngine';
import type { NormalizedVehicle } from '../data/vehicleDatabase';
import { supabase } from '../lib/supabase';

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
  if (typeof window !== 'undefined') {
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
      resolve(createRejection('Offline identification unavailable in server runtime.'));
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
      resolve(createRejection('Vehicle could not be recognized offline. Please capture closer framing or connect to network.'));
    };
    img.onerror = () => {
      resolve(createRejection('Failed to process image offline.'));
    };
    img.src = photoDataUrl;
  });
}

/**
 * Submits a car photo to the Apex Backend API for AI verification.
 * Adheres strictly to:
 * Mobile App -> Apex Backend API (/api/analyze) -> Gemini Provider
 * With seamless automatic fallback to local vehicle intelligence if offline or backend is unreachable.
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

  const baseUrl = getApiBaseUrl();
  const analyzeEndpoint = `${baseUrl}/api/analyze`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for fast response

  // Check for active Supabase user session token
  let authHeader = '';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeader = `Bearer ${session.access_token}`;
    }
  } catch {
    // Guest or offline mode
  }

  try {
    onProgress?.('Contacting Apex AI backend…', 0);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnRuZXhoeWllaXN6Z2dsaGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTExNTQsImV4cCI6MjEwMTQ4NzE1NH0.DJDskHmSI8BOTi9icFi8SP7EotGYhjgXQHIXcFJr-Ek'
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch(analyzeEndpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: photoDataUrl,
        mimeType: photoDataUrl.substring(photoDataUrl.indexOf(':') + 1, photoDataUrl.indexOf(';')) || 'image/jpeg',
        fileName: fileName || 'scan.jpg',
        idempotencyKey: `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`
      })
    });

    clearTimeout(timeoutId);

    // If unauthorized (401), method not allowed (405 CORS), rate-limited (429), or server error (500+)
    if (!res.ok) {
      console.warn(`[Apex AI Vision] Remote endpoint returned status ${res.status}. Falling back to local intelligence.`);
      return await identifyVehicleOffline(photoDataUrl);
    }

    const data = await res.json();

    // Immediate Result (200 OK)
    // Strictly respect the remote classification hierarchy:
    // REMOTE IDENTIFIED -> use remote result
    // REMOTE UNCERTAIN   -> respect uncertainty
    // REMOTE REJECTED    -> respect rejection (NEVER pick a vehicle from local database)
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
    console.warn('[Apex AI Vision] Remote request unavailable or timed out, executing seamless local recognition:', err?.message || err);
    return await identifyVehicleOffline(photoDataUrl);
  }
}

/**
 * Polls the backend scan status endpoint if the scan was queued asynchronously.
 */
async function pollScanStatus(
  baseUrl: string,
  scanId: string,
  onProgress?: (status: string, queuePos: number) => void,
  photoDataUrl?: string
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
        if (photoDataUrl) {
          return await identifyVehicleOffline(photoDataUrl);
        }
        return createRejection(body.error || 'AI identification failed. Please try again.');
      }
    } catch {
      // Continue polling until timeout
    }
  }

  if (photoDataUrl) {
    return await identifyVehicleOffline(photoDataUrl);
  }
  return createRejection('Identification is taking longer than expected due to server traffic.');
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
      return {
        ...getEmptyPayload(),
        status: 'uncertain',
        is_car: true,
        rejection_reason: r.reason || 'Vision provider unavailable. Explicit abstention enforced.',
        needs_better_angle: true,
        angle_instruction: 'Vision provider unavailable. Please retry shortly.',
        confidence: 0,
        scan_id: r.scan_id,
        trace_id: r.trace_id,
        reason: r.reason || 'vision_provider_unavailable'
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

function createRejection(reason: string): AiIdentificationPayload {
  return {
    ...getEmptyPayload(),
    is_car: false,
    rejection_reason: reason
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
