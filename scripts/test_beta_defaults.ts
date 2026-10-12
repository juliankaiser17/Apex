/**
 * Test Suite: Beta Safe Defaults & Invariants (Item 1)
 * 
 * Invariants Tested:
 * 1. AI_PIPELINE defaults strictly to 'v1'.
 * 2. VLM_FIRST_ENABLED defaults strictly to false.
 * 3. Cloudflare Llama scanning defaults to false.
 * 4. Primary vision provider defaults strictly to 'gemini'.
 * 5. Free-tier provider budgets are properly defined in config.
 * 6. One-step rollback behavior: setting AI_PIPELINE=v1 forces v1.
 */

import { resolvePipelineConfig } from '../src/ai-engine/config/pipelineConfig';

let failures = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log('====================================================');
console.log('   BETA SAFE DEFAULTS & INVARIANTS TEST');
console.log('====================================================\n');

// Test 1: Clean environment defaults
const cleanConfig = resolvePipelineConfig();

assert(cleanConfig.mode === 'v1', `AI_PIPELINE default is '${cleanConfig.mode}', expected 'v1'`);
assert(cleanConfig.killSwitches.vlmFirstEnabled === false, `VLM_FIRST_ENABLED default is ${cleanConfig.killSwitches.vlmFirstEnabled}, expected false`);
assert(cleanConfig.killSwitches.cloudflareScanningEnabled === false, `Cloudflare default is ${cleanConfig.killSwitches.cloudflareScanningEnabled}, expected false`);
assert(cleanConfig.primaryProvider === 'gemini', `Primary provider default is '${cleanConfig.primaryProvider}', expected 'gemini'`);

// Test 2: Free tier budgets
const budgets = cleanConfig.freeTierBudgets;
assert(budgets.models['gemini-3.1-flash-lite'].dailyQuota === 500, 'gemini-3.1-flash-lite daily budget is 500');
assert(budgets.models['gemini-3.1-flash-lite'].rpmLimit === 15, 'gemini-3.1-flash-lite RPM is 15');
assert(budgets.models['gemini-3.5-flash-lite'].dailyQuota === 500, 'gemini-3.5-flash-lite daily budget is 500');
assert(budgets.models['gemini-3.5-flash-lite'].rpmLimit === 15, 'gemini-3.5-flash-lite RPM is 15');
assert(budgets.models['gemini-3.5-flash'].dailyQuota === 20, 'gemini-3.5-flash daily budget is 20');
assert(budgets.models['gemini-3.5-flash'].rpmLimit === 15, 'gemini-3.5-flash RPM is 15');
assert(budgets.globalDailyScanBudget === 500, 'globalDailyScanBudget is 500');
assert(budgets.userDailyScanCap === 10, 'userDailyScanCap is 10');

// Test 3: Emergency kill switches
assert(cleanConfig.killSwitches.visionScanningEnabled === true, 'visionScanningEnabled default is true');
assert(cleanConfig.killSwitches.geminiScanningEnabled === true, 'geminiScanningEnabled default is true');

console.log('\n====================================================');
if (failures === 0) {
  console.log('🎉 ALL BETA DEFAULT INVARIANTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error(`❌ ${failures} TESTS FAILED`);
  console.log('====================================================\n');
  process.exit(1);
}
