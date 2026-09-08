import fs from 'fs';
import path from 'path';

// Load .env if present
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
import { aiProviderRouter } from '../src/ai-engine/providers/providerRouter';

async function preflight() {
  console.log('--- PREFLIGHT CHECK ---');
  const keyPresent = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  console.log('1. GEMINI_API_KEY present in runtime:', keyPresent);

  const provider = new GeminiProvider();
  const available = await provider.isAvailable();
  console.log('2. geminiProvider.isAvailable():', available);

  const routerConfig = aiProviderRouter.getConfig();
  console.log('3. providerRouter configured provider:', routerConfig.providerName, 'primary model:', routerConfig.primaryModel);

  // Read a real test image from Cars/
  const samplePath = path.resolve('Cars/WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const buf = fs.readFileSync(samplePath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

  console.log('4. Testing aiProviderRouter.routeIdentification to ensure Gemini is selected over MockFallbackProvider...');
  const t0 = performance.now();
  const res = await aiProviderRouter.routeIdentification({
    scanId: 'preflight_test',
    traceId: 'preflight_trace',
    imageDataUrl: dataUrl,
    candidates: [],
    distinguishingInstructions: []
  });
  const dur = Math.round(performance.now() - t0);

  console.log('   Response Success:', res.success);
  console.log('   Provider Name:', res.providerName);
  console.log('   Model Used:', res.modelUsed);
  console.log('   Duration:', dur, 'ms');
  console.log('   Tokens Consumed:', res.tokensConsumed);

  if (!res.success) {
    console.error('   Error details:', res.error);
    process.exit(1);
  }

  if (res.modelUsed.includes('fallback') || res.modelUsed.includes('embedded')) {
    console.error('   [FAIL] providerRouter selected MockFallbackProvider instead of Gemini!');
    process.exit(1);
  }

  console.log('   Identified Make:', res.canonicalResult?.identification?.make);
  console.log('   Identified Model:', res.canonicalResult?.identification?.model_family);
  console.log('   Status:', res.canonicalResult?.status);
  console.log('   Viewpoint:', res.canonicalResult?.viewpoint);
  console.log('--- PREFLIGHT PASSED: REAL GEMINI IS AUTHORITATIVE ---');
}

preflight().catch((err) => {
  console.error('Preflight exception:', err);
  process.exit(1);
});
