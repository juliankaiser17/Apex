import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function apexVisionApiPlugin() {
  return {
    name: 'apex-vision-api',
    configureServer(server: any) {
      server.middlewares.use('/api/analyze', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed: Must be POST.' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { imageBase64, mimeType } = JSON.parse(body || '{}');
            const env = loadEnv('', process.cwd(), '');
            const geminiKey = (env.GEMINI_API_KEY || '').trim();

            if (!geminiKey) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No AI vision API key configured in .env' }));
              return;
            }

            const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

            const promptText = `You are the APEX Master Automotive Vision Classifier.
Identify the vehicle in this image using strict observable evidence. Every scan is completely independent.
RULES:
1. First describe observable evidence (grille, headlights, body style). If unobservable from angle, set to null.
2. NON-CAR, BUS & COMMERCIAL VEHICLES:
   - If non-car (person, food, document, pet), set "vehicle_present": false, "status": "rejected", "rejection_reason": "No motor vehicle detected in frame."
   - If public transit bus, coach, commercial semi-truck, or heavy fleet vehicle, set "vehicle_present": false, "status": "rejected", "rejection_reason": "Commercial public transport or heavy vehicle detected; not a consumer passenger automobile."
   - If a commercial taxi / cab (marked with rooftop light or taxi livery), identify consumer make/model family ONLY if clearly identifiable, set "variant": null, and set status "probable" or "uncertain". NEVER identify a taxi as a track-focused sports car or exotic trim! If model is ambiguous, set "status": "uncertain".
3. Identify Make, Model Family, Generation. Only specify Variant if visible distinct proof exists. If not visible or uncertain, variant must be null and status "uncertain".
4. Never suggest impossible architecture contradicting observable evidence.
5. If evidence is ambiguous, abstain with "status": "uncertain" rather than guessing.
Return strict JSON matching this schema:
{
  "status": "identified | probable | uncertain | rejected",
  "vehicle_present": true,
  "rejection_reason": null,
  "image_quality": { "usable": true, "score": 0.85, "issues": [] },
  "viewpoint": "front_3q | front | rear | side | rear_3q | interior | partial | unknown",
  "visual_evidence": {
    "body_style": "<e.g. Coupe, Sedan, SUV, Convertible, Hatchback, Wagon, Truck>",
    "grille": "<observable grille architecture or null>",
    "headlights": "<observable headlights or null>",
    "taillights": "<observable taillights or null>",
    "hood": "<observable hood or null>",
    "roofline": "<observable roofline or null>",
    "windows": "<observable windows or null>",
    "wheels": "<observable wheels or null>",
    "exhaust": "<observable exhaust or null>",
    "aero": "<observable aero or null>",
    "badges": "<observable emblem or null>",
    "text": "<observable text or null>",
    "body_proportions": "<proportions description or null>",
    "distinctive_details": ["<detail 1>", "<detail 2>"]
  },
  "identification": {
    "make": "<Manufacturer name, or null>",
    "model_family": "<Model family name, or null>",
    "generation": "<Generation/chassis code, or null>",
    "variant": "<Trim only if visibly proven, otherwise null>"
  },
  "confidence": { "make_score": 0.90, "model_score": 0.80, "generation_score": 0.70, "variant_score": 0.30, "overall_score": 0.80 },
  "candidates": [{ "name": "<Candidate 1 Name>", "score": 0.85, "supporting_evidence": ["<evidence>"], "contradictions": [] }],
  "contradictions": [],
  "specificity_level": "variant | generation | model_family | make",
  "reason": "<Defensible explanation based on evidence>",
  "needs_retake": false,
  "specs": { "color": "<exterior color>", "year_estimate": "<year>", "rarity": "common | uncommon | rare | epic | legendary | mythic", "body_style": "<body style>", "engine": "<engine>", "horsepower": 300, "torque_nm": 400, "top_speed_kmh": 250, "zero_to_hundred_seconds": 4.5, "kerb_weight_kg": 1500, "production_years": "<years>", "origin_country": "<country>", "historical_information": "<history>", "interesting_facts": "<facts>" }
}`;

            const gRes = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: promptText },
                      {
                        inlineData: {
                          mimeType: mimeType || 'image/jpeg',
                          data: cleanBase64
                        }
                      }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                  maxOutputTokens: 1200
                }
              })
            });

            if (gRes.ok) {
              const gJson: any = await gRes.json();
              const raw = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (raw) {
                let cleaned = raw.trim();
                if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
                else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
                if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

                const parsed = JSON.parse(cleaned.trim());
                const specs = parsed.specs || {};
                const ident = parsed.identification || {};

                const payload = {
                  status: parsed.status || 'identified',
                  vehicle_present: parsed.vehicle_present ?? true,
                  image_quality: parsed.image_quality || { usable: true, score: 0.92, issues: [] },
                  viewpoint: parsed.viewpoint || 'unknown',
                  visual_evidence: parsed.visual_evidence || null,
                  identification: ident,
                  confidence: parsed.confidence || { make_score: 0.9, model_score: 0.85, generation_score: 0.8, variant_score: 0.5, overall_score: 0.85 },
                  candidates: parsed.candidates || [],
                  contradictions: parsed.contradictions || [],
                  specificity_level: parsed.specificity_level || 'model_family',
                  reason: parsed.reason || 'Identified',
                  needs_retake: parsed.needs_retake ?? false,
                  is_car: parsed.vehicle_present ?? true,
                  scan_id: `scan_${Date.now()}`,
                  make: ident.make || 'Unknown Make',
                  model: ident.model_family || 'Unknown Model',
                  generation: ident.generation || 'Current',
                  trim: ident.variant || null,
                  year_estimate: String(specs.year_estimate || '2023'),
                  color: specs.color || 'Silver',
                  rarity: specs.rarity || 'rare',
                  engine: specs.engine || 'High-Output Engine',
                  horsepower: specs.horsepower || 300,
                  torque_nm: specs.torque_nm || 400,
                  top_speed_kmh: specs.top_speed_kmh || 250,
                  zero_to_hundred_seconds: specs.zero_to_hundred_seconds || 4.2,
                  kerb_weight_kg: specs.kerb_weight_kg || 1500,
                  production_years: specs.production_years || '2020–Present',
                  origin_country: specs.origin_country || 'Global',
                  body_style: specs.body_style || 'Coupe',
                  historical_information: specs.historical_information || '',
                  interesting_facts: specs.interesting_facts || '',
                  aftermarket_parts_detected: [],
                  needs_better_angle: parsed.status === 'uncertain' || parsed.needs_retake,
                  angle_instruction: parsed.reason || null
                };

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
                return;
              }
            }

            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'AI Vision classification failed' }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apexVisionApiPlugin()],
    server: {
      host: true,
      port: 5173
    }
  };
});
