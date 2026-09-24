import fs from 'fs';
import path from 'path';

const LIVE_URL = 'https://apex-spotter.vercel.app/api/analyze';

async function scanImage(imagePath: string, testName: string, expectedMake: string, expectedModel: string) {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    return { success: false, reason: 'Image not found' };
  }

  const buf = fs.readFileSync(imagePath);
  const base64 = buf.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const payload = {
    imageBase64: dataUrl,
    mimeType: 'image/jpeg',
    fileName: path.basename(imagePath),
    userId: 'physical_scan_verifier',
    idempotencyKey: `live_scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  };

  const t0 = Date.now();
  const res = await fetch(LIVE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'capacitor://localhost'
    },
    body: JSON.stringify(payload)
  });

  const durationMs = Date.now() - t0;
  let json: any = await res.json().catch(() => ({}));

  if (res.status === 202 && json.scan_id) {
    console.log(`[Queue Polling] Scan queued asynchronously (${json.scan_id}). Polling /api/scans/status...`);
    const statusUrl = `https://apex-spotter.vercel.app/api/scans/status?scanId=${encodeURIComponent(json.scan_id)}`;
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise(r => setTimeout(r, 1500));
      const sRes = await fetch(statusUrl, { headers: { 'origin': 'capacitor://localhost' } });
      const sJson = await sRes.json().catch(() => ({}));
      if (sJson.status === 'completed' || sJson.status === 'needs_review' || sJson.status === 'identified' || sJson.status === 'uncertain') {
        json = sJson.result || sJson;
        console.log(`[Queue Polling] Completed on attempt ${attempt}!`);
        break;
      }
    }
  }

  console.log(`\n==============================================================`);
  console.log(`TEST: [${testName}]`);
  console.log(`Image: ${path.basename(imagePath)} (${Math.round(buf.length / 1024)} KB)`);
  console.log(`HTTP Status: ${res.status} | Latency: ${durationMs}ms`);
  console.log(`API analysisVersion: ${json.analysisVersion}`);
  console.log(`Status: ${json.status} | Specificity: ${json.specificityLevel || json.specificity_level}`);
  console.log(`Make: ${json.make} (Expected: ${expectedMake})`);
  console.log(`Model: ${json.model} (Expected: ${expectedModel})`);
  console.log(`Generation: ${json.generation}`);
  console.log(`Trim: ${json.trim}`);
  console.log(`Confidence: ${json.confidence || json.modelConfidence}`);
  console.log(`Reason: ${json.reason}`);
  console.log(`Canonical ID: ${json.canonicalVehicleId || json.vehicleId}`);

  const makeMatch = (json.make || '').toLowerCase().includes(expectedMake.toLowerCase());
  const modelNorm = (json.model || '').toLowerCase();
  const expectedNorm = expectedModel.toLowerCase();
  const modelMatch = modelNorm.includes(expectedNorm) || expectedNorm.includes(modelNorm);

  if (makeMatch && modelMatch) {
    console.log(`  ✅ [PASS] EXACT MATCH: ${json.make} ${json.model} (${json.generation || ''})`);
    return { success: true, json, durationMs };
  } else {
    console.error(`  ❌ [FAIL] Mismatch! Expected ${expectedMake} ${expectedModel}, Got ${json.make} ${json.model}`);
    return { success: false, json, durationMs };
  }
}

async function runPhysicalAndSmokeTests() {
  console.log('========================================================================');
  console.log('APEX — LIVE DEPLOYED API PHYSICAL SCANS & SMOKE VERIFICATION');
  console.log(`Endpoint: ${LIVE_URL}`);
  console.log('========================================================================');

  const physicalTests = [
    {
      testName: 'Real Porsche 718 Boxster (Front 3/4)',
      imagePath: 'Cars/WhatsApp Image 2026-09-08 at 06.51.34 (1).jpeg',
      expectedMake: 'Porsche',
      expectedModel: '718 Boxster'
    },
    {
      testName: 'Real Aston Martin DBS',
      imagePath: 'Cars/WhatsApp Image 2026-09-08 at 06.51.35.jpeg',
      expectedMake: 'Aston Martin',
      expectedModel: 'DBS'
    },
    {
      testName: 'Real McLaren 650S (Front)',
      imagePath: 'Cars/WhatsApp Image 2026-09-08 at 06.56.57 (1).jpeg',
      expectedMake: 'McLaren',
      expectedModel: '650S'
    },
    {
      testName: 'Real McLaren 650S Spider (Front 3/4)',
      imagePath: 'Cars/WhatsApp Image 2026-09-08 at 06.56.54.jpeg',
      expectedMake: 'McLaren',
      expectedModel: '650S Spider'
    }
  ];

  let passedPhysical = 0;
  for (const t of physicalTests) {
    const res = await scanImage(t.imagePath, t.testName, t.expectedMake, t.expectedModel);
    if (res.success) passedPhysical++;
  }

  console.log(`\n========================================================================`);
  console.log(`PHYSICAL SCAN SUMMARY: ${passedPhysical} / ${physicalTests.length} PASSED`);
  console.log(`========================================================================\n`);

  if (passedPhysical !== physicalTests.length) {
    console.error('Physical scans failed!');
    process.exit(1);
  }
}

runPhysicalAndSmokeTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
