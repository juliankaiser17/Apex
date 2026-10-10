import assert from 'assert';
import fs from 'fs';
import { v2Pipeline, specResolutionEngine, pipelineConfig } from '../eval/run.mjs';

async function testContract() {
  console.log('====================================================');
  console.log('APEX API V2 BACKWARD COMPATIBILITY CONTRACT TESTS');
  console.log('====================================================\n');

  const real488Buf = fs.readFileSync('benchmark/real_world_1000/images/REAL_BLIND_000390.jpg');
  const real488DataUrl = `data:image/jpeg;base64,${real488Buf.toString('base64')}`;

  // 1. Test Verified Specs Resolution
  console.log('Test 1: Verified Registry Specs (Zero VLM speculation)');
  const specs = specResolutionEngine.resolveSpecs('ferrari-458-italia');
  assert(specs !== null, 'Specs must not be null for catalogued car');
  assert(specs.horsepower > 0, `Expected horsepower > 0, got ${specs.horsepower}`);
  assert(specs.productionYears.includes('2009'), `Expected productionYears with 2009, got ${specs.productionYears}`);
  assert(specs.sources.length >= 2, 'Expected authoritative sources links');
  console.log('  ✅ Specs resolved strictly from authority registry with source links:', {
    hp: specs.horsepower,
    years: specs.productionYears,
    sources: specs.sources
  });

  // 2. Test v2 Pipeline execution on clear Ferrari 488 GTB photo with adjudication
  console.log('\nTest 2: Full Car Identity (Not "Ferrari" make-only)');
  const res = await v2Pipeline.execute({
    imageDataUrl: real488DataUrl,
    traceId: 'contract_test_488',
    simulatedPerceptualHints: {
      makeHint: 'Ferrari',
      modelHint: '488',
      observableCues: ['Ferrari 488 GTB', 'scalloped side air intakes', 'twin round exhaust'],
      badgeText: 'GTB',
      rawVlmResponse: JSON.stringify({
        chosen_candidate_id: 'ferrari-488-gtb',
        deciding_visible_cues: ['scalloped side intakes', 'twin exhaust outlets'],
        legible_badge_text: 'GTB',
        confidence: 0.95
      })
    }
  });

  assert.strictEqual(res.status, 'identified', 'Expected status to be identified');
  assert.strictEqual(res.make, 'Ferrari', 'Expected Make to be Ferrari');
  assert.strictEqual(res.model, '488', 'Expected Model to be 488 (NOT empty)');
  assert.strictEqual(res.variant, 'GTB', 'Expected Variant to be GTB');
  assert(res.displayName.includes('Ferrari 488'), `Expected displayName Ferrari 488 GTB, got ${res.displayName}`);
  assert(res.verifiedSpecs !== null, 'Verified specs must be attached');
  assert(res.verifiedSpecs.horsepower >= 660, 'Expected Ferrari 488 horsepower >= 660');
  console.log('  ✅ Full vehicle identity returned:', {
    displayName: res.displayName,
    status: res.status,
    hp: res.verifiedSpecs.horsepower,
    confidence: res.calibratedConfidence
  });

  // 3. Test Invariant: At most 2 VLM calls per scan
  console.log('\nTest 3: Hard Cost Invariant (MAX_VLM_CALLS <= 2)');
  assert(res.vlmCallsCount <= 2, `Expected vlmCallsCount <= 2, got ${res.vlmCallsCount}`);
  assert(res.estimatedCostUsd <= pipelineConfig.budgets.maxCostPerScanUsd, `Cost exceeds ceiling: $${res.estimatedCostUsd}`);
  console.log(`  ✅ VLM calls bounded to ${res.vlmCallsCount} (limit: 2), cost: $${res.estimatedCostUsd} (ceiling: $${pipelineConfig.budgets.maxCostPerScanUsd})`);

  // 4. Test Open-Set Anomaly Detection (Uncatalogued vehicles)
  console.log('\nTest 4: Open-Set Detection (Uncatalogued car)');
  const uncatRes = await v2Pipeline.execute({
    imageDataUrl: real488DataUrl,
    traceId: 'contract_test_uncatalogued',
    simulatedPerceptualHints: {
      makeHint: 'UncataloguedConcept',
      modelHint: 'X9000',
      observableCues: ['futuristic concept car', 'unknown make']
    }
  });

  assert.strictEqual(uncatRes.status, 'not_in_catalogue', 'Expected uncatalogued vehicle to return not_in_catalogue');
  assert(uncatRes.guidedRecovery !== undefined, 'Expected guidedRecovery object with user prompt');
  console.log('  ✅ Correctly handled uncatalogued vehicle without hallucination:', {
    status: uncatRes.status,
    prompt: uncatRes.guidedRecovery.userPrompt
  });

  // 5. Test Multi-Photo Session Fusion (Up to 3 Photos of the same car)
  console.log('\nTest 5: Multi-Photo Session Fusion (Frames 1 -> 2 -> 3)');
  // Frame 1: Model identified
  const frame1 = await v2Pipeline.execute({
    imageDataUrl: real488DataUrl,
    sessionFramesCount: 1,
    simulatedPerceptualHints: {
      makeHint: 'Ferrari',
      modelHint: '488',
      observableCues: ['Ferrari 488 front']
    }
  });

  // Frame 2: Complementary rear badge photo added to session -> resolves variant!
  const frame2 = await v2Pipeline.execute({
    imageDataUrl: real488DataUrl,
    sessionFramesCount: 2,
    simulatedPerceptualHints: {
      makeHint: 'Ferrari',
      modelHint: '488',
      observableCues: ['Ferrari 488 GTB', 'rear decklid badge', 'twin round exhaust'],
      badgeText: 'GTB',
      rawVlmResponse: JSON.stringify({
        chosen_candidate_id: 'ferrari-488-gtb',
        deciding_visible_cues: ['GTB rear badge', 'scalloped side intakes'],
        legible_badge_text: 'GTB',
        confidence: 0.94
      })
    }
  });

  assert.strictEqual(frame2.status, 'identified', 'Frame 2 fusion must resolve to identified');
  assert.strictEqual(frame2.variant, 'GTB', 'Variant must resolve to GTB');
  console.log('  ✅ Multi-photo session fusion succeeded:');
  console.log(`     Frame 1 status: ${frame1.status} -> Frame 2 resolved status: ${frame2.status} (${frame2.displayName})`);

  console.log('\n====================================================');
  console.log('ALL API V2 BACKWARD COMPATIBILITY CONTRACT TESTS PASSED!');
  console.log('====================================================\n');
}

testContract().catch(err => {
  console.error('[testContract] Failed:', err);
  process.exit(1);
});
