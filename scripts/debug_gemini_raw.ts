import fs from 'fs';
import path from 'path';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { GeminiProvider } from '../src/ai-engine/providers/geminiProvider';

async function main() {
  const provider = new GeminiProvider();
  
  // Monkey patch executeGeminiRequest to see raw text
  const original = (provider as any).executeGeminiRequest.bind(provider);
  (provider as any).executeGeminiRequest = async function(model: string, prompt: string, base64Data: string, mimeType: string, timeoutMs: number) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': (provider as any).apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 2000
        }
      })
    });
    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('--- RAW GEMINI OUTPUT ---');
    console.log(rawText);
    console.log('--- END RAW GEMINI OUTPUT ---');
    return original(model, prompt, base64Data, mimeType, timeoutMs);
  };

  const samplePath = path.resolve('Cars/WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const buf = fs.readFileSync(samplePath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

  const res = await provider.identify({
    scanId: 'debug_test',
    traceId: 'debug_trace',
    imageDataUrl: dataUrl,
    candidates: [],
    distinguishingInstructions: []
  });

  console.log('Result Success:', res.success);
  if (!res.success) {
    console.log('Error:', res.error);
  } else {
    console.log('Identified:', res.canonicalResult?.identification);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
