// scripts/daily_vision_canary.mjs
// Phase 4D: Daily Vision Canary Suite.
// Runs ~20 validation split images through the live pipeline to verify provider health,
// latency, circuit breakers, and contract conformance.

import fs from 'fs';
import path from 'path';

async function runCanary() {
  console.log('====================================================');
  console.log('APEX PHASE 4D: DAILY VISION PIPELINE CANARY');
  console.log('====================================================');

  const manifestPath = 'eval/golden/proposed_clean_manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Select 20 representative validation split images
  const valImages = manifest.filter(x => x.split === 'val' && fs.existsSync(x.image_path)).slice(0, 20);
  console.log(`Selected ${valImages.length} validation images for daily canary probe.`);

  const { v2Pipeline } = await import('../src/ai-engine/v2/v2Pipeline.ts');
  const { geminiCircuitBreaker, cloudflareCircuitBreaker } = await import('../src/ai-engine/v2/circuitBreaker.ts');

  const canaryRuns = [];
  let totalLatency = 0;
  let successfulIdentifications = 0;
  let validAbstentions = 0;
  let providerFailures = 0;
  let invalidResponses = 0;

  for (let i = 0; i < valImages.length; i++) {
    const item = valImages[i];
    const tStart = performance.now();
    try {
      const imgBuffer = fs.readFileSync(item.image_path);
      const b64 = imgBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${b64}`;

      const result = await v2Pipeline.execute({
        imageDataUrl: dataUrl
      });

      const elapsed = Math.round(performance.now() - tStart);
      totalLatency += elapsed;

      const outcome = result.adjudicationOutcome || (result.status === 'identified' ? 'successful_identification' : 'valid_abstention');
      if (outcome === 'successful_identification') successfulIdentifications++;
      else if (outcome === 'valid_abstention') validAbstentions++;
      else if (outcome === 'provider_failure') providerFailures++;
      else if (outcome === 'invalid_response') invalidResponses++;

      canaryRuns.push({
        id: item.id,
        groundTruth: item.display_name,
        resultStatus: result.status,
        identifiedVehicle: result.identifiedCar?.displayName || null,
        outcome,
        latencyMs: elapsed
      });
      console.log(`[Canary ${i + 1}/${valImages.length}] ${item.id}: status=${result.status}, outcome=${outcome} (${elapsed}ms)`);
    } catch (err) {
      console.error(`[Canary ${i + 1}/${valImages.length}] ${item.id} ERROR:`, err.message);
      providerFailures++;
      canaryRuns.push({
        id: item.id,
        groundTruth: item.display_name,
        resultStatus: 'error',
        error: err.message
      });
    }
  }

  const avgLatency = Math.round(totalLatency / (valImages.length || 1));
  const canaryReport = {
    timestamp: new Date().toISOString(),
    totalSamples: valImages.length,
    avgLatencyMs: avgLatency,
    metrics: {
      successfulIdentifications,
      validAbstentions,
      providerFailures,
      invalidResponses
    },
    circuitBreakers: {
      gemini: geminiCircuitBreaker.getState(),
      cloudflare: cloudflareCircuitBreaker.getState()
    },
    runs: canaryRuns
  };

  fs.mkdirSync('docs/ai', { recursive: true });
  fs.writeFileSync('docs/ai/canary_log.json', JSON.stringify(canaryReport, null, 2), 'utf8');
  console.log('\nCanary metrics written to docs/ai/canary_log.json.');

  console.log('\n====================================================');
  console.log('CANARY SUMMARY:');
  console.log(`  Total Probes: ${valImages.length}`);
  console.log(`  Avg Latency:  ${avgLatency}ms`);
  console.log(`  Identified:   ${successfulIdentifications}`);
  console.log(`  Abstained:    ${validAbstentions}`);
  console.log(`  Failures:     ${providerFailures}`);
  console.log(`  Circuit Breakers: Gemini=${geminiCircuitBreaker.getState()}, Cloudflare=${cloudflareCircuitBreaker.getState()}`);
  console.log('====================================================\n');
}

runCanary().catch(err => {
  console.error('Fatal canary error:', err);
  process.exit(1);
});
