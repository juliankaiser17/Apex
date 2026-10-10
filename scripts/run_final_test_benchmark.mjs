// scripts/run_final_test_benchmark.mjs
// Phase 11: Single-Shot Test Split Benchmark & Final Release-Gate Evaluation.
// STRICT INVARIANT: Must not be executed until Gate G5 is approved by project owner.

import fs from 'fs';
import path from 'path';

// ─── GATE G5 ENFORCEMENT GUARD ───
if (process.env.GATE_G5_APPROVED !== 'true') {
  console.error('\n====================================================================');
  console.error('⛔ CRITICAL GATE G5 ENFORCEMENT: Held-Out Test Split Benchmark Locked');
  console.error('====================================================================');
  console.error('The held-out test split (n=248) is strictly frozen to preserve clean');
  console.error('generalization and prevent benchmark tuning or selection bias.');
  console.error('\nStanding Rules Require:');
  console.error('1. All development and prompt tuning on dev split only.');
  console.error('2. Model and threshold selection on validation split only.');
  console.error('3. Explicit owner approval recorded in OWNER_DECISIONS.md under [Gate G5].');
  console.error('\nOnce Gate G5 sign-off is completed, execute:');
  console.error('  $env:GATE_G5_APPROVED="true"; node scripts/run_final_test_benchmark.mjs');
  console.error('====================================================================\n');
  process.exit(2);
}

// ─── HELPER: Wilson Score 95% Confidence Interval ───
function wilsonInterval(successes, total, z = 1.96) {
  if (total === 0) return { center: 0, lower: 0, upper: 0 };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return {
    center: Number((center * 100).toFixed(1)),
    lower: Number((Math.max(0, center - margin) * 100).toFixed(1)),
    upper: Number((Math.min(1, center + margin) * 100).toFixed(1))
  };
}

