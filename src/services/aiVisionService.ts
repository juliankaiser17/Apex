import type { BodyStyle, RarityTier } from '../types/apex';
import { GoogleGenAI } from '@google/genai';

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

const GEMINI_PROMPT = `You are APEX Vision — the world's most advanced automotive AI classifier. You have encyclopedic knowledge of every car ever manufactured, including aftermarket modifications, body kits, wraps, and tuning parts.

STEP 1 — VEHICLE GATE:
First, determine if this image contains an automobile (car, truck, SUV, van, motorcycle, or any motor vehicle). If the image does NOT contain a motor vehicle, respond ONLY with:
{"is_car": false, "rejection_reason": "Brief description of what you see instead"}

STEP 2 — If it IS a vehicle, analyze it with extreme precision. Pay close attention to:
- Exact make, model, generation/chassis code, and trim level
- Year estimate based on facelift details (headlights, bumpers, grilles)
- Visible aftermarket modifications: body kits (Rocket Bunny, Liberty Walk, Varis, etc.), spoilers/wings, custom wheels (brand if visible), lowered suspension, roll cages, exhaust tips, carbon fiber parts, vinyl wraps, wide-body conversions, intercooler setups, hood vents, splitters, diffusers, tow hooks, aftermarket headlights/taillights, brake calipers
- Paint color (use manufacturer color name if identifiable)
- Any stickers, liveries, or racing decals

Return ONLY valid JSON (no markdown, no backticks, no explanation) matching this schema:
{
  "is_car": true,
  "make": "Exact manufacturer name",
  "model": "Full model name with variant",
  "generation": "Chassis/generation code (e.g. R35, E92, A90, 992.1)",
  "trim": "Trim level or performance variant (e.g. Nismo, M Competition, GT3 RS)",
  "year_estimate": "Best estimate year as string",
  "color": "Exact color name (use manufacturer color if possible, e.g. 'Nardo Grey', 'Rosso Corsa')",
  "rarity": "common|uncommon|rare|epic|legendary|mythic",
  "estimated_market_value_usd_low": 50000,
  "estimated_market_value_usd_high": 70000,
  "engine": "Full engine spec (e.g. '3.0L B58 Twin-Scroll Turbo I6')",
  "horsepower": 382,
  "torque_nm": 500,
  "kerb_weight_kg": 1540,
  "top_speed_kmh": 250,
  "zero_to_hundred_seconds": 3.9,
  "production_years": "YYYY–YYYY or YYYY–Present",
  "origin_country": "Country of manufacture",
  "body_style": "Sedan|Coupe|Convertible|SUV|Hatchback|Wagon|Pickup|Supercar|Hypercar|Van|Motorcycle",
  "historical_information": "2-3 sentences of the car's engineering heritage and significance",
  "interesting_facts": "1-2 sentences of fascinating trivia about this specific model",
  "aftermarket_parts_detected": [
    {
      "part_name": "Name of the modification",
      "brand_if_identifiable": "Brand name or null",
      "description": "What it is and how you identified it",
      "confidence": 0.85
    }
  ],
  "confidence": 0.95,
  "needs_better_angle": false,
  "angle_instruction": null
}

RARITY GUIDE:
- common: Mass-market economy cars (Corolla, Civic, Camry)
- uncommon: Popular sports/luxury cars (Mustang GT, C-Class, A4)
- rare: Premium performance (M3, Supra, Cayman GTS)
- epic: High-end supercars (AMG GT, R8, 911 Turbo S)
- legendary: Elite supercars under 5000/year production (Ferrari 488, Lamborghini Huracán, McLaren 720S)
- mythic: Hypercars and ultra-limited editions under 500 units (LaFerrari, P1, Senna, One-77)

If the photo is blurry or the angle makes identification difficult, set "needs_better_angle": true, lower the confidence, and provide "angle_instruction" with guidance.`;

import { supabase } from '../lib/supabase';

/**
 * APEX Vision Engine — Hybrid Secure Architecture
 * Authenticated calls proxy via /api/analyze with client fallback
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

  // 1. Attempt Secure Serverless Proxy (/api/analyze) with Supabase Session JWT
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
  } catch (proxyErr) {
    console.warn('Backend proxy attempt failed, checking client fallback...', proxyErr);
  }

  // 2. Direct Client Fallback (Only if key available in dev environment)
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiKey) {
    return createRejection('AI Vision analysis service temporarily unavailable. Please try again.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        GEMINI_PROMPT,
        { inlineData: { data: base64Data, mimeType: mimeType } }
      ]
    });

    const rawText = response.text;
    if (!rawText) {
      return createRejection('AI returned an empty response. Please try again.');
    }

    // Clean any markdown formatting the model might add
    const cleanedText = rawText
      .replace(/```json\n?/g, '')
      .replace(/\n?```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Car gate check
    if (parsed.is_car === false) {
      return {
        ...getEmptyPayload(),
        is_car: false,
        rejection_reason: parsed.rejection_reason || 'This image does not contain a vehicle.'
      };
    }

    // Valid car — return full payload
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
  } catch (err: any) {
    console.error('APEX Vision Error:', err);
    
    // Check for specific error types
    if (err instanceof SyntaxError) {
      return createRejection('AI response was malformed. Please try scanning again.');
    }
    
    if (err.message?.includes('API key')) {
      return createRejection('Invalid API key. Please check your Gemini API key configuration.');
    }

    return createRejection('Analysis failed. Please check your internet connection and try again.');
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
