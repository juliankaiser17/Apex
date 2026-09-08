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

const apiKey = process.env.GEMINI_API_KEY!;

async function testWithThinkingBudget(budget: number) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const buf = fs.readFileSync('Cars/WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const base64Data = buf.toString('base64');
  
  const code = fs.readFileSync('src/ai-engine/providers/geminiProvider.ts', 'utf8');
  const promptStart = code.indexOf('const pass1Prompt = `');
  const promptEnd = code.indexOf('`;', promptStart);
  const prompt = code.substring(promptStart + 'const pass1Prompt = `'.length, promptEnd);

  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingBudget: budget
        }
      }
    })
  });

  const dur = Math.round(performance.now() - t0);
  const json = await res.json();
  console.log(`[Budget ${budget}] Status:`, res.status, `in ${dur} ms`);
  if (!res.ok) {
    console.log('Error:', JSON.stringify(json));
    return;
  }
  console.log('Usage metadata:', json?.usageMetadata);
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Raw text length:', rawText?.length);
  try {
    const parsed = JSON.parse(rawText);
    console.log('Parsed Identification:', parsed.identification);
    console.log('Parsed Status:', parsed.status);
  } catch (e: any) {
    console.log('JSON.parse Error:', e.message);
  }
}

async function main() {
  // Test thinkingBudget: 0 (or 512)
  console.log('Testing thinkingBudget: 0...');
  await testWithThinkingBudget(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
