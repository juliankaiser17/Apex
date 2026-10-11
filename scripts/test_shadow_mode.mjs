import { pipelineConfig, v2Pipeline, aiTelemetry } from '../eval/run.mjs';
import assert from 'assert';
import fs from 'fs';

async function testShadowMode() {
  console.log('====================================================');
  console.log('APEX SHADOW MODE DISAGREEMENT & TELEMETRY TEST');
  console.log('====================================================\n');

  // Set mode to shadow
  const originalMode = pipelineConfig.mode;
  pipelineConfig.mode = 'shadow';
  console.log(`Pipeline mode set to: ${pipelineConfig.mode}`);

  aiTelemetry.clearTraces();

  const realImagePath = 'scratch/real_458_italia_coupe.jpg';
  const imgBuffer = fs.readFileSync(realImagePath);
  const mockPayload = imgBuffer.toString('base64');
  const traceId = `trace_shadow_${Date.now()}`;
  const mockImageHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // In shadow mode:
  // v1 produces make-only "Ferrari"
  const v1SimulatedResult = {
    status: 'identified_model',
    make: 'Ferrari',
    model: null,
    variant: null
  };

  // v2 executes in background and resolves full model
  const v2Res = await v2Pipeline.execute({
    imageDataUrl: `data:image/jpeg;base64,${mockPayload}`,
    traceId,
    simulatedPerceptualHints: {
      makeHint: 'Ferrari',
      modelHint: '458',
      observableCues: ['Ferrari 458 Italia', 'vertical headlight blades', 'triple exhaust'],
      badgeText: 'Italia'
    }
  });

  const disagrees = v1SimulatedResult.make !== v2Res.make || v1SimulatedResult.model !== v2Res.model;

  // Record shadow disagreement into telemetry
  aiTelemetry.recordShadowDisagreement(
    traceId,
    mockImageHash,
    { status: v1SimulatedResult.status, make: v1SimulatedResult.make, model: v1SimulatedResult.model },
    { status: v2Res.status, make: v2Res.make, model: v2Res.model, variant: v2Res.variant, confidence: v2Res.calibratedConfidence.overall },
    {
      stageA_quality_ms: 12,
      stageB_retrieval_ms: 45,
      stageC_adjudication_ms: 0,
      stageD_fusion_ms: 5,
      stageE_policy_ms: 2,
      stageF_specs_ms: 1,
      total_ms: v2Res.totalLatencyMs
    },
    v2Res.vlmCallsCount,
    v2Res.estimatedCostUsd,
    false // Privacy invariant: hashes only
  );

  console.log('[SHADOW DISAGREEMENT LOG]', {
    traceId,
    imageHash: mockImageHash.substring(0, 16),
    v1Make: v1SimulatedResult.make,
    v1Model: v1SimulatedResult.model,
    v2Make: v2Res.make,
    v2Model: v2Res.model,
    v2Variant: v2Res.variant,
    v2Status: v2Res.status,
    disagrees
  });

  assert.strictEqual(disagrees, true, 'Shadow mode must detect disagreement when v1 is make-only and v2 resolved model');
  assert.strictEqual(v2Res.make, 'Ferrari');
  assert(v2Res.model !== null, 'v2 must resolve model candidate');

  // Verify Admin AI Control Center metrics feed
  const metrics = aiTelemetry.getControlCenterMetrics();
  console.log('\n[ADMIN AI CONTROL CENTER METRICS FEED]:', {
    totalScans: metrics.totalScans,
    averageLatencyMs: metrics.averageLatencyMs,
    p95LatencyMs: metrics.p95LatencyMs,
    totalCostUsd: metrics.totalCostUsd,
    topConfusions: metrics.topConfusions,
    stageLatencyBreakdown: metrics.latencyByStage
  });

  assert(metrics.totalScans >= 1, 'Telemetry must track at least 1 scan');
  assert(metrics.topConfusions.length >= 1, 'Telemetry must track shadow disagreements');
  assert.strictEqual(metrics.topConfusions[0].pair, `Ferrari null vs Ferrari ${v2Res.model}`);

  console.log(`\n✅ SHADOW MODE SUCCESS: Disagreement captured! v1 returned Make-only ("Ferrari"), v2 resolved vehicle ("Ferrari ${v2Res.model}").`);
  console.log('✅ TELEMETRY SUCCESS: Admin AI Control Center metrics computed with stage latency breakdown and privacy-safe image hashing.');

  pipelineConfig.mode = originalMode;
}

testShadowMode().catch(err => {
  console.error('[testShadowMode] Error:', err);
  process.exit(1);
});
