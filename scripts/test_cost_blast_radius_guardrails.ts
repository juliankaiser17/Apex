/**
 * APEX — Cost Blast Radius & Guardrail Regression Suite
 * 
 * Verifies that expensive AI calls, retries, double taps, 401 recovery, and feature flags
 * cannot create uncontrolled request multiplication, duplicate billing, or runaway loops.
 */

import { MAX_GEMINI_REQUESTS_PER_SCAN } from '../src/ai-engine/providers/geminiProvider';
import { aiProviderRouter } from '../src/ai-engine/providers/providerRouter';
import { jobQueue } from '../src/ai-engine/queue/jobQueue';
import { apexEngine } from '../src/ai-engine/engine';
import { FeatureFlagManager } from '../src/utils/featureFlags';

interface TestAssertionResult {
  testName: string;
  passed: boolean;
  expected: string;
  actual: string;
  notes?: string;
}

const results: TestAssertionResult[] = [];

function assert(testName: string, condition: boolean, expected: string, actual: string, notes?: string) {
  results.push({
    testName,
    passed: condition,
    expected,
    actual,
    notes
  });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol}: ${testName} (Expected: ${expected}, Actual: ${actual})`);
}

async function runBlastRadiusSuite() {
  console.log('\n===============================================================');
  console.log('  APEX COST BLAST RADIUS & CONCURRENCY GUARDRAIL AUDIT SUITE');
  console.log('===============================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: MAX_GEMINI_REQUESTS_PER_SCAN Constant is Enforced at <= 2
  // ─────────────────────────────────────────────────────────────────
  assert(
    'MAX_GEMINI_REQUESTS_PER_SCAN is bounded at 2',
    MAX_GEMINI_REQUESTS_PER_SCAN <= 2,
    '<= 2 calls per scan',
    `${MAX_GEMINI_REQUESTS_PER_SCAN} calls per scan`
  );

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: GEMINI_SCANNING_ENABLED Kill Switch Blocks AI Calls
  // ─────────────────────────────────────────────────────────────────
  const originalEnv = process.env.GEMINI_SCANNING_ENABLED;
  const originalCfEnv = process.env.CLOUDFLARE_SCANNING_ENABLED;
  try {
    process.env.GEMINI_SCANNING_ENABLED = 'false';
    process.env.CLOUDFLARE_SCANNING_ENABLED = 'false';
    const response = await aiProviderRouter.routeIdentification({
      scanId: 'test_killswitch',
      traceId: 'trace_killswitch',
      imageDataUrl: 'data:image/jpeg;base64,/9j/test',
      candidates: [],
      options: { disableFallback: true }
    });

    assert(
      'GEMINI_SCANNING_ENABLED=false blocks primary provider and consumes 0 tokens',
      !response.success && response.tokensConsumed.totalTokens === 0 && (response.errorType === 'KILL_SWITCH' || response.error?.includes('disabled')),
      'success=false, totalTokens=0, errorType=KILL_SWITCH',
      `success=${response.success}, totalTokens=${response.tokensConsumed.totalTokens}, errorType=${response.errorType}`
    );
  } finally {
    process.env.GEMINI_SCANNING_ENABLED = originalEnv;
    process.env.CLOUDFLARE_SCANNING_ENABLED = originalCfEnv;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Daily Budget Ceiling Trips Primary Provider
  // ─────────────────────────────────────────────────────────────────
  const routerConfig = aiProviderRouter.getConfig();
  const originalDailyBudget = routerConfig.dailyBudgetUsd;
  try {
    aiProviderRouter.updateConfig({ dailyBudgetUsd: 0.0 }); // Force budget exceeded
    const budgetResponse = await aiProviderRouter.routeIdentification({
      scanId: 'test_budget',
      traceId: 'trace_budget',
      imageDataUrl: 'data:image/jpeg;base64,/9j/test',
      candidates: [],
      options: { disableFallback: true }
    });

    assert(
      'Daily budget exceeded trips circuit and blocks primary AI calls',
      !budgetResponse.success && budgetResponse.tokensConsumed.totalTokens === 0 && (budgetResponse.errorType === 'BUDGET_EXCEEDED' || budgetResponse.error?.includes('budget')),
      'success=false, totalTokens=0, errorType=BUDGET_EXCEEDED',
      `success=${budgetResponse.success}, totalTokens=${budgetResponse.tokensConsumed.totalTokens}, errorType=${budgetResponse.errorType}`
    );
  } finally {
    aiProviderRouter.updateConfig({ dailyBudgetUsd: originalDailyBudget });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Idempotency Key Deduplication in JobQueue
  // ─────────────────────────────────────────────────────────────────
  const testIdempotencyKey = `idem_test_${Date.now()}`;
  const jobPayload1 = {
    id: 'job_dup_1',
    idempotencyKey: testIdempotencyKey,
    userId: 'user_test',
    priority: 'HIGH' as const,
    status: 'queued' as const,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 2,
    imageDataUrl: 'data:image/jpeg;base64,distinct_data_1',
    imageHash: 'hash_test_distinct_1',
    traceId: 'trace_1',
    pipelineVersion: '2.5.0-prod'
  };

  const jobPayload2 = {
    id: 'job_dup_2',
    idempotencyKey: testIdempotencyKey,
    userId: 'user_test',
    priority: 'HIGH' as const,
    status: 'queued' as const,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 2,
    imageDataUrl: 'data:image/jpeg;base64,distinct_data_2',
    imageHash: 'hash_test_distinct_2',
    traceId: 'trace_2',
    pipelineVersion: '2.5.0-prod'
  };

  const enqueue1 = jobQueue.enqueue(jobPayload1);
  const enqueue2 = jobQueue.enqueue(jobPayload2);

  assert(
    'Identical idempotencyKey returns existing job with isDuplicate=true',
    enqueue1.isDuplicate === false && enqueue2.isDuplicate === true && enqueue2.job.id === 'job_dup_1',
    'enqueue1 isDuplicate=false, enqueue2 isDuplicate=true, resolvedJobId=job_dup_1',
    `enqueue1 isDuplicate=${enqueue1.isDuplicate}, enqueue2 isDuplicate=${enqueue2.isDuplicate}, resolvedJobId=${enqueue2.job.id}`
  );

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Rapid Double-Tap / In-Flight Exact Image Hash Deduplication
  // ─────────────────────────────────────────────────────────────────
  const sharedHash = `hash_double_tap_${Date.now()}`;
  const doubleTapJob1 = {
    id: 'tap_job_1',
    idempotencyKey: `idem_tap_1_${Date.now()}`,
    userId: 'user_test',
    priority: 'HIGH' as const,
    status: 'queued' as const,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 2,
    imageDataUrl: 'data:image/jpeg;base64,double_tap_identical_bytes',
    imageHash: sharedHash,
    traceId: 'trace_tap_1',
    pipelineVersion: '2.5.0-prod'
  };

  const doubleTapJob2 = {
    id: 'tap_job_2',
    idempotencyKey: `idem_tap_2_${Date.now()}`,
    userId: 'user_test',
    priority: 'HIGH' as const,
    status: 'queued' as const,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 2,
    imageDataUrl: 'data:image/jpeg;base64,double_tap_identical_bytes',
    imageHash: sharedHash,
    traceId: 'trace_tap_2',
    pipelineVersion: '2.5.0-prod'
  };

  const tapEnqueue1 = jobQueue.enqueue(doubleTapJob1);
  const tapEnqueue2 = jobQueue.enqueue(doubleTapJob2);

  assert(
    'Rapid double-tap with identical image hash is intercepted as duplicate',
    tapEnqueue1.isDuplicate === false && tapEnqueue2.isDuplicate === true && tapEnqueue2.job.id === 'tap_job_1',
    'tap1 isDuplicate=false, tap2 isDuplicate=true, resolvedJobId=tap_job_1',
    `tap1 isDuplicate=${tapEnqueue1.isDuplicate}, tap2 isDuplicate=${tapEnqueue2.isDuplicate}, resolvedJobId=${tapEnqueue2.job.id}`
  );

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Job maxAttempts is Strictly Bounded at <= 2
  // ─────────────────────────────────────────────────────────────────
  const ingestTest = await apexEngine.ingestScan({
    imageDataUrl: 'data:image/jpeg;base64,sample_ingest_test',
    userId: 'user_test_max_attempts'
  });
  const createdJob = jobQueue.getJob(ingestTest.scanId);

  assert(
    'Ingested scan job maxAttempts is strictly bounded at <= 2 (1 initial + 1 retry)',
    Boolean(createdJob && createdJob.maxAttempts <= 2),
    'maxAttempts <= 2',
    `maxAttempts = ${createdJob?.maxAttempts}`
  );

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: Feature Flags Kill Switches for Local Rarity & XP
  // ─────────────────────────────────────────────────────────────────
  const ff = FeatureFlagManager.getInstance();
  ff.setRolloutStage('STAGE_0_DISABLED');
  const stage0Rarity = ff.isLocalRarityEnabled();
  const stage0Xp = ff.isLocalRarityXpEnabled();

  ff.setRolloutStage('STAGE_2_UI_ONLY');
  const stage2Rarity = ff.isLocalRarityEnabled();
  const stage2Xp = ff.isLocalRarityXpEnabled();

  ff.setRolloutStage('STAGE_3_FULL_ROLLOUT');

  assert(
    'FeatureFlagManager cleanly toggles Local Rarity and Local XP independently',
    stage0Rarity === false && stage0Xp === false && stage2Rarity === true && stage2Xp === false,
    'STAGE_0: both false; STAGE_2: rarity=true, xp=false',
    `STAGE_0: rarity=${stage0Rarity}, xp=${stage0Xp}; STAGE_2: rarity=${stage2Rarity}, xp=${stage2Xp}`
  );

  // ─────────────────────────────────────────────────────────────────
  // TEST 8: 429 / Quota Error Circuit Breaker Tripping
  // ─────────────────────────────────────────────────────────────────
  const initialCircuit = aiProviderRouter.getCircuitState();
  (aiProviderRouter as any).onFailure('429');
  const trippedCircuit = aiProviderRouter.getCircuitState();
  aiProviderRouter.resetCircuit();

  assert(
    'HTTP 429 quota exhaustion immediately trips circuit breaker to OPEN',
    initialCircuit === 'CLOSED' && trippedCircuit === 'OPEN',
    'initial=CLOSED, after 429=OPEN',
    `initial=${initialCircuit}, after 429=${trippedCircuit}`
  );

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`SUITE RESULT: ${allPassed ? '✅ ALL COST GUARDRAILS VERIFIED' : '❌ SOME GUARDRAILS FAILED'}`);
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runBlastRadiusSuite().catch((err) => {
  console.error('Fatal error during blast-radius test:', err);
  process.exit(1);
});
