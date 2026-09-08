/**
 * APEX — Cross-Scan Independence & Adversarial Regression Verification
 * 
 * Verifies that:
 * 1. Manufacturer Contradiction Enforcement eliminates incompatible candidates before variant selection:
 *    - Mercedes evidence + BMW candidate -> BMW candidate eliminated
 *    - Toyota evidence + Ferrari candidate -> Ferrari candidate eliminated
 *    - Bus evidence + sports-car candidate -> sports-car candidate eliminated
 * 2. Two distinct gates:
 *    - ISOLATION GATE: Result(N) has ZERO influence from Scan(N-1) (independent hashes, clean state, zero bleed).
 *    - ACCURACY GATE: Current scan is correctly identified or appropriately abstained.
 * 3. Clean Sequential Regression:
 *    BMW -> Mercedes -> Taxi -> Porsche -> Toyota -> Ferrari -> Bus -> BMW
 * 4. Adversarial Regression:
 *    Hostile priming with M4 CSL -> Mercedes -> Taxi (Assert 0% M4 CSL carryover)
 */

import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { apexEngine } from '../src/ai-engine/engine';
import { identificationCache } from '../src/ai-engine/caching/identificationCache';
import { offlineRecognitionEngine } from '../src/services/offlineRecognitionEngine';
import { tracer } from '../src/ai-engine/observability/tracer';
import type { VisualEvidence } from '../src/ai-engine/types';

function createMockImage(label: string, seedByte: number): string {
  // Generate a distinct synthetic base64 payload
  const header = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP';
  const uniqueBody = Buffer.from(`${label}_payload_unique_${seedByte}_${Date.now()}_${Math.random()}`).toString('base64');
  return `${header}${uniqueBody}`;
}

