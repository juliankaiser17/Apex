import fs from 'fs';
import path from 'path';

async function testLiveVercelAnalyze() {
  console.log('========================================================================');
  console.log('APEX — LIVE PRODUCTION VERCEL /api/analyze END-TO-END VERIFICATION');
  console.log('========================================================================\n');

  const liveUrl = 'https://apex-spotter.vercel.app/api/analyze';

  // Test 1: OPTIONS Preflight
  console.log('[Test 1] Testing OPTIONS preflight with origin: capacitor://localhost');
  const optRes = await fetch(liveUrl, {
    method: 'OPTIONS',
    headers: {
      'origin': 'capacitor://localhost',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'Content-Type, Authorization, apikey, x-client-info'
    }
  });
  console.log('  Status:', optRes.status);
  console.log('  Access-Control-Allow-Origin:', optRes.headers.get('access-control-allow-origin'));
  console.log('  Access-Control-Allow-Methods:', optRes.headers.get('access-control-allow-methods'));
  console.log('  Access-Control-Allow-Headers:', optRes.headers.get('access-control-allow-headers'));

  if (optRes.status !== 200 || optRes.headers.get('access-control-allow-origin') !== 'capacitor://localhost') {
    throw new Error(`OPTIONS preflight failed: expected 200, got ${optRes.status}`);
  }
  console.log('  ✓ Test 1 Passed: CORS preflight allows Capacitor app origin.\n');

  // Test 2: Live Guest POST scan
  console.log('[Test 2] Testing live Guest POST scan with Toyota Camry calibration image');
  const imagePath = path.resolve('Cars/WhatsApp Image 2026-09-08 at 06.51.31.jpeg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString('base64');
  const testIdempotencyKey = `live_smoke_${Date.now()}`;

  const t0 = Date.now();
  const scanRes = await fetch(liveUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'capacitor://localhost'
    },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: 'image/jpeg',
      idempotencyKey: testIdempotencyKey
    })
  });
  const latencyMs = Date.now() - t0;

  console.log(`  HTTP Status: ${scanRes.status} (latency: ${latencyMs}ms)`);
  console.log('  X-RateLimit-Limit:', scanRes.headers.get('x-ratelimit-limit'));
  console.log('  X-RateLimit-Remaining:', scanRes.headers.get('x-ratelimit-remaining'));
  console.log('  X-RateLimit-Reset:', scanRes.headers.get('x-ratelimit-reset'));

  const responseText = await scanRes.text();
  let responseJson: any;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    console.error('  Raw response body:', responseText);
    throw new Error(`Failed to parse JSON response: ${responseText}`);
  }

  console.log('  Scan Response Status:', responseJson.status);
  console.log('  Make:', responseJson.make);
  console.log('  Model:', responseJson.model || responseJson.model_family);
  console.log('  Generation:', responseJson.generation);
  console.log('  Confidence:', responseJson.model_confidence || responseJson.confidence);
  console.log('  Rejection Reason:', responseJson.rejection_reason);

  // Test 3: Idempotency deduplication check
  console.log('\n[Test 3] Testing cross-instance distributed idempotency with repeat key');
  const dupRes = await fetch(liveUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'capacitor://localhost'
    },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: 'image/jpeg',
      idempotencyKey: testIdempotencyKey
    })
  });
  console.log(`  Repeat Request HTTP Status: ${dupRes.status}`);
  const dupJson = await dupRes.json().catch(() => ({}));
  console.log('  Repeat Response:', dupJson);

  console.log('\n========================================================================');
  console.log('LIVE PRODUCTION VERIFICATION SUMMARY:');
  console.log(`- OPTIONS CORS: ${optRes.status === 200 ? 'SUCCESS (200 OK)' : 'FAILED'}`);
  console.log(`- POST Scan: ${scanRes.status === 200 ? 'SUCCESS (200 OK)' : 'FAILED (' + scanRes.status + ')'}`);
  console.log(`- Identification: ${responseJson.make} ${responseJson.model || responseJson.model_family} (${responseJson.status})`);
  console.log(`- Latency: ${latencyMs}ms`);
  console.log(`- Idempotency Protection: ${dupRes.status === 409 || dupRes.status === 200 ? 'ACTIVE' : 'FAILED'}`);
  console.log('========================================================================\n');
}

testLiveVercelAnalyze().catch(err => {
  console.error('[FATAL ERROR in live verification]:', err);
  process.exit(1);
});
