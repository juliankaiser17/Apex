import fs from 'fs';
import path from 'path';
import { GeminiProvider } from '../src/ai-engine/providers/geminiProvider';

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

async function testReal003() {
  const inventory = JSON.parse(fs.readFileSync('scratch/cars_inventory.json', 'utf8'));
  const item = inventory.find((x: any) => x.test_id === 'REAL_003');
  console.log('Testing REAL_003:', item);
  const buf = fs.readFileSync('Cars/' + item.original_filename);
  const dataUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
  console.log('Data URL length:', dataUrl.length);

  const gemini = new GeminiProvider();
  console.log('Sending REAL_003 to GeminiProvider...');
  const tStart = Date.now();
  try {
    const res = await gemini.identify({
      scanId: 'diag_real_003',
      traceId: 'trc_diag_003',
      imageDataUrl: dataUrl,
      candidates: [],
      distinguishingInstructions: []
    });
    console.log(`Finished in ${Date.now() - tStart} ms`);
    console.log('Result Success:', res.success);
    console.log('Model Used:', res.modelUsed);
    console.log('Error Type:', res.errorType);
    console.log('Error Message:', res.error);
    console.log('Canonical Identification:', res.canonicalResult?.identification);
    console.log('Canonical Status:', res.canonicalResult?.status);
  } catch (err: any) {
    console.error('Thrown exception:', err);
  }
}

testReal003().catch(console.error);