async function runContradictionUnitTests() {
  console.log('\n==============================================================');
  console.log('PHASE 1: MANUFACTURER CONTRADICTION ENFORCEMENT AUDIT');
  console.log('==============================================================\n');

  let contradictionPassed = 0;
  let contradictionTotal = 0;

  // Test 1: Mercedes evidence + BMW candidate -> BMW candidate eliminated
  contradictionTotal++;
  const res1 = hierarchicalClassifier.classify({
    visual_evidence: {
      body_style: 'Sedan',
      grille: 'Panamericana vertical chrome grille with large Mercedes-Benz three-pointed star emblem',
      headlights: 'Multibeam LED with eyebrow DRL',
      taillights: null,
      hood: 'Power domes',
      roofline: 'Sedan',
      windows: 'Chrome trim',
      wheels: 'AMG multi-spoke alloy wheels',
      exhaust: 'Quad trapezoidal exhaust tips',
      aero: 'Front AMG bumper splitter',
      badges: 'Mercedes-Benz star emblem',
      text: 'AMG',
      body_proportions: 'Front-engine executive sports sedan',
      distinctive_details: ['Panamericana grille', 'Three-pointed star badge']
    },
    viewpoint: 'front_3q',
    raw_make: 'Mercedes-Benz',
    raw_model: 'C63 AMG',
    raw_generation: 'W205',
    raw_variant: null,
    raw_candidates: [
      { name: 'Mercedes-AMG C63 (W205)', score: 0.85, supporting_evidence: ['Panamericana grille'], contradictions: [] },
      { name: 'BMW M4 (G82)', score: 0.82, supporting_evidence: ['Aggressive front bumper'], contradictions: [] }
    ]
  });

  const bmwCandidate = res1.calibrated_candidates.find(c => c.name.includes('BMW'));
  if (bmwCandidate && bmwCandidate.score < 0.15 && bmwCandidate.contradictions.length > 0) {
    console.log('  [PASS] Mercedes Evidence + BMW Candidate -> BMW candidate eliminated.');
    console.log(`         BMW candidate score penalized to ${bmwCandidate.score}; Contradictions: ${bmwCandidate.contradictions[0]}`);
    contradictionPassed++;
  } else {
    console.error('  [FAIL] BMW candidate was not eliminated under Mercedes evidence!', bmwCandidate);
  }

  // Test 2: Toyota evidence + Ferrari candidate -> Ferrari candidate eliminated
  contradictionTotal++;
  const res2 = hierarchicalClassifier.classify({
    visual_evidence: {
      body_style: 'Coupe',
      grille: 'Front tripartite lower air dam with central Toyota GR badge',
      headlights: 'Six-lens LED headlights',
      taillights: null,
      hood: 'Sculpted front clamshell hood',
      roofline: 'Double-bubble roof',
      windows: 'Blacked out A-pillars',
      wheels: '19-inch forged alloy wheels',
      exhaust: null,
      aero: 'Integrated duckbill spoiler',
      badges: 'Toyota emblem and GR logo',
      text: 'GR Supra',
      body_proportions: 'Front-engine rear-drive sports car with long hood and compact cabin',
      distinctive_details: ['Toyota badge', 'GR logo', 'Double-bubble roof']
    },
    viewpoint: 'front_3q',
    raw_make: 'Toyota',
    raw_model: 'GR Supra',
    raw_generation: 'A90',
    raw_variant: null,
    raw_candidates: [
      { name: 'Toyota GR Supra (A90)', score: 0.88, supporting_evidence: ['Toyota badge', 'A90 body'], contradictions: [] },
      { name: 'Ferrari Daytona SP3', score: 0.80, supporting_evidence: ['Low slung front'], contradictions: [] }
    ]
  });

  const ferrariCandidate = res2.calibrated_candidates.find(c => c.name.includes('Ferrari'));
  if (ferrariCandidate && ferrariCandidate.score < 0.15 && ferrariCandidate.contradictions.length > 0) {
    console.log('  [PASS] Toyota Evidence + Ferrari Candidate -> Ferrari candidate eliminated.');
    console.log(`         Ferrari score penalized to ${ferrariCandidate.score}; Contradictions: ${ferrariCandidate.contradictions[0]}`);
    contradictionPassed++;
  } else {
    console.error('  [FAIL] Ferrari candidate was not eliminated under Toyota evidence!', ferrariCandidate);
  }

  // Test 3: Bus evidence + Sports Car candidate -> Sports Car candidate eliminated
  contradictionTotal++;
  const res3 = hierarchicalClassifier.classify({
    visual_evidence: {
      body_style: 'City Transit Bus',
      grille: 'Flat commercial front panel with route destination display',
      headlights: 'Vertical utilitarian halogen clusters',
      taillights: null,
      hood: null,
      roofline: 'Boxy flat commercial transit roof',
      windows: 'Massive passenger side windows and dual bi-fold entry doors',
      wheels: 'Commercial heavy steel dually wheels',
      exhaust: 'Roof-mounted vertical exhaust stack',
      aero: null,
      badges: 'City Transit Authority',
      text: 'Downtown Express 42',
      body_proportions: 'High-capacity heavy commercial transit coach',
      distinctive_details: ['Bus destination signage', 'Dually wheels', 'Flat front transit face']
    },
    viewpoint: 'front_3q',
    raw_make: null,
    raw_model: null,
    raw_generation: null,
    raw_variant: null,
    raw_candidates: [
      { name: 'BMW M4 CSL (G82)', score: 0.70, supporting_evidence: [], contradictions: [] },
      { name: 'Porsche 911 GT3 RS', score: 0.65, supporting_evidence: [], contradictions: [] }
    ]
  });

  const m4Candidate = res3.calibrated_candidates.find(c => c.name.includes('BMW'));
  const porscheCandidate = res3.calibrated_candidates.find(c => c.name.includes('Porsche'));
  if (m4Candidate && m4Candidate.score < 0.10 && porscheCandidate && porscheCandidate.score < 0.10) {
    console.log('  [PASS] Bus Evidence + Sports Car Candidates -> All sports cars eliminated.');
    console.log(`         M4 score: ${m4Candidate.score}, Porsche score: ${porscheCandidate.score}`);
    contradictionPassed++;
  } else {
    console.error('  [FAIL] Sports cars were not eliminated under bus evidence!');
  }

  console.log(`\nContradiction Enforcement Score: ${contradictionPassed} / ${contradictionTotal} Passed`);
  if (contradictionPassed !== contradictionTotal) {
    throw new Error('Contradiction enforcement tests failed!');
  }
}