async function runBenchmark() {
  console.log('--- Executing One-Shot Test Split Release Benchmark ---');
  const manifestPath = path.resolve('eval/golden/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const testSplit = manifest.filter(item => item.split === 'test');
  console.log(`Loaded test split: ${testSplit.length} frozen records.`);

  if (testSplit.length !== 248) {
    console.error(`FATAL: Expected exactly 248 test items, found ${testSplit.length}. Halting.`);
    process.exit(1);
  }

  // Import evaluation pipeline
  const { v2Pipeline } = await import('../eval/run.mjs');

  const v2Results = [];
  let totalCostUsd = 0;
  const stageLatencies = { A: [], B: [], C: [], D: [], E: [], F: [], total: [] };

  const hardPairMatches = {
    'ferrari_488_vs_f8': { total: 0, correct: 0 },
    'lambo_huracan_vs_gallardo': { total: 0, correct: 0 },
    'porsche_997_vs_991': { total: 0, correct: 0 },
    'mclaren_650s_vs_675lt': { total: 0, correct: 0 },
    'ferrari_296_vs_sf90': { total: 0, correct: 0 }
  };

  let vehiclePassCount = 0;
  let makeCorrectCount = 0;
  let modelCorrectCount = 0;
  let genCorrectCount = 0;
  let variantCorrectCount = 0;
  let makeOnlyCount = 0;
  let wrongConfidentCount = 0;
  let highConfCount = 0;

  for (let i = 0; i < testSplit.length; i++) {
    const item = testSplit[i];
    const imageFullPath = path.resolve(item.image_path);
    if (!fs.existsSync(imageFullPath)) {
      console.warn(`[WARN] Missing image file: ${imageFullPath}`);
      continue;
    }

    const t0 = performance.now();
    const res = await v2Pipeline.execute({
      imageDataUrl: imageFullPath,
      traceId: `test_bench_${item.id}`
    });
    const duration = performance.now() - t0;
    stageLatencies.total.push(duration);
    totalCostUsd += res.estimatedCostUsd || 0;

    // Evaluate accuracy against ground truth
    const isVeh = res.status !== 'rejected';
    if (isVeh === item.is_vehicle) vehiclePassCount++;

    const isMakeMatch = res.make?.toLowerCase() === item.make?.toLowerCase();
    const isModelMatch = isMakeMatch && (
      res.model?.toLowerCase() === item.model?.toLowerCase() ||
      item.acceptable_answers?.some(a => a.toLowerCase().includes(res.model?.toLowerCase() || ''))
    );
    const isGenMatch = isModelMatch && (
      !item.generation || res.generation?.toLowerCase() === item.generation?.toLowerCase()
    );
    const isVariantMatch = isGenMatch && (
      !item.variant || res.variant?.toLowerCase() === item.variant?.toLowerCase()
    );

    if (isMakeMatch) makeCorrectCount++;
    if (isModelMatch) modelCorrectCount++;
    if (isGenMatch) genCorrectCount++;
    if (isVariantMatch) variantCorrectCount++;

    if (res.status === 'identified_model') makeOnlyCount++;

    if (res.calibratedConfidence.overall >= 0.85) {
      highConfCount++;
      if (!isVariantMatch) wrongConfidentCount++;
    }

    v2Results.push({ id: item.id, item, res, isMakeMatch, isModelMatch, isVariantMatch });

    if ((i + 1) % 25 === 0) {
      console.log(`Evaluated ${i + 1}/${testSplit.length} test items...`);
    }
  }

  const N = testSplit.length;
  const makeCI = wilsonInterval(makeCorrectCount, N);
  const modelCI = wilsonInterval(modelCorrectCount, N);
  const genCI = wilsonInterval(genCorrectCount, N);
  const variantCI = wilsonInterval(variantCorrectCount, N);

  const makeOnlyRate = Number(((makeOnlyCount / N) * 100).toFixed(1));
  const wrongConfRate = highConfCount > 0 ? Number(((wrongConfidentCount / highConfCount) * 100).toFixed(1)) : 0;

  stageLatencies.total.sort((a, b) => a - b);
  const p95Latency = Math.round(stageLatencies.total[Math.floor(N * 0.95)] || 0);
  const avgLatency = Math.round(stageLatencies.total.reduce((a, b) => a + b, 0) / N);

  // Release Gate Verdict
  const variantTargetMet = variantCI.center >= 80.0;
  const makeOnlyTargetMet = makeOnlyRate <= 15.0;
  const wrongConfTargetMet = wrongConfRate <= 2.5;
  const p95TargetMet = p95Latency <= 6000;
  const costTargetMet = (totalCostUsd / N) <= 0.0050;

  const allPassed = variantTargetMet && makeOnlyTargetMet && wrongConfTargetMet && p95TargetMet && costTargetMet;
  const verdict = allPassed ? 'PASSED — APPROVED FOR PRODUCTION ROLLOUT' : 'FAILED RELEASE CRITERIA';

  console.log('\n====================================================================');
  console.log(`FINAL TEST BENCHMARK VERDICT: ${verdict}`);
  console.log('====================================================================');
  console.log(`- Exact-Variant Accuracy: ${variantCI.center}% (95% CI: [${variantCI.lower}%, ${variantCI.upper}%])`);
  console.log(`- Model Family Accuracy: ${modelCI.center}% (95% CI: [${modelCI.lower}%, ${modelCI.upper}%])`);
  console.log(`- Make Accuracy: ${makeCI.center}% (95% CI: [${makeCI.lower}%, ${makeCI.upper}%])`);
  console.log(`- Make-Only Rate: ${makeOnlyRate}%`);
  console.log(`- Wrong-Confident Rate: ${wrongConfRate}%`);
  console.log(`- P95 Latency: ${p95Latency}ms | Mean Latency: ${avgLatency}ms`);
  console.log(`- Total Provider Spend: $${totalCostUsd.toFixed(4)} USD (Avg: $${(totalCostUsd / N).toFixed(5)}/scan)`);
  console.log('====================================================================\n');
}

runBenchmark().catch(err => {
  console.error('[runBenchmark] Error:', err);
  process.exit(1);
});
