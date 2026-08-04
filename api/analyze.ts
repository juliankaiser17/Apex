import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  // Use environment variables WITHOUT VITE_ prefix to keep them strictly server-side (but support VITE_ fallback if user pasted it that way)
  const openAiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!openAiKey && !geminiKey) {
    return res.status(503).json({ error: 'No API keys configured on the server.' });
  }

  try {
    // 1. Try OpenAI First
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
                { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
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
            return res.status(200).json(parsed);
          }
        }
      }
      
      // If OpenAI fails but we have Gemini, we'll fall through. Otherwise, throw.
      if (!geminiKey) {
        throw new Error('OpenAI API request failed or returned invalid data.');
      }
    }

    // 2. Try Gemini using REST API to avoid SDK credential parsing bugs
    if (geminiKey) {
      const prompt = `You are an expert Automotive Vision AI classifier. Analyze this car photo and return ONLY valid JSON matching this schema exactly:\n${AI_SCHEMA}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: imageBase64
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
          return res.status(200).json(parsed);
        }
      }
      
      throw new Error('Gemini API request failed or returned invalid data.');
    }

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error('Backend Proxy Error:', errorMsg);
    return res.status(500).json({ error: 'AI Analysis Failed on Backend: ' + errorMsg });
  }
}