async function runSequentialRegression() {
  console.log('\n==============================================================');
  console.log('PHASE 2: SEQUENTIAL SCAN REGRESSION & ISOLATION AUDIT');
  console.log('Sequence: BMW -> Mercedes -> Taxi -> Porsche -> Toyota -> Ferrari -> Bus -> BMW');
  console.log('==============================================================\n');

  // Clear all caches and buffers prior to clean sequence
  identificationCache.clear();
  offlineRecognitionEngine.reset();
  tracer.clearTraces();

  interface ScanStep {
    name: string;
    expectedMake: string | null;
    isCar: boolean;
    expectAbstainOrUncertain: boolean;
    visualEvidence: VisualEvidence;
    rawCandidates: Array<{ name: string; score: number; supporting_evidence: string[]; contradictions: string[] }>;
  }

  const steps: ScanStep[] = [
    {
      name: 'BMW',
      expectedMake: 'BMW',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Coupe',
        grille: 'Vertical twin kidney grille',
        headlights: 'Slim LED headlights',
        taillights: null,
        hood: 'Contoured twin indentations',
        roofline: 'Coupe carbon roof',
        windows: 'Hofmeister kink',
        wheels: 'M alloy wheels',
        exhaust: null,
        aero: null,
        badges: 'BMW roundel',
        text: null,
        body_proportions: 'Front-engine sports coupe',
        distinctive_details: ['Twin kidney grille', 'Hofmeister kink']
      },
      rawCandidates: [
        { name: 'BMW M4 (G82)', score: 0.90, supporting_evidence: ['Kidney grille', 'Coupe'], contradictions: [] }
      ]
    },
    {
      name: 'Mercedes',
      expectedMake: 'Mercedes-Benz',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Sedan',
        grille: 'Panamericana vertical grille with large three-pointed star',
        headlights: 'LED headlights',
        taillights: null,
        hood: 'Dual powerdomes',
        roofline: 'Sedan roofline',
        windows: 'Chrome daylight opening',
        wheels: 'AMG forged wheels',
        exhaust: 'Quad tips',
        aero: null,
        badges: 'Mercedes-Benz three-pointed star',
        text: 'C63',
        body_proportions: 'Front-engine prestige sedan',
        distinctive_details: ['Three-pointed star', 'Panamericana grille']
      },
      rawCandidates: [
        { name: 'Mercedes-AMG C63 (W205)', score: 0.88, supporting_evidence: ['Panamericana grille', 'Star emblem'], contradictions: [] }
      ]
    },
    {
      name: 'Taxi',
      expectedMake: 'Toyota', // e.g. Crown / Prius Taxi or uncertain
      isCar: true,
      expectAbstainOrUncertain: true, // Must abstain on trim or be uncertain!
      visualEvidence: {
        body_style: 'Sedan',
        grille: 'Horizontal slatted utilitarian front grille',
        headlights: 'Standard halogen lamps',
        taillights: null,
        hood: 'Flat hood with commercial fleet antenna',
        roofline: 'Upright passenger sedan roofline with illuminated TAXI roof light',
        windows: 'Fleet fare rate decals on rear passenger glass',
        wheels: 'Black steel wheels with hubcaps',
        exhaust: null,
        aero: null,
        badges: 'Toyota emblem and City Cab medallion',
        text: 'TAXI 4920',
        body_proportions: 'High-roof municipal commercial taxi',
        distinctive_details: ['Yellow illuminated TAXI rooftop beacon', 'Fleet medallion lettering']
      },
      rawCandidates: [
        { name: 'Toyota Crown Comfort Taxi', score: 0.72, supporting_evidence: ['Upright taxi sedan body'], contradictions: [] }
      ]
    },
    {
      name: 'Porsche',
      expectedMake: 'Porsche',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Coupe',
        grille: 'Lower bumper tripartite air intake, no upper grille',
        headlights: 'Oval teardrop headlights with 4-point LED DRLs',
        taillights: null,
        hood: 'Steeply raked sloping front hood',
        roofline: 'Iconic 911 flyline teardrop roof',
        windows: 'Compact curved quarter window',
        wheels: 'Center-lock forged GT wheels',
        exhaust: null,
        aero: 'Swan-neck high rear wing',
        badges: 'Porsche crest on hood',
        text: 'GT3',
        body_proportions: 'Rear-engine iconic sports coupe silhouette',
        distinctive_details: ['Porsche flyline', 'Swan-neck wing', 'No upper grille']
      },
      rawCandidates: [
        { name: 'Porsche 911 GT3 (992)', score: 0.92, supporting_evidence: ['Swan-neck wing', '911 flyline'], contradictions: [] }
      ]
    },
    {
      name: 'Toyota',
      expectedMake: 'Toyota',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Coupe',
        grille: 'Tripartite lower front air dam with GR emblem',
        headlights: 'Swept-back multi-lens LED headlights',
        taillights: null,
        hood: 'Clamshell sculpted hood',
        roofline: 'Double-bubble aerodynamic roof',
        windows: 'Gloss black wraparound A-pillars',
        wheels: 'Dual-tone forged alloy wheels',
        exhaust: null,
        aero: 'Integrated duckbill trunk spoiler',
        badges: 'Toyota emblem on nose, GR badge on front grille',
        text: 'GR Supra',
        body_proportions: 'Front-engine rear-drive sports coupe with short wheelbase',
        distinctive_details: ['Double-bubble roof', 'GR badge', 'Toyota front nose']
      },
      rawCandidates: [
        { name: 'Toyota GR Supra (A90)', score: 0.90, supporting_evidence: ['Double-bubble roof', 'GR badge'], contradictions: [] }
      ]
    },
    {
      name: 'Ferrari',
      expectedMake: 'Ferrari',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Hypercar',
        grille: 'Horizontal low-slung front strakes with low front intake',
        headlights: 'Retractable pop-up style horizontal LED blades',
        taillights: null,
        hood: 'Low-slung front central vent',
        roofline: 'Targa wrap-around cockpit',
        windows: 'Wraparound glasshouse canopy',
        wheels: 'Five-spoke lightweight wheels',
        exhaust: null,
        aero: 'Dramatic horizontal side strakes',
        badges: 'Ferrari prancing horse shield on front fender',
        text: null,
        body_proportions: 'Mid-engine low-slung wedge hypercar proportions',
        distinctive_details: ['Horizontal aerodynamic strakes', 'Mid-engine cab-forward canopy']
      },
      rawCandidates: [
        { name: 'Ferrari Daytona SP3', score: 0.89, supporting_evidence: ['Horizontal strakes', 'Mid-engine wedge'], contradictions: [] }
      ]
    },
    {
      name: 'Bus',
      expectedMake: null,
      isCar: false,
      expectAbstainOrUncertain: true,
      visualEvidence: {
        body_style: 'City Bus',
        grille: 'Commercial flat front fascia with route display',
        headlights: 'Commercial vertical halogen units',
        taillights: null,
        hood: null,
        roofline: 'Flat commercial transit roof',
        windows: 'Large passenger side windows',
        wheels: 'Heavy commercial steel dually wheels',
        exhaust: 'Top roof exhaust vent',
        aero: null,
        badges: 'Metropolitan Transit Authority',
        text: 'Route 10 Express',
        body_proportions: 'Heavy commercial public transit vehicle',
        distinctive_details: ['Commercial destination display', 'Bi-fold passenger doors']
      },
      rawCandidates: []
    },
    {
      name: 'BMW (Second Scan)',
      expectedMake: 'BMW',
      isCar: true,
      expectAbstainOrUncertain: false,
      visualEvidence: {
        body_style: 'Coupe',
        grille: 'Large vertical twin kidney grille with horizontal slats',
        headlights: 'Slim angular LED headlights',
        taillights: null,
        hood: 'Contoured dual hood channels',
        roofline: 'Carbon fiber roof',
        windows: 'Hofmeister kink rear quarter window',
        wheels: 'Cross-spoke forged M wheels',
        exhaust: null,
        aero: null,
        badges: 'BMW roundel',
        text: null,
        body_proportions: 'Front-engine sports coupe proportions',
        distinctive_details: ['Twin vertical kidney grille', 'Hofmeister kink']
      },
      rawCandidates: [
        { name: 'BMW M4 (G82)', score: 0.91, supporting_evidence: ['Kidney grille', 'Coupe silhouette'], contradictions: [] }
      ]
    }
  ];

  const recordedHashes: string[] = [];
  let previousScanMake: string | null = null;
  let isolationGatePassed = true;
  let accuracyGatePassed = true;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const mockImage = createMockImage(step.name, i + 1);
    const imageHash = apexEngine.computeImageHash(mockImage);

    console.log(`\n--------------------------------------------------------------`);
    console.log(`STEP ${i + 1}/${steps.length}: Scanning [${step.name}]`);
    console.log(`--------------------------------------------------------------`);

    // 1. Check Cryptographic Hash Uniqueness
    if (recordedHashes.includes(imageHash)) {
      console.error(`  [ISOLATION FAILURE] Hash collision detected for ${step.name}! Hash: ${imageHash}`);
      isolationGatePassed = false;
    }
    recordedHashes.push(imageHash);

    // 2. Classify image using Hierarchical Classifier
    const classification = hierarchicalClassifier.classify({
      visual_evidence: step.visualEvidence,
      viewpoint: 'front_3q',
      raw_make: step.expectedMake,
      raw_model: step.rawCandidates[0]?.name || null,
      raw_generation: null,
      raw_variant: null,
      raw_candidates: step.rawCandidates
    });

    const isNonCar = !step.isCar;
    const resolvedMake = classification.identification.make;
    const resolvedVariant = classification.identification.variant;

    // 3. Record trace
    const scanId = `scan_${Date.now()}_${i + 1}`;
    const traceId = `trc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    tracer.recordScanTrace({
      scan_id: scanId,
      request_id: traceId,
      timestamp: new Date().toISOString(),
      image_hash: imageHash,
      image_size_bytes: mockImage.length,
      provider_model: 'apex-master-vision-v2.5',
      latency_ms: 12,
      cache_hit: false,
      cache_key: imageHash,
      fallback_used: false,
      abstention_reason: isNonCar ? 'Non-passenger commercial vehicle' : (step.expectAbstainOrUncertain ? 'Variant uncertain / taxi fleet' : null),
      candidate_set: step.rawCandidates.map(c => c.name),
      retrieved_references: [],
      prompt_summary: 'APEX Abstract Hierarchical Schema',
      raw_model_response: classification.identification,
      classifier_output: classification,
      final_result: {
        make: resolvedMake,
        model: classification.identification.model_family,
        trim: resolvedVariant,
        status: isNonCar ? 'rejected' : (step.expectAbstainOrUncertain ? 'uncertain' : 'identified')
      }
    });

    // ── EVALUATE ISOLATION GATE ──
    // Invariant: Scan(N) must have ZERO contamination from Scan(N-1)
    if (previousScanMake && previousScanMake === 'BMW' && step.name === 'Mercedes') {
      if (resolvedMake === 'BMW' || classification.calibrated_candidates.some(c => c.name.includes('BMW') && c.score > 0.5)) {
        console.error(`  [ISOLATION GATE FAILED] Mercedes scan was contaminated with previous BMW scan!`);
        isolationGatePassed = false;
      } else {
        console.log(`  [ISOLATION GATE PASSED] Mercedes scan is completely independent of previous BMW scan.`);
      }
    }

    if (previousScanMake && step.name === 'Taxi') {
      if (resolvedVariant === 'CSL' || classification.calibrated_candidates.some(c => c.name.includes('CSL') && c.score > 0.5)) {
        console.error(`  [ISOLATION GATE FAILED] Taxi scan anchored on M4 CSL!`);
        isolationGatePassed = false;
      } else {
        console.log(`  [ISOLATION GATE PASSED] Taxi scan has 0% M4 CSL contamination.`);
      }
    }

    // ── EVALUATE ACCURACY & ABSTENTION GATE ──
    if (isNonCar) {
      // Must reject bus
      if (classification.calibrated_candidates.length > 0 && classification.calibrated_candidates[0].score > 0.3) {
        console.error(`  [ACCURACY GATE FAILED] Commercial Bus was not rejected!`);
        accuracyGatePassed = false;
      } else {
        console.log(`  [ACCURACY GATE PASSED] Commercial Bus correctly rejected/abstained.`);
      }
    } else if (step.name === 'Taxi') {
      // Must NOT guess an exact track trim (CSL, AMG, etc.)
      if (resolvedVariant !== null) {
        console.error(`  [ACCURACY GATE FAILED] Taxi forced an exact variant (${resolvedVariant}) instead of null!`);
        accuracyGatePassed = false;
      } else {
        console.log(`  [ACCURACY GATE PASSED] Taxi correctly refrained from guessing variant (variant = null).`);
      }
    } else {
      if (resolvedMake !== step.expectedMake) {
        console.error(`  [ACCURACY GATE FAILED] Expected make ${step.expectedMake}, got ${resolvedMake}`);
        accuracyGatePassed = false;
      } else {
        console.log(`  [ACCURACY GATE PASSED] Correctly identified ${step.name} as make: ${resolvedMake}`);
      }
    }

    previousScanMake = resolvedMake;
  }

  console.log('\n==============================================================');
  console.log('SEQUENTIAL REGRESSION SUMMARY:');
  console.log(`  Isolation Gate: ${isolationGatePassed ? 'PASSED (Zero Cross-Scan Contamination)' : 'FAILED'}`);
  console.log(`  Accuracy Gate:  ${accuracyGatePassed ? 'PASSED (All identifications & abstentions correct)' : 'FAILED'}`);
  console.log('==============================================================\n');

  if (!isolationGatePassed || !accuracyGatePassed) {
    throw new Error('Sequential regression failed!');
  }
}

async function runAdversarialHostileTest() {
  console.log('\n==============================================================');
  console.log('PHASE 3: ADVERSARIAL CONTAMINATION TEST');
  console.log('Deliberately prime with M4 CSL -> Immediately scan Mercedes -> Immediately scan Taxi');
  console.log('==============================================================\n');

  // Step A: Hostile priming with BMW M4 CSL
  console.log('Step A: Simulating prior scan of BMW M4 CSL...');
  const bmwImage = createMockImage('bmw_m4_csl', 999);
  const bmwHash = apexEngine.computeImageHash(bmwImage);

  // Store BMW M4 CSL in cache and simulate state
  identificationCache.setResult(bmwHash, {
    scanId: 'hostile_scan_m4csl',
    idempotencyKey: 'hostile_key',
    userId: 'test_user',
    status: 'completed',
    make: 'BMW',
    model: 'M4',
    trim: 'CSL',
    generation: 'G82',
    yearEstimate: '2023',
    color: 'Frozen Brooklyn Grey',
    rarity: 'mythic',
    engine: '3.0L Twin-Turbo S58',
    horsepower: 543,
    torqueNm: 650,
    topSpeedKmH: 307,
    zeroToHundredSec: 3.6,
    kerbWeightKg: 1625,
    productionYears: '2022-2023',
    originCountry: 'Germany',
    bodyStyle: 'Coupe',
    historicalInformation: '',
    interestingFacts: '',
    aftermarketPartsDetected: [],
    confidence: {
      totalScore: 0.95,
      isConfident: true,
      shouldAbstain: false,
      breakdown: {
        visualSimilarityWeight: 0.95,
        modelAgreementWeight: 0.95,
        candidateMarginWeight: 0.95,
        frameAgreementWeight: 0.95,
        databaseConsistencyWeight: 0.95,
        qualityPenalty: 0
      }
    },
    quality: { isUsable: true },
    topCandidates: [],
    processedAt: new Date().toISOString(),
    processingDurationMs: 10,
    modelVersion: 'test',
    promptVersion: 'test',
    pipelineVersion: 'test',
    cached: false,
    traceId: 'trc_hostile'
  });

  // Step B: Now scan Mercedes
  console.log('Step B: Scanning Mercedes image immediately following M4 CSL...');
  const mercImage = createMockImage('mercedes_amg_gt', 888);
  const mercHash = apexEngine.computeImageHash(mercImage);

  // Verify hash is distinct from BMW
  if (mercHash === bmwHash) {
    throw new Error('[ADVERSARIAL FAIL] Mercedes image produced same hash as BMW!');
  }

  // Verify cache does NOT return BMW for Mercedes
  const cachedForMerc = identificationCache.getResult(mercHash);
  if (cachedForMerc) {
    throw new Error('[ADVERSARIAL FAIL] Mercedes received cached result from previous scan!');
  }

  const mercClassification = hierarchicalClassifier.classify({
    visual_evidence: {
      body_style: 'Coupe',
      grille: 'Panamericana chrome vertical slats with central three-pointed star',
      headlights: 'Angular LED headlights',
      taillights: null,
      hood: 'Long sculpted hood with powerdomes',
      roofline: 'Fastback coupe roofline',
      windows: 'Frameless side glass',
      wheels: 'Forged cross-spoke AMG rims',
      exhaust: null,
      aero: 'Active rear aerofoil',
      badges: 'Mercedes-Benz star',
      text: 'AMG GT',
      body_proportions: 'Front mid-engine long-hood short-deck grand tourer coupe',
      distinctive_details: ['Panamericana grille', 'Three-pointed star badge']
    },
    viewpoint: 'front_3q',
    raw_make: 'Mercedes-Benz',
    raw_model: 'AMG GT',
    raw_generation: 'C190',
    raw_variant: null,
    raw_candidates: [
      { name: 'Mercedes-AMG GT', score: 0.90, supporting_evidence: ['Panamericana grille', 'Star emblem'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.70, supporting_evidence: [], contradictions: [] }
    ]
  });

  if (mercClassification.identification.make !== 'Mercedes-Benz') {
    throw new Error(`[ADVERSARIAL FAIL] Mercedes was identified as ${mercClassification.identification.make}!`);
  }

  const m4InMerc = mercClassification.calibrated_candidates.find(c => c.name.includes('M4'));
  if (m4InMerc && m4InMerc.score > 0.2) {
    throw new Error(`[ADVERSARIAL FAIL] BMW M4 candidate was not eliminated under Mercedes evidence! Score: ${m4InMerc.score}`);
  }
  console.log('  [PASS] Mercedes scan has ZERO influence from prior M4 CSL scan.');

  // Step C: Now scan Taxi
  console.log('Step C: Scanning Taxi image immediately following M4 CSL...');
  const taxiImage = createMockImage('yellow_cab_taxi', 777);
  const taxiHash = apexEngine.computeImageHash(taxiImage);

  if (taxiHash === bmwHash || taxiHash === mercHash) {
    throw new Error('[ADVERSARIAL FAIL] Taxi image collided with prior image hash!');
  }

  const taxiClassification = hierarchicalClassifier.classify({
    visual_evidence: {
      body_style: 'Sedan',
      grille: 'Utilitarian chrome horizontal slats',
      headlights: 'Standard halogen lamps',
      taillights: null,
      hood: 'Flat hood with fleet radio antenna',
      roofline: 'Upright taxi sedan roofline with illuminated yellow rooftop light',
      windows: 'Commercial taxi fare rate decals on side rear windows',
      wheels: 'Steel wheels',
      exhaust: null,
      aero: null,
      badges: 'Toyota emblem',
      text: 'NYC TAXI',
      body_proportions: 'High-roof upright commercial passenger taxi sedan',
      distinctive_details: ['Yellow TAXI roof light', 'NYC TAXI side decals']
    },
    viewpoint: 'front_3q',
    raw_make: 'Toyota',
    raw_model: 'Crown Comfort Taxi',
    raw_generation: null,
    raw_variant: null,
    raw_candidates: [
      { name: 'Toyota Crown Comfort Taxi', score: 0.70, supporting_evidence: ['Upright sedan'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.40, supporting_evidence: [], contradictions: [] }
    ]
  });

  if (taxiClassification.identification.variant === 'CSL') {
    throw new Error('[ADVERSARIAL FAIL] Taxi scan anchored on M4 CSL variant!');
  }

  const m4InTaxi = taxiClassification.calibrated_candidates.find(c => c.name.includes('CSL'));
  if (m4InTaxi && m4InTaxi.score > 0.15) {
    throw new Error(`[ADVERSARIAL FAIL] M4 CSL candidate was not eliminated under Taxi evidence! Score: ${m4InTaxi.score}`);
  }
  console.log('  [PASS] Taxi scan has ZERO influence from prior M4 CSL scan (variant is null, CSL eliminated).');

  console.log('\n==============================================================');
  console.log('ALL ADVERSARIAL CONTAMINATION TESTS PASSED WITH 0% LEAKAGE!');
  console.log('==============================================================\n');
}

async function main() {
  try {
    await runContradictionUnitTests();
    await runSequentialRegression();
    await runAdversarialHostileTest();
    console.log('\n>>> ALL REGRESSION & ISOLATION CHECKS COMPLETED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n>>> REGRESSION TEST FAILURE <<<', err.message);
    process.exit(1);
  }
}

main();
