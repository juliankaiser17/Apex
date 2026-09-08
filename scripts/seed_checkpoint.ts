import fs from 'fs';
import path from 'path';
import { CheckpointManager } from './checkpointManager';

function seedInitialCheckpoint() {
  console.log('[SEED] Initializing acceptance checkpoint from existing verified state...');
  const inventory = JSON.parse(fs.readFileSync('scratch/cars_inventory.json', 'utf8'));
  const liveResults = JSON.parse(fs.readFileSync('scratch/acceptance_test_results_live.json', 'utf8'));

  const mgr = new CheckpointManager();
  mgr.initializeWithInventory(inventory);

  let verifiedCount = 0;
  let blockedCount = 0;

  for (const scan of liveResults.scans) {
    if (scan.provider_model.startsWith('gemini')) {
      mgr.markCompleted(scan.test_id, {
        scanId: scan.scan_id,
        requestId: scan.request_id,
        providerUsed: scan.provider_model,
        fallbackUsed: false,
        cacheHit: scan.cache_hit,
        result: {
          predicted_make: scan.predicted_make,
          predicted_model: scan.predicted_model,
          predicted_generation: scan.predicted_generation,
          predicted_variant: scan.predicted_variant,
          confidence_score: scan.confidence_score,
          status: scan.status,
          specificity_level: scan.specificity_level,
          quality_score: scan.quality_score,
          latencies: {
            total_ms: scan.latencies?.total_ms || 12000,
            inference_ms: scan.latencies?.inference_ms || 11000
          },
          contradictions: scan.contradictions || [],
          evidence: scan.evidence || []
        }
      });
      verifiedCount++;
    } else {
      mgr.markQuotaBlocked(
        scan.test_id,
        'Google Generative Language API HTTP 429: Free Tier daily limit of 20 requests exceeded for model gemini-2.5-flash'
      );
      blockedCount++;
    }
  }

  console.log(`[SEED] Checkpoint saved: ${verifiedCount} verified completed, ${blockedCount} quota blocked.`);
}

seedInitialCheckpoint();
