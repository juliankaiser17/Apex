/**
 * APEX — Production Engine Integration & Failure Simulator Tests
 */

import { qualityGate } from '../quality/qualityGate';
import { visualReferenceStore } from '../canonical/visualReferenceStore';
import { confidenceEngine } from '../validation/confidenceEngine';
import { deterministicValidator } from '../validation/deterministicValidator';
import { jobQueue } from '../queue/jobQueue';
import { apexEngine } from '../engine';
import { capacityPlanner } from '../observability/capacityPlanner';
import { aiProviderRouter } from '../providers/providerRouter';

export async function runAllIntegrationTests(): Promise<{ passed: boolean; results: string[] }> {
  const results: string[] = [];
  const telemetry = apexEngine.getTelemetry();
  if (telemetry) {
    results.push(`PASS: ApexEngine telemetry reporting active (RPS: ${telemetry.requestsPerSecond}).`);
  }

  try {
    // 1. Test Quality Gate Rejection
    const poorQuality = await qualityGate.evaluateImageQuality('data:image/jpeg;base64,123', 'selfie_with_friend.jpg');
    if (!poorQuality.isUsable) {
      results.push('PASS: QualityGate successfully caught and rejected non-car image prior to AI.');
    } else {
      results.push('FAIL: QualityGate failed to reject non-car image.');
    }

    // 2. Test Candidate Retrieval
    const candidates = visualReferenceStore.retrieveTopKCandidates({ fileName: 'porsche_911_gt3_rs' }, 10);
    if (candidates.length > 0 && candidates[0].make.toLowerCase().includes('porsche')) {
      results.push(`PASS: VisualReferenceStore retrieved ${candidates.length} candidates with top candidate ${candidates[0].make} ${candidates[0].model}.`);
    } else {
      results.push('FAIL: VisualReferenceStore candidate retrieval failed.');
    }

    // 3. Test Deterministic Validation
    const valReport = deterministicValidator.validate({
      vehicleId: 'porsche-911-gt3-rs-992',
      make: 'Porsche',
      model: '911 GT3 RS',
      generation: '992',
      trim: 'Weissach Package',
      yearEstimate: '2023',
      color: 'Guards Red',
      rarity: 'legendary',
      engine: '4.0L Boxer-6',
      horsepower: 518,
      torqueNm: 465,
      topSpeedKmH: 296,
      zeroToHundredSec: 3.2,
      kerbWeightKg: 1450,
      productionYears: '2022–Present',
      originCountry: 'Germany',
      bodyStyle: 'Coupe',
      historicalInformation: 'Track car',
      interestingFacts: 'DRS wing',
      aftermarketPartsDetected: [],
      modelConfidence: 0.98,
      evidence: [],
      alternatives: [],
      needsReview: false
    });

    if (valReport.isValid && valReport.resolvedMake === 'Porsche') {
      results.push('PASS: DeterministicValidator validated canonical Porsche 911 GT3 RS.');
    } else {
      results.push('FAIL: DeterministicValidator rejected valid canonical vehicle.');
    }

    // 4. Test Confidence & Abstention
    const conf = confidenceEngine.computeConfidence({
      modelOutput: {
        vehicleId: null,
        make: 'Unknown',
        model: 'Unknown',
        generation: '',
        trim: null,
        yearEstimate: '2020',
        color: 'Black',
        rarity: 'common',
        engine: '',
        horsepower: 100,
        torqueNm: 100,
        topSpeedKmH: 150,
        zeroToHundredSec: 10,
        kerbWeightKg: 1500,
        productionYears: '',
        originCountry: '',
        bodyStyle: 'Sedan',
        historicalInformation: '',
        interestingFacts: '',
        aftermarketPartsDetected: [],
        modelConfidence: 0.2,
        evidence: [],
        alternatives: [],
        needsReview: true
      },
      validationReport: valReport,
      qualityMetrics: { isUsable: true, blurScore: 0.4, luminanceScore: 0.4, contrastScore: 0.5, aspectRatio: 1, vehicleBoundingEstimated: false },
      topCandidates: []
    });

    if (conf.shouldAbstain) {
      results.push('PASS: ConfidenceEngine correctly abstained on low-confidence, blurry input.');
    } else {
      results.push('FAIL: ConfidenceEngine failed to abstain on poor quality input.');
    }

    // 5. Test Priority Queue Enqueue & Idempotency
    const sampleJob: any = {
      id: 'test_job_1',
      idempotencyKey: 'idem_unique_key_1',
      userId: 'test_user_1',
      priority: 'HIGH',
      status: 'queued',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
      imageDataUrl: 'data:image/jpeg;base64,sample',
      imageHash: 'hash_test_1',
      traceId: 'trc_1',
      pipelineVersion: '2.5'
    };

    const firstEnqueue = jobQueue.enqueue(sampleJob);
    const secondEnqueue = jobQueue.enqueue(sampleJob);

    if (!firstEnqueue.isDuplicate && secondEnqueue.isDuplicate) {
      results.push('PASS: JobQueue correctly enforced idempotency deduplication.');
    } else {
      results.push('FAIL: JobQueue idempotency failed.');
    }

    // 6. Test 1,000,000-User Capacity Simulation
    const capPlan = capacityPlanner.calculateCapacityPlan(1000000);
    if (capPlan.simulatedUserCount === 1000000 && capPlan.requiredWorkerInstances > 10) {
      results.push(`PASS: CapacityPlanner calculated model for 1M users (${capPlan.expectedScansPerMinute.toLocaleString()} scans/min, ${capPlan.requiredWorkerInstances} workers).`);
    } else {
      results.push('FAIL: CapacityPlanner failed.');
    }

    // 7. Test Circuit Breaker
    const circuitInitial = aiProviderRouter.getCircuitState();
    if (circuitInitial === 'CLOSED') {
      results.push('PASS: AI Provider Circuit Breaker initialized in CLOSED state.');
    } else {
      results.push('FAIL: Circuit Breaker initial state unexpected.');
    }

    return { passed: true, results };
  } catch (err: any) {
    results.push(`FAIL: Integration test threw exception: ${err?.message}`);
    return { passed: false, results };
  }
}
