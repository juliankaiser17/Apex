import fs from 'fs';
import path from 'path';
import { GeminiProvider } from '../src/ai-engine/providers/geminiProvider';
import { aiProviderRouter } from '../src/ai-engine/providers/providerRouter';
import { apexEngine } from '../src/ai-engine/engine';

// Ensure .env is parsed if not loaded by runner
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

async function runPreflight() {
  console.log('====================================================');
  console.log('PREFLIGHT VERIFICATION: REAL GEMINI VISION PROVIDER');
  console.log('====================================================');

  // Check 1: GEMINI_API_KEY present in runtime
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyPresent = Boolean(apiKey && apiKey.trim().length > 10);
  console.log(`[CHECK 1] GEMINI_API_KEY present: ${isKeyPresent} (character count: ${apiKey ? apiKey.length : 0})`);
  if (!isKeyPresent) {
    console.error('FATAL: GEMINI_API_KEY is not configured in the runtime environment.');
    process.exit(1);
  }

  // Check 2: geminiProvider.isAvailable === true
  const geminiProvider = new GeminiProvider();
  const isAvailable = await geminiProvider.isAvailable();
  console.log(`[CHECK 2] geminiProvider.isAvailable === ${isAvailable}`);
  if (!isAvailable) {
    console.error('FATAL: geminiProvider.isAvailable returned false.');
    process.exit(1);
  }

  // Check 3: providerRouter selects Gemini
  const activeProvider = await aiProviderRouter.getActiveProviderName();
  console.log(`[CHECK 3] providerRouter active provider: ${activeProvider}`);
  if (activeProvider !== 'GeminiProvider') {
    console.error(`FATAL: providerRouter selected ${activeProvider} instead of GeminiProvider.`);
    process.exit(1);
  }

  // Check 4: Harmless test request to Gemini API
  console.log('[CHECK 4] Sending test image to Gemini provider via aiProviderRouter...');
  const testImagePath = path.resolve('Cars', 'WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const imgBuf = fs.readFileSync(testImagePath);
  const dataUrl = `data:image/jpeg;base64,${imgBuf.toString('base64')}`;

  const tStart = Date.now();
  const response = await aiProviderRouter.routeIdentification({
    scanId: 'preflight_scan_001',
    traceId: 'preflight_trace_001',
    imageDataUrl: dataUrl,
    candidates: [],
    distinguishingInstructions: []
  });
  const latency = Date.now() - tStart;

  console.log(`Response received in ${latency} ms:`);
  console.log(`  - Success: ${response.success}`);
  console.log(`  - Model Used: ${response.modelUsed}`);
  console.log(`  - Make: ${response.canonicalResult?.identification.make}`);
  console.log(`  - Model: ${response.canonicalResult?.identification.model_family}`);
  console.log(`  - Status: ${response.canonicalResult?.status}`);
  console.log(`  - Viewpoint: ${response.canonicalResult?.viewpoint}`);

  const isGeminiModel = response.modelUsed.startsWith('gemini');
  const isNotFallback = !response.modelUsed.includes('fallback') && !response.modelUsed.includes('embedded');

  if (!response.success || !isGeminiModel || !isNotFallback) {
    console.error('FATAL: Route identification failed or used fallback provider.');
    process.exit(1);
  }

  // Check 5: apexEngine.ingestScan() execution verification
  console.log('[CHECK 5] Testing apexEngine.ingestScan() integration...');
  const ingestResult = await apexEngine.ingestScan({
    imageDataUrl: dataUrl,
    userId: 'preflight_user',
    fileName: 'REAL_PREFLIGHT.jpeg'
  });
  console.log(`  - Ingest Status: ${ingestResult.status}`);
  console.log(`  - Scan ID: ${ingestResult.scanId}`);

  // Wait for worker pool to complete the job
  let completed = false;
  for (let i = 0; i < 60; i++) {
    const jobStatus = apexEngine.getScanStatus(ingestResult.scanId);
    if (jobStatus.status === 'completed' || jobStatus.status === 'abstained') {
      console.log(`  - Completed Job Status: ${jobStatus.status}`);
      console.log(`  - Identified: ${jobStatus.result?.make} ${jobStatus.result?.model} (${jobStatus.result?.generation || 'N/A'})`);
      completed = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!completed) {
    console.error('FATAL: apexEngine.ingestScan() did not complete in time.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('ALL PREFLIGHT CHECKS PASSED: GEMINI IS READY & ACTIVE');
  console.log('====================================================');
}

runPreflight().catch((err) => {
  console.error('Preflight error:', err);
  process.exit(1);
});
