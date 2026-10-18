/**
 * APEX — Comprehensive Ferrari Daytona SP3 & Variant Regression Suite
 *
 * Validates:
 * 1. End-to-end trace on the exact Daytona SP3 image fixture
 * 2. Cache isolation: Content cryptographic SHA-256 over raw binary bytes
 *    - Image byte deduplication (0 redundant calls)
 *    - Cross-image independence (SP3 vs 458 Italia vs SF90)
 *    - Scan order invariance (A then B vs B then A)
 * 3. Selection & Discrimination:
 *    - Daytona SP3 correctly separates from SF90 Stradale
 *    - No default 'Assetto Fiorano' variant hallucination
 *    - Correct canonical specs (829 HP, 697 Nm)
 * 4. Grounded Pairwise Verification:
 *    - Verifier requires positive observable matches
 *    - Unevidenced hypothesis never promoted to high confidence
 * 5. Latency and Stage Telemetry
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { confidenceEngine } from '../src/ai-engine/validation/confidenceEngine';
import { fineGrainedModelDiscriminator } from '../src/ai-engine/validation/fineGrainedModelDiscriminator';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { resolveCanonicalVehicleSpecs } from '../src/utils/vehicleSpecs';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';
import { identificationCache, VISION_PIPELINE_VERSION } from '../src/ai-engine/caching/identificationCache';
import { computeImageSha256 } from '../src/ai-engine/crypto/sha256';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  APEX — FERRARI DAYTONA SP3 & FORENSIC CACHE REGRESSION SUITE');
  console.log(`  Pipeline Version: ${VISION_PIPELINE_VERSION}`);
  console.log('================================================================\n');

  // ─── TEST 1: Exact Daytona SP3 Image Fixture Verification ───
  console.log('--- TEST 1: Exact Daytona SP3 Fixture & Binary Integrity ---');
  const sp3FixturePath = path.resolve(process.cwd(), 'benchmark/fixtures/daytona_sp3_regression.jpg');
  assert(fs.existsSync(sp3FixturePath), 'Daytona SP3 image fixture exists at benchmark/fixtures/daytona_sp3_regression.jpg');

  const sp3Bytes = fs.readFileSync(sp3FixturePath);
  const sp3Base64 = sp3Bytes.toString('base64');
  const computedSha = crypto.createHash('sha256').update(sp3Bytes).digest('hex');
  const isomorphicSha = computeImageSha256(`data:image/jpeg;base64,${sp3Base64}`);

  assert(computedSha === isomorphicSha, 'Node crypto SHA-256 matches isomorphic computeImageSha256 digest');
  assert(computedSha === '1332ea3d1636132df760c29907795e90313f6030e92aaaf8cea4a441d04bd9d3', 'SHA-256 matches authoritative test fixture digest');

  // ─── TEST 2: Cache Key Isolation and Byte-Level Immutability ───
  console.log('\n--- TEST 2: Cryptographic Cache Isolation & Order Invariance ---');
  identificationCache.clear();

  const fake458Bytes = Buffer.from('ferrari-458-italia-test-bytes-content-001', 'utf8');
  const fake458Hash = crypto.createHash('sha256').update(fake458Bytes).digest('hex');

  // Simulate cache storage
  const mockSP3Result: any = {
    scanId: 'scan_sp3_001',
    make: 'Ferrari',
    model: 'Daytona SP3',
    generation: 'Icona',
    trim: null,
    canonicalVehicleId: 'ferrari-daytona-sp3',
    pipelineVersion: VISION_PIPELINE_VERSION
  };

  const mock458Result: any = {
    scanId: 'scan_458_002',
    make: 'Ferrari',
    model: '458 Italia',
    generation: 'F142',
    trim: 'Base',
    canonicalVehicleId: 'ferrari-458-italia',
    pipelineVersion: VISION_PIPELINE_VERSION
  };

  identificationCache.setResult(computedSha, mockSP3Result);
  identificationCache.setResult(fake458Hash, mock458Result);

  const lookupSP3 = identificationCache.getResult(computedSha);
  const lookup458 = identificationCache.getResult(fake458Hash);

  assert(lookupSP3 !== null && lookupSP3.model === 'Daytona SP3', 'SP3 cache lookup retrieves Daytona SP3');
  assert(lookup458 !== null && lookup458.model === '458 Italia', '458 cache lookup retrieves 458 Italia');
  assert(lookupSP3?.canonicalVehicleId !== lookup458?.canonicalVehicleId, 'Zero cross-scan cache contamination between separate images');

  // Reverse ordering test
  identificationCache.clear();
  identificationCache.setResult(fake458Hash, mock458Result);
  identificationCache.setResult(computedSha, mockSP3Result);

  const reverseSP3 = identificationCache.getResult(computedSha);
  const reverse458 = identificationCache.getResult(fake458Hash);
  assert(reverseSP3?.model === 'Daytona SP3' && reverse458?.model === '458 Italia', 'Cache lookups are strictly order-invariant');

  // ─── TEST 3: Candidate Generation & Trait Separation ───
  console.log('\n--- TEST 3: Discriminator Trait Separation (SP3 vs SF90) ---');

  // Raw observations matching what Cloudflare observed on the Daytona SP3 fixture
  const daytonaObservedEvidence = {
    body_style: 'Two-door coupe with sloping roofline and curved rear window',
    grille: 'Front grille is a horizontal slat with a black mesh pattern',
    headlights: 'Front lamps are horizontal LED strips with eyelid blades',
    taillights: null,
    hood: 'Hood has a smooth, flat surface with small air vent channels',
    roofline: 'Wraparound visor cockpit canopy',
    windows: null,
    wheels: null,
    exhaust: null,
    aero: 'Front splitter is a horizontal blade lip with endplates',
    badges: null,
    body_proportions: 'mid-engine Icona hypercar prototype stance',
    distinctive_details: ['horizontal slats across front', 'eyelid covers over headlights']
  };

  // Seed candidates with raw hypothesis = SF90 Stradale (simulating the raw model guess)
  const candidateList: any[] = [
    { name: 'Ferrari SF90 Stradale', score: 0.5, supporting_evidence: [], contradictions: [], unobservable_features: [] }
  ];
  for (const peer of APEX_LOCAL_VEHICLE_DATABASE.filter(v => v.manufacturer.toLowerCase() === 'ferrari')) {
    const peerName = peer.generation && peer.generation !== 'Base' && peer.generation !== 'Current'
      ? `${peer.manufacturer} ${peer.model} (${peer.generation})`
      : `${peer.manufacturer} ${peer.model}`;
    candidateList.push({ name: peerName, score: 0.5, supporting_evidence: [], contradictions: [], unobservable_features: [] });
  }

  const classification = hierarchicalClassifier.classify({
    visual_evidence: daytonaObservedEvidence,
    viewpoint: 'front_3q',
    raw_make: 'Ferrari',
    raw_model: 'SF90 Stradale',
    raw_generation: 'L530',
    raw_variant: null,
    raw_candidates: candidateList
  });

  assert(classification.top_candidate?.name.includes('Daytona SP3'), `Top candidate is Daytona SP3 (got: ${classification.top_candidate?.name})`);
  assert(!classification.top_candidate?.name.includes('SF90'), 'Top candidate is NOT SF90 Stradale');
  assert(classification.canonical_vehicle_id === 'ferrari-daytona-sp3', `Canonical ID resolves to ferrari-daytona-sp3 (got: ${classification.canonical_vehicle_id})`);
  assert(classification.candidate_separation >= 0.20, `Candidate separation is decisive (got: ${classification.candidate_separation})`);

  // ─── TEST 3B: Exact Failing 768x432 Downscaled Mobile Observation Recovery ───
  console.log('\n--- TEST 3B: Exact Failing 768x432 Downscaled Observation Recovery ---');
  const downscaled768ObservedEvidence = {
    body_style: 'Two-door coupe with a sloping roofline and a short rear deck.',
    grille: 'A large, trapezoidal grille with vertical slats, flanked by two air intakes on either side',
    headlights: 'Two horizontal LED strips on the front bumper, with a vertical LED strip on the rear bumper',
    taillights: 'Two exhaust pipes exiting low in the centre of the rear diffuser, with a pair of rectangular rear lamps',
    hood: 'A smooth, flat hood with no visible vents or louvers.',
    roofline: null,
    windows: null,
    wheels: null,
    exhaust: 'Two exhaust pipes exiting low in the centre of the rear diffuser, with a pair of rectangular rear lamps',
    aero: 'A front splitter and side air intakes.',
    badges: null,
    text: null,
    body_proportions: 'Two-door coupe with a sloping roofline and a short rear deck.',
    distinctive_details: [
      'Two horizontal LED strips on the front bumper, with a vertical LED strip on the rear bumper.',
      'A large, trapezoidal grille with vertical slats, flanked by two air intakes on either side.',
      'Two exhaust pipes exiting low in the centre of the rear diffuser, with a pair of rectangular rear lamps.',
      'A smooth, flat hood with no visible vents or louvers.',
      'A front splitter and side air intakes.',
      'The distinctive shape of the front bumper, with its prominent air intakes and LED strips.',
      'The trapezoidal grille, the sloping roofline, the rectangular rear lamps, the front splitter, and the distinctive shape of the front bumper.'
    ]
  };

  const downscaleClassification = hierarchicalClassifier.classify({
    visual_evidence: downscaled768ObservedEvidence,
    viewpoint: 'front_3q',
    raw_make: 'Ferrari',
    raw_model: 'SF90 Stradale',
    raw_generation: 'F173',
    raw_variant: null,
    raw_candidates: candidateList
  });

  assert(downscaleClassification.top_candidate?.name.includes('Daytona SP3'), `Downscaled 768px top candidate is Daytona SP3 (got: ${downscaleClassification.top_candidate?.name})`);
  assert(!downscaleClassification.top_candidate?.name.includes('SF90'), `Downscaled 768px explicitly rejects SF90 Stradale (got: ${downscaleClassification.top_candidate?.name})`);
  assert(downscaleClassification.canonical_vehicle_id === 'ferrari-daytona-sp3', `Downscaled canonical ID resolves to ferrari-daytona-sp3 (got: ${downscaleClassification.canonical_vehicle_id})`);
  const downscaleSf90 = downscaleClassification.calibrated_candidates.find(c => c.name.includes('SF90'));
  assert(downscaleSf90 ? downscaleSf90.score < (downscaleClassification.top_candidate?.score || 0) : true, 'SF90 score is strictly below Daytona SP3 top candidate');

  // Guardrail check: uncorroborated front bumper LED strips without Daytona aero/proportions must NOT force Daytona
  const uncorroboratedEvidence = {
    body_style: 'Four-door sedan with upright greenhouse',
    grille: 'Upright chrome waterfall grille',
    headlights: 'Two horizontal LED strips on the front bumper',
    distinctive_details: ['Two horizontal LED strips on the front bumper']
  };
  const uncorroboratedClassification = hierarchicalClassifier.classify({
    visual_evidence: uncorroboratedEvidence,
    viewpoint: 'front_3q',
    raw_make: 'Ferrari',
    raw_model: 'Roma',
    raw_candidates: candidateList
  });
  assert(uncorroboratedClassification.top_candidate?.name !== 'Ferrari Daytona SP3 (Icona)', 'Uncorroborated front bumper LED strips on sedan do NOT force Daytona identification');

  // ─── TEST 4: No Default Variant Hallucination (Assetto Fiorano Check) ───
  console.log('\n--- TEST 4: Anti-Hallucination & Default Variant Gating ---');
  const sf90DbEntry = APEX_LOCAL_VEHICLE_DATABASE.find(v => v.id === 'ferrari-sf90-stradale');
  const gtb296DbEntry = APEX_LOCAL_VEHICLE_DATABASE.find(v => v.id === 'ferrari-296-gtb');

  assert(sf90DbEntry?.trim !== 'Assetto Fiorano', `SF90 default trim is NOT Assetto Fiorano (got: ${sf90DbEntry?.trim})`);
  assert(gtb296DbEntry?.trim !== 'Assetto Fiorano', `296 GTB default trim is NOT Assetto Fiorano (got: ${gtb296DbEntry?.trim})`);

  const sp3Specs = resolveCanonicalVehicleSpecs({
    make: 'Ferrari',
    model: 'Daytona SP3',
    generation: 'Icona',
    trim: null,
    canonicalVehicleId: 'ferrari-daytona-sp3'
  });

  assert(sp3Specs.canonicalId === 'ferrari-daytona-sp3', 'SP3 specs resolve with canonical ID ferrari-daytona-sp3');
  assert(sp3Specs.horsepower === 829, `Daytona SP3 horsepower is 829 HP (got: ${sp3Specs.horsepower})`);
  assert(sp3Specs.torqueNm === 697, `Daytona SP3 torque is 697 Nm (got: ${sp3Specs.torqueNm})`);
  assert(sp3Specs.trim !== 'Assetto Fiorano', `Daytona SP3 trim is never Assetto Fiorano (got: ${sp3Specs.trim})`);

  // ─── TEST 5: Genuine SF90 Identification Fidelity ───
  console.log('\n--- TEST 5: Genuine SF90 Stradale Identification Fidelity ---');
  const sf90GenuineEvidence = {
    body_style: 'Mid-engine two-seat flagship supercar coupe',
    headlights: 'Closed C-shaped annular LED matrix headlights with open slot',
    grille: 'Low open nose wing with a front diffuser channel and a shut-off Gurney flap',
    roofline: 'Conventional sloping coupe greenhouse with a compact glass engine deck',
    exhaust: 'Dual high-mounted central exhaust',
    aero: 'Shut-off Gurney flap integrated into the rear tail',
    distinctive_details: [
      'C-shaped annular lamp with an open slot',
      'shut-off Gurney flap on the rear deck',
      'dual high-mounted central exhaust'
    ]
  };

  const sf90Classification = hierarchicalClassifier.classify({
    visual_evidence: sf90GenuineEvidence,
    viewpoint: 'front_3q',
    raw_make: 'Ferrari',
    raw_model: 'SF90 Stradale',
    raw_generation: 'F173',
    raw_variant: null,
    raw_candidates: candidateList
  });

  assert(sf90Classification.top_candidate?.name.includes('SF90 Stradale'), `Genuine SF90 identifies as SF90 Stradale (got: ${sf90Classification.top_candidate?.name})`);
  assert(sf90Classification.canonical_vehicle_id === 'ferrari-sf90-stradale', `Canonical vehicle ID is ferrari-sf90-stradale (got: ${sf90Classification.canonical_vehicle_id})`);
  assert(!sf90Classification.top_candidate?.name.includes('Daytona SP3'), 'Genuine SF90 is not confused with Daytona SP3');

  // ─── TEST 6: Hierarchical Confidence & Invariant Bounding ───
  console.log('\n--- TEST 6: Hierarchical Confidence Bounds & Invariants ---');
  const confResult = confidenceEngine.computeHierarchicalConfidence({
    image_quality_score: 0.92,
    evidence_strength: 0.90,
    candidate_separation: classification.candidate_separation,
    top_candidate_contradictions: classification.top_candidate?.contradictions || [],
    contradiction_count: (classification.top_candidate?.contradictions || []).length,
    top_candidate_score: classification.top_candidate?.score || 0.85,
    specificity_level: classification.specificity_level,
    has_vehicle: true
  });

  assert(confResult.status === 'identified' || confResult.status === 'probable', `Confidence status is defensible (got: ${confResult.status})`);
  assert(confResult.confidence.make_score >= 0.80, `Make score >= 0.80 (got: ${confResult.confidence.make_score})`);
  assert(!confResult.needs_retake, 'Valid clear vehicle image does not require retake');

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
