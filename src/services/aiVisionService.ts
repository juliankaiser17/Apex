import type { BodyStyle, RarityTier } from '../types/apex';
import { supabase } from '../lib/supabase';

export interface AftermarketPart {
  part_name: string;
  brand_if_identifiable: string | null;
  description: string;
  confidence: number;
}

export interface AiIdentificationPayload {
  is_car: boolean;
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
}

/**
 * APEX Vision Engine — Secure Serverless Routing
 * Authenticated calls proxy exclusively via /api/analyze.
 * No API keys or AI credentials ever touch the mobile client.
 */
export async function identifyVehicleWithAi(
  photoDataUrl: string,
  _forceLowConfidence: boolean = false,
  _fileName?: string
): Promise<AiIdentificationPayload> {
  
  if (!photoDataUrl.startsWith('data:image')) {
    return createRejection('Invalid image data provided.');
  }

  const base64Data = photoDataUrl.split(',')[1];
  const mimeType = photoDataUrl.substring(
    photoDataUrl.indexOf(':') + 1,
    photoDataUrl.indexOf(';')
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const proxyRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: mimeType
      })
    });

    if (proxyRes.ok) {
      const parsed = await proxyRes.json();
      if (parsed.is_car === false) {
        return {
          ...getEmptyPayload(),
          is_car: false,
          rejection_reason: parsed.rejection_reason || 'This image does not contain a vehicle.'
        };
      }
      return {
        is_car: true,
        make: parsed.make || 'Unknown',
        model: parsed.model || 'Vehicle',
        generation: parsed.generation || 'Unknown',
        trim: parsed.trim || null,
        year_estimate: parsed.year_estimate || '2020',
        color: parsed.color || 'Unknown',
        rarity: parsed.rarity || 'common',
        estimated_market_value_usd_low: parsed.estimated_market_value_usd_low || 20000,
        estimated_market_value_usd_high: parsed.estimated_market_value_usd_high || 30000,
        engine: parsed.engine || 'Unknown',
        horsepower: parsed.horsepower || 150,
        torque_nm: parsed.torque_nm || 200,
        kerb_weight_kg: parsed.kerb_weight_kg || 1400,
        top_speed_kmh: parsed.top_speed_kmh || 180,
        zero_to_hundred_seconds: parsed.zero_to_hundred_seconds || 8.0,
        production_years: parsed.production_years || 'Unknown',
        origin_country: parsed.origin_country || 'Unknown',
        body_style: parsed.body_style || 'Sedan',
        historical_information: parsed.historical_information || '',
        interesting_facts: parsed.interesting_facts || '',
        aftermarket_parts_detected: Array.isArray(parsed.aftermarket_parts_detected) 
          ? parsed.aftermarket_parts_detected 
          : [],
        confidence: parsed.confidence || 0.90,
        needs_better_angle: parsed.needs_better_angle || false,
        angle_instruction: parsed.angle_instruction || null
      };
    }

    const errJson = await proxyRes.json().catch(() => ({}));
    return createRejection(errJson.error || 'AI Vision analysis service temporarily unavailable.');
  } catch (proxyErr: any) {
    console.error('Vision analysis proxy error:', proxyErr);
    return createRejection('Failed to connect to APEX Vision servers. Please check your internet connection.');
  }
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
