import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

interface ScanEvaluation {
  label: string;
  dimensions: string;
  fileSize: number;
  sha256: string;
  vlmObservations: any;
  finalMake: string;
  finalModel: string | null;
  specificity: string;
  status: string;
  canonicalId: string | null;
}

async function preprocessOld(buf: Buffer): Promise<{ dataUrl: string; buf: Buffer; width: number; height: number }> {
  const resized = await sharp(buf)
    .resize(768, 768, { fit: 'inside' })
    .jpeg({ quality: 82 })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  return {
    dataUrl: `data:image/jpeg;base64,${resized.toString('base64')}`,
    buf: resized,
    width: meta.width || 768,
    height: meta.height || 431
  };
}

async function preprocessNew(buf: Buffer): Promise<{ dataUrl: string; buf: Buffer; width: number; height: number; bypassed: boolean }> {
  const meta = await sharp(buf).metadata();
  const maxSide = Math.max(meta.width || 0, meta.height || 0);

  // BYPASS logic identical to ScannerModal.tsx
  if (maxSide <= 1600 && buf.length < 2500000) {
    return {
      dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
      buf,
      width: meta.width || 0,
      height: meta.height || 0,
      bypassed: true
    };
  }

  const resized = await sharp(buf)
    .resize(1600, 1600, { fit: 'inside' })
    .jpeg({ quality: 90 })
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  return {
    dataUrl: `data:image/jpeg;base64,${resized.toString('base64')}`,
    buf: resized,
    width: resizedMeta.width || 1600,
    height: resizedMeta.height || 900,
    bypassed: false
  };
}
async function callLiveApi(dataUrl: string, label: string): Promise<any> {
  const endpoint = 'https://apex-spotter.vercel.app/api/analyze';
  const idempotencyKey = `qa_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  console.log(`[DISPATCH] Calling live Vercel for ${label}...`);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const t0 = performance.now();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'capacitor://localhost'
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: 'image/jpeg',
          fileName: 'scan.jpg',
          idempotencyKey
        })
      });
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[RESPONSE] ${label} returned HTTP ${res.status} in ${elapsed}ms`);
      const json = await res.json();

      if (res.status === 202 && (json.scan_id || json.scanId)) {
        const scanId = json.scan_id || json.scanId;
        console.log(`[ASYNC QUEUE] Job ${scanId} enqueued for ${label}. Polling status...`);
        const statusUrl = `https://apex-spotter.vercel.app/api/scans/status?scanId=${encodeURIComponent(scanId)}`;
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            const sRes = await fetch(statusUrl);
            if (!sRes.ok) continue;
            const sBody = await sRes.json();
            if (sBody.status === 'completed' || sBody.status === 'needs_review') {
              console.log(`[ASYNC COMPLETE] Job ${scanId} finished with status ${sBody.status}`);
              return sBody.result || sBody;
            }
            if (sBody.status === 'abstained' || sBody.status === 'rejected' || sBody.status === 'failed') {
              console.log(`[ASYNC FINISHED] Job ${scanId} finished with status ${sBody.status}`);
              return sBody.result || sBody;
            }
          } catch (e) {
            // retry polling
          }
        }
      }

      return json;
    } catch (err: any) {
      console.warn(`[WARN] ${label} attempt ${attempt} error: ${err?.message}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 3000));
      } else {
        return {
          status: 'error',
          error: err?.message,
          make: 'Unknown Make',
          model: null
        };
      }
    }
  }
}

async function main() {
  console.log('========================================================================');
  console.log('APEX — FINAL CAMERA PREPROCESSING HOTFIX REGRESSION');
  console.log('========================================================================\n');

  const daytonaPath = '_gt/daytona_sp3_real.jpg';
  const originalBuf = fs.readFileSync(daytonaPath);
  const origMeta = await sharp(originalBuf).metadata();

  // A. Original 2510x1411
  const origSha = crypto.createHash('sha256').update(originalBuf).digest('hex');
  const origDataUrl = `data:image/jpeg;base64,${originalBuf.toString('base64')}`;

  // B. Old 768x431
  const oldProcessed = await preprocessOld(originalBuf);
  const oldSha = crypto.createHash('sha256').update(oldProcessed.buf).digest('hex');

  // C. New Preprocessing (1600 max dimension, q90)
  const newProcessed = await preprocessNew(originalBuf);
  const newSha = crypto.createHash('sha256').update(newProcessed.buf).digest('hex');

  const evaluations: ScanEvaluation[] = [];

  // Run B first (Old preprocessing)
  console.log('--- TEST B: Old 768x431 Preprocessing ---');
  const resB = await callLiveApi(oldProcessed.dataUrl, 'B (Old 768px)');
  evaluations.push({
    label: 'B (Old 768x431 Preprocessing)',
    dimensions: `${oldProcessed.width}x${oldProcessed.height}`,
    fileSize: oldProcessed.buf.length,
    sha256: oldSha,
    vlmObservations: {
      grille: resB.visual_evidence?.grille,
      headlights: resB.visual_evidence?.headlights,
      body: resB.visual_evidence?.body_style
    },
    finalMake: resB.make || resB.identification?.make || 'Unknown Make',
    finalModel: resB.model || resB.identification?.model_family || null,
    specificity: resB.specificity_level || resB.canonical_identity?.specificityLevel || 'none',
    status: resB.status,
    canonicalId: resB.canonical_vehicle_id || resB.canonical_identity?.canonicalId || null
  });

  console.log('\n[COOLDOWN] Waiting 5 seconds before Test C...');
  await new Promise(r => setTimeout(r, 5000));

  // Run C (New Preprocessing)
  console.log('\n--- TEST C: New Preprocessing (1600px, q90) ---');
  const resC = await callLiveApi(newProcessed.dataUrl, 'C (New 1600px Preprocessing)');
  evaluations.push({
    label: 'C (New Preprocessing)',
    dimensions: `${newProcessed.width}x${newProcessed.height}`,
    fileSize: newProcessed.buf.length,
    sha256: newSha,
    vlmObservations: {
      grille: resC.visual_evidence?.grille,
      headlights: resC.visual_evidence?.headlights,
      body: resC.visual_evidence?.body_style
    },
    finalMake: resC.make || resC.identification?.make || 'Unknown Make',
    finalModel: resC.model || resC.identification?.model_family || null,
    specificity: resC.specificity_level || resC.canonical_identity?.specificityLevel || 'none',
    status: resC.status,
    canonicalId: resC.canonical_vehicle_id || resC.canonical_identity?.canonicalId || null
  });

  console.log('\n[COOLDOWN] Waiting 5 seconds before Test A...');
  await new Promise(r => setTimeout(r, 5000));

  // Run A (Original 2510x1411 reference)
  console.log('\n--- TEST A: Original 2510x1411 Direct ---');
  const resA = await callLiveApi(origDataUrl, 'A (Original 2510x1411)');
  evaluations.push({
    label: 'A (Original Direct Reference)',
    dimensions: `${origMeta.width}x${origMeta.height}`,
    fileSize: originalBuf.length,
    sha256: origSha,
    vlmObservations: {
      grille: resA.visual_evidence?.grille,
      headlights: resA.visual_evidence?.headlights,
      body: resA.visual_evidence?.body_style
    },
    finalMake: resA.make || resA.identification?.make || 'Unknown Make',
    finalModel: resA.model || resA.identification?.model_family || null,
    specificity: resA.specificity_level || resA.canonical_identity?.specificityLevel || 'none',
    status: resA.status,
    canonicalId: resA.canonical_vehicle_id || resA.canonical_identity?.canonicalId || null
  });

  console.log('\n========================================================================');
  console.log('DAYTONA PREPROCESSING COMPARISON SUMMARY:');
  console.log('========================================================================');
  console.table(evaluations.map(e => ({
    Configuration: e.label,
    Dimensions: e.dimensions,
    'Size (Bytes)': e.fileSize,
    'SHA-256': e.sha256.substring(0, 12) + '...',
    'Status': e.status,
    'Make': e.finalMake,
    'Model': e.finalModel || '(null - Unidentified)',
    'Specificity': e.specificity,
    'Canonical ID': e.canonicalId || '(none)'
  })));

  // Detailed VLM Observations
  console.log('\nDetailed Observations:');
  evaluations.forEach(e => {
    console.log(`\n[${e.label}]`);
    console.log(`- Dimensions: ${e.dimensions} (${e.fileSize} bytes, SHA-256: ${e.sha256})`);
    console.log(`- Grille evidence: "${e.vlmObservations?.grille || 'none'}"`);
    console.log(`- Headlight evidence: "${e.vlmObservations?.headlights || 'none'}"`);
    console.log(`- Result: ${e.finalMake} ${e.finalModel || 'Unidentified'} | Status: ${e.status} | Canonical: ${e.canonicalId}`);
  });

  // Cross-Manufacturer Sanity Checks
  console.log('\n========================================================================');
  console.log('CROSS-MANUFACTURER SANITY SUITE (WITH NEW PREPROCESSING):');
  console.log('========================================================================');

  const sanityTargets = [
    { name: 'Koenigsegg Jesko Attack', file: 'scratch/koenigsegg_jesko.jpg' },
    { name: 'Porsche 911 (997)', file: 'public/spot_porsche997.jpg' },
    { name: 'Ferrari 458 Italia', file: 'public/spot_ferrari458.jpg' },
    { name: 'Ferrari SF90 Stradale', file: '_gt/sf90.jpg' },
    { name: 'Ferrari 296 GTB', file: 'scratch/real_296_gtb.jpg' }
  ];

  for (const target of sanityTargets) {
    if (!fs.existsSync(target.file)) {
      console.warn(`Skipping missing fixture: ${target.file}`);
      continue;
    }
    console.log(`\n[COOLDOWN] Waiting 4 seconds before ${target.name}...`);
    await new Promise(r => setTimeout(r, 4000));

    const tBuf = fs.readFileSync(target.file);
    const tProcessed = await preprocessNew(tBuf);
    const tRes = await callLiveApi(tProcessed.dataUrl, target.name);
    console.log(`[SANITY RESULT] ${target.name}:`, {
      status: tRes.status,
      make: tRes.make || tRes.identification?.make,
      model: tRes.model || tRes.identification?.model_family,
      canonicalId: tRes.canonical_vehicle_id || tRes.canonical_identity?.canonicalId,
      dimensions: `${tProcessed.width}x${tProcessed.height}`,
      bypassed: tProcessed.bypassed
    });
  }
}

main().catch(console.error);
