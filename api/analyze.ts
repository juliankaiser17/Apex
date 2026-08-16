import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const AI_SCHEMA = `
{
  "make": "Exact Make (e.g. Porsche, Toyota, Ferrari)",
  "model": "Exact Model (e.g. 911 Carrera, GR Supra, 458 Italia)",
  "generation": "Model Generation code",
  "trim": "Trim specification",
  "year_estimate": "Estimated Year",
  "color": "Observed car body color",
  "rarity": "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic",
  "estimated_market_value_usd_low": number,
  "estimated_market_value_usd_high": number,
  "engine": "Engine spec",
  "horsepower": number,
  "torque_nm": number,
  "kerb_weight_kg": number,
  "top_speed_kmh": number,
  "zero_to_hundred_seconds": number,
  "production_years": "YYYY-YYYY",
  "origin_country": "Country",
  "body_style": "Coupe" | "Sedan" | "Convertible" | "SUV" | "Supercar",
  "historical_information": "Brief concise history",
  "interesting_facts": "Key engineering fact",
  "aftermarket_parts_detected": [],
  "confidence": 0.98,
  "needs_better_angle": false,
  "angle_instruction": null
}`;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// In-Memory Rate Limiter (Per User / IP sliding window: max 20 requests per 5 minutes)
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(identifier, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Enforce POST Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: Must be POST.' });
  }

  // 2. Client Authentication via Supabase Bearer JWT Token
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://nxrtnexhyieiszgglhbn.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let authenticatedUserId = 'anonymous_ip';

  if (token && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        authenticatedUserId = user.id;
      }
    } catch (authErr) {
      console.warn('Token validation warning:', authErr);
    }
  }

  // Enforce caller authentication in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction && authenticatedUserId === 'anonymous_ip') {
    return res.status(401).json({ 
      error: 'Unauthorized: A valid Supabase authentication session token is required to invoke Vision AI.' 
    });
  }

  // 3. Rate Limiting Check
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const rateLimitKey = `${authenticatedUserId}:${clientIp}`;

  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded: Too many scan analysis requests. Please wait a few minutes before scanning again.' 
    });
  }

  // 4. Validate Request Body
  const { imageBase64, mimeType } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Invalid payload: Missing base64 image data.' });
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const sanitizedMime = (mimeType || 'image/jpeg').toLowerCase();
  if (!allowedMimeTypes.includes(sanitizedMime)) {
    return res.status(400).json({ error: 'Invalid payload: Unsupported image mime type.' });
  }

  // Clean base64 input
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  if (cleanBase64.length < 100) {
    return res.status(400).json({ error: 'Invalid payload: Image data too small or corrupted.' });
  }

  // 5. Server-Side Keys
  const openAiKey = (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();

  if (!openAiKey && !geminiKey) {
    return res.status(503).json({ error: 'No AI vision API keys configured on the server environment.' });
  }

  try {
    // 6. Try OpenAI GPT-4o Vision First
    if (openAiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an expert Automotive Vision AI classifier. Analyze this car photo and return ONLY valid JSON matching this schema exactly:\n${AI_SCHEMA}`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this vehicle and output JSON.' },
                { type: 'image_url', image_url: { url: `data:${sanitizedMime};base64,${cleanBase64}` } }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        const jsonRes = await response.json();
        const content = jsonRes.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.make && parsed.model) {
            return res.status(200).json({
              is_car: parsed.is_car !== false,
              make: parsed.make,
              model: parsed.model,
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
              aftermarket_parts_detected: Array.isArray(parsed.aftermarket_parts_detected) ? parsed.aftermarket_parts_detected : [],
              confidence: parsed.confidence || 0.95,
              needs_better_angle: parsed.needs_better_angle || false,
              angle_instruction: parsed.angle_instruction || null,
              verified_at: new Date().toISOString()
            });
          }
        }
      }
      
      if (!geminiKey) {
        throw new Error('OpenAI API request failed or returned invalid data.');
      }
    }

    // 7. Try Gemini 2.5 Flash as High-Speed Fallback
    if (geminiKey) {
      const prompt = `You are an expert Automotive Vision AI classifier. Analyze this car photo and return ONLY valid JSON matching this schema exactly:\n${AI_SCHEMA}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: sanitizedMime,
                    data: cleanBase64
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Gemini REST returned ${response.status}`);
      }

      const jsonRes = await response.json();
      const rawText = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (rawText) {
        const cleanedText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        if (parsed.make && parsed.model) {
          return res.status(200).json({
            is_car: parsed.is_car !== false,
            make: parsed.make,
            model: parsed.model,
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
            aftermarket_parts_detected: Array.isArray(parsed.aftermarket_parts_detected) ? parsed.aftermarket_parts_detected : [],
            confidence: parsed.confidence || 0.95,
            needs_better_angle: parsed.needs_better_angle || false,
            angle_instruction: parsed.angle_instruction || null,
            verified_at: new Date().toISOString()
          });
        }
      }
      
      throw new Error('Gemini API request returned unparseable content.');
    }

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error('Hardened Backend Proxy Error:', errorMsg);
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    return res.status(500).json({ 
      error: isProd 
        ? 'AI Vision analysis service temporarily unavailable. Please try again later.' 
        : 'AI Vision Analysis Failed: ' + errorMsg 
    });
  }
}
