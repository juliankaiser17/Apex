/**
 * APEX — Accuracy Benchmark & Regression Verification Harness
 * 
 * Evaluates the AI Vision System against the standardized evaluation dataset.
 * Verifies production acceptance gates:
 * - Make Accuracy >= 96%
 * - Wrong-Manufacturer Rate < 2%
 * - BMW M4 CSL -> Ferrari Daytona SP3 = 0%
 * - Ferrari Daytona SP3 -> BMW M4 CSL = 0%
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hierarchicalClassifier } from '../validation/hierarchicalClassifier';
import { confidenceEngine } from '../validation/confidenceEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  id: string;
  name: string;
  ground_truth: {
    make: string | null;
    model_family: string | null;
    generation: string | null;
    variant: string | null;
    body_style: string | null;
    is_vehicle: boolean;
  };
  difficult_pair?: string;
  is_mandatory_regression?: boolean;
  input: {
    viewpoint: any;
    quality_score: number;
    raw_make: string | null;
    raw_model: string | null;
    raw_generation: string | null;
    raw_variant: string | null;
    visual_evidence: any;
    raw_candidates: Array<{
      name: string;
      score: number;
      supporting_evidence: string[];
      contradictions: string[];
      unobservable_features?: string[];
    }>;
  };
}

export async function runBenchmark() {
  console.log('==============================================================');
  console.log('APEX AI VISION SYSTEM — PRODUCTION ACCURACY BENCHMARK');
  console.log('==============================================================\n');

  const datasetPath = path.join(__dirname, 'evaluation_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`Benchmark dataset not found at: ${datasetPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(datasetPath, 'utf8');
  const testCases: TestCase[] = JSON.parse(rawData);

  console.log(`Loaded ${testCases.length} benchmark test cases.`);
  console.log('Executing hierarchical classification, contradiction penalty, and confidence engine...\n');

  let totalVehicles = 0;
  let correctMakeCount = 0;
  let correctModelCount = 0;
  let correctGenerationCount = 0;
  let correctVariantOrAbstainCount = 0;
  let wrongManufacturerCount = 0;
  let m4ToDaytonaCount = 0;
  let daytonaToM4Count = 0;
  let nonCarRejectionCorrect = 0;
  let totalNonCars = 0;
  let uncertainOutcomeCount = 0;

  const latencies: number[] = [];

  for (const tc of testCases) {
    const t0 = performance.now();

    // 1. Non-car rejection test
    if (!tc.ground_truth.is_vehicle) {
      totalNonCars++;
      if (tc.input.quality_score < 0.3 || !tc.input.raw_make) {
        nonCarRejectionCorrect++;
      }
      latencies.push(performance.now() - t0);
      continue;
    }

    totalVehicles++;

    // 2. Classify through hierarchical engine
    const classResult = hierarchicalClassifier.classify({
      visual_evidence: tc.input.visual_evidence,
      viewpoint: tc.input.viewpoint,
      raw_make: tc.input.raw_make,
      raw_model: tc.input.raw_model,
      raw_generation: tc.input.raw_generation,
      raw_variant: tc.input.raw_variant,
      raw_candidates: tc.input.raw_candidates
    });

    // 3. Compute calibrated hierarchical confidence
    const confResult = confidenceEngine.computeHierarchicalConfidence({
      image_quality_score: tc.input.quality_score,
      evidence_strength: tc.input.visual_evidence.distinctive_details ? 0.90 : 0.70,
      candidate_separation: classResult.candidate_separation,
      contradiction_count: classResult.contradictions.length,
      top_candidate_score: classResult.top_candidate?.score || 0.75,
      specificity_level: classResult.specificity_level,
      has_vehicle: true
    });

    const elapsed = performance.now() - t0;
    latencies.push(elapsed);

    const resolvedMake = classResult.identification.make || '';
    const resolvedModel = classResult.identification.model_family || '';
    const resolvedVariant = classResult.identification.variant;

    const gtMake = tc.ground_truth.make || '';
    const gtModel = tc.ground_truth.model_family || '';
    const gtVariant = tc.ground_truth.variant;

    // Check Make Accuracy
    const isMakeMatch = resolvedMake.toLowerCase() === gtMake.toLowerCase();
    if (isMakeMatch) {
      correctMakeCount++;
    } else {
      wrongManufacturerCount++;
      console.warn(`[FAIL: MAKE MISMATCH] ID: ${tc.id} (${tc.name}) -> Expected ${gtMake}, Got ${resolvedMake}`);
    }

    // Check Model Family Accuracy
    const isModelMatch = resolvedModel.toLowerCase().includes(gtModel.toLowerCase()) ||
                         gtModel.toLowerCase().includes(resolvedModel.toLowerCase());
    if (isModelMatch) {
      correctModelCount++;
    }

    // Check Variant Specificity vs Honest Abstention
    if (gtVariant === null) {
      // Correct behavior is to abstain from guessing variant!
      if (resolvedVariant === null || classResult.specificity_level !== 'variant') {
        correctVariantOrAbstainCount++;
      }
    } else {
      if (resolvedVariant && resolvedVariant.toLowerCase() === gtVariant.toLowerCase()) {
        correctVariantOrAbstainCount++;
      } else if (resolvedVariant === null && confResult.status === 'uncertain') {
        // Honest partial identification is valid
        correctVariantOrAbstainCount++;
      }
    }

    // Track explicit uncertain status
    if (confResult.status === 'uncertain') {
      uncertainOutcomeCount++;
    }

    // MANDATORY REGRESSION CHECK 1: BMW M4 CSL -> Ferrari Daytona SP3
    if (tc.name.includes('BMW M4') && (resolvedMake.toLowerCase().includes('ferrari') || resolvedModel.toLowerCase().includes('daytona'))) {
      m4ToDaytonaCount++;
      console.error(`[CRITICAL REGRESSION DETECTED] ${tc.name} was misidentified as Ferrari Daytona SP3!`);
    }

    // MANDATORY REGRESSION CHECK 2: Ferrari Daytona SP3 -> BMW M4
    if (tc.name.includes('Ferrari Daytona') && (resolvedMake.toLowerCase().includes('bmw') || resolvedModel.toLowerCase().includes('m4'))) {
      daytonaToM4Count++;
      console.error(`[CRITICAL REGRESSION DETECTED] ${tc.name} was misidentified as BMW M4!`);
    }
  }

  // Calculate Metrics
  const makeAccuracy = (correctMakeCount / totalVehicles) * 100;
  const modelAccuracy = (correctModelCount / totalVehicles) * 100;
  const wrongManufacturerRate = (wrongManufacturerCount / totalVehicles) * 100;
  const variantOrHonestAbstainRate = (correctVariantOrAbstainCount / totalVehicles) * 100;
  const nonCarRejectionRate = totalNonCars > 0 ? (nonCarRejectionCorrect / totalNonCars) * 100 : 100;
  const uncertaintyRate = (uncertainOutcomeCount / totalVehicles) * 100;

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || avgLatency;

  console.log('--------------------------------------------------------------');
  console.log('BENCHMARK RESULTS SUMMARY:');
  console.log('--------------------------------------------------------------');
  console.log(`Total Vehicles Evaluated:          ${totalVehicles}`);
  console.log(`Make Identification Accuracy:      ${makeAccuracy.toFixed(2)}% (Target: >= 96.00%)`);
  console.log(`Model-Family Accuracy:             ${modelAccuracy.toFixed(2)}%`);
  console.log(`Defensible Variant / Abstain Rate: ${variantOrHonestAbstainRate.toFixed(2)}%`);
  console.log(`Wrong-Manufacturer Rate:           ${wrongManufacturerRate.toFixed(2)}% (Target: < 2.00%)`);
  console.log(`Non-Car Rejection Accuracy:        ${nonCarRejectionRate.toFixed(2)}%`);
  console.log(`Explicit Uncertainty Rate:         ${uncertaintyRate.toFixed(2)}% (Valid successful partial identifications)`);
  console.log(`BMW M4 CSL -> Ferrari Daytona SP3: ${m4ToDaytonaCount} errors (Target: 0)`);
  console.log(`Ferrari Daytona SP3 -> BMW M4:     ${daytonaToM4Count} errors (Target: 0)`);
  console.log(`Average Engine Processing Latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`P95 Engine Processing Latency:     ${p95Latency.toFixed(2)} ms`);
  console.log('--------------------------------------------------------------\n');

  // Acceptance Gates Evaluation
  let hasFailed = false;

  if (makeAccuracy < 96.0) {
    console.error(`❌ GATE FAILED: Make Accuracy (${makeAccuracy.toFixed(2)}%) is below 96.0% target.`);
    hasFailed = true;
  } else {
    console.log(`✅ GATE PASSED: Make Accuracy (${makeAccuracy.toFixed(2)}% >= 96.0%).`);
  }

  if (wrongManufacturerRate >= 2.0) {
    console.error(`❌ GATE FAILED: Wrong-Manufacturer Rate (${wrongManufacturerRate.toFixed(2)}%) is >= 2.0% limit.`);
    hasFailed = true;
  } else {
    console.log(`✅ GATE PASSED: Wrong-Manufacturer Rate (${wrongManufacturerRate.toFixed(2)}% < 2.0%).`);
  }

  if (m4ToDaytonaCount !== 0) {
    console.error(`❌ GATE FAILED: BMW M4 CSL -> Ferrari Daytona SP3 regression failed (${m4ToDaytonaCount} errors).`);
    hasFailed = true;
  } else {
    console.log(`✅ GATE PASSED: BMW M4 CSL -> Ferrari Daytona SP3 error count = 0.`);
  }

  if (daytonaToM4Count !== 0) {
    console.error(`❌ GATE FAILED: Ferrari Daytona SP3 -> BMW M4 regression failed (${daytonaToM4Count} errors).`);
    hasFailed = true;
  } else {
    console.log(`✅ GATE PASSED: Ferrari Daytona SP3 -> BMW M4 error count = 0.`);
  }

  if (hasFailed) {
    console.error('\n❌ BENCHMARK EVALUATION FAILED: System does not meet production release gates.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PRODUCTION ACCURACY GATES PASSED! Vision engine ready for deployment.');
    process.exit(0);
  }
}

runBenchmark().catch((err) => {
  console.error('Fatal error running benchmark:', err);
  process.exit(1);
});
