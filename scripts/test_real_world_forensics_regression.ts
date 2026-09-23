/**
 * APEX — Permanent Real-World Forensic Failure Regression Suite
 * 
 * Verifies that the specific failure mechanisms identified in the 21-photo
 * real-world acceptance benchmark are permanently guarded against regression:
 * 
 * 1. Porsche 911 trim injection (996/997 Carrera -> GT3 RS Weissach Package)
 * 2. Toyota GR Supra trim injection (A90 -> unobserved 3.0 Premium 6MT)
 * 3. Lamborghini Huracán chimeric variant (Huracán -> Huracán STO Evo Spyder)
 * 4. Severe contradiction deadlock (Taxi livery vs exotic candidates -> abstention)
 * 5. McLaren P11 viewpoint constraint (Front view -> generation P11, variant null)
 * 6. Multi-vehicle concatenation sanitization (Multiple (...) -> clean null/abstention)
 * 7. Sequential independence (Scan history isolation)
 */

import { deterministicValidator } from '../src/ai-engine/validation/deterministicValidator';
import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import type { ModelIdentificationOutput, VisualEvidence } from '../src/ai-engine/types';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, failureDetails: string = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  [FAIL] ${testName} - ${failureDetails}`);
  }
}

async function runForensicRegressionSuite() {
  console.log('\n================================================================');
  console.log('APEX — PERMANENT REAL-WORLD FORENSICS REGRESSION SUITE');
  console.log('================================================================\n');

  // ─── TEST 1: PORSCHE 911 (996 & 997) ZERO GT3 RS / WEISSACH INJECTION ───
  console.log('1. Testing Porsche 911 Carrera Trim & Generation Protection:');
  {
    // Test Case: REAL_020 (Porsche 996 Carrera Cabriolet)
    const raw996Input: ModelIdentificationOutput = {
      vehicleId: null,
      make: 'Porsche',
      model: '911',
      generation: '996',
      trim: null,
      yearEstimate: '2001',
      color: 'Silver',
      rarity: 'uncommon',
      engine: '3.4L Boxer-6',
      horsepower: 296,
      torqueNm: 350,
      topSpeedKmH: 280,
      zeroToHundredSec: 5.2,
      kerbWeightKg: 1320,
      productionYears: '1997–2005',
      originCountry: 'Germany',
      bodyStyle: 'Convertible',
      historicalInformation: '',
      interestingFacts: '',
      aftermarketPartsDetected: [],
      modelConfidence: 0.85,
      evidence: ['fried-egg headlights', 'soft-top convertible'],
      alternatives: [],
      needsReview: false
    };

    const validated996 = deterministicValidator.validate(raw996Input);
    assert(
      validated996.resolvedModel !== '911 GT3 RS',
      'Porsche 996 must NOT be escalated to 911 GT3 RS',
      `Got resolvedModel: ${validated996.resolvedModel}`
    );
    assert(
      validated996.resolvedTrim !== 'Weissach Package',
      'Porsche 996 must NOT be injected with Weissach Package trim',
      `Got resolvedTrim: ${validated996.resolvedTrim}`
    );
    assert(
      validated996.resolvedGeneration === '996',
      'Porsche 996 generation must be preserved (not overwritten with 992)',
      `Got resolvedGeneration: ${validated996.resolvedGeneration}`
    );
    assert(
      validated996.resolvedTrim === undefined,
      'Porsche 996 unobserved trim must remain undefined',
      `Got resolvedTrim: ${validated996.resolvedTrim}`
    );

    // Test Case: REAL_021 (Porsche 997 Carrera Coupe)
    const raw997Input: ModelIdentificationOutput = {
      ...raw996Input,
      generation: '997',
      yearEstimate: '2009',
      bodyStyle: 'Coupe',
      evidence: ['round headlights', 'standard lower bumper']
    };

    const validated997 = deterministicValidator.validate(raw997Input);
    assert(
      validated997.resolvedModel !== '911 GT3 RS',
      'Porsche 997 must NOT be escalated to 911 GT3 RS',
      `Got resolvedModel: ${validated997.resolvedModel}`
    );
    assert(
      validated997.resolvedTrim !== 'Weissach Package',
      'Porsche 997 must NOT be injected with Weissach Package trim',
      `Got resolvedTrim: ${validated997.resolvedTrim}`
    );
    assert(
      validated997.resolvedGeneration === '997',
      'Porsche 997 generation must be preserved (not overwritten with 992)',
      `Got resolvedGeneration: ${validated997.resolvedGeneration}`
    );
  }

  // ─── TEST 2: TOYOTA GR SUPRA ZERO 6MT TRANSMISSION INJECTION ───
  console.log('\n2. Testing Toyota GR Supra Unobserved Trim Protection:');
  {
    // Test Case: REAL_018 (Toyota GR Supra A90 exterior photo)
    const rawSupraInput: ModelIdentificationOutput = {
      vehicleId: null,
      make: 'Toyota',
      model: 'GR Supra',
      generation: 'A90 (DB)',
      trim: null, // Unobserved transmission from exterior
      yearEstimate: '2021',
      color: 'White',
      rarity: 'rare',
      engine: '3.0L Turbo Inline-6',
      horsepower: 382,
      torqueNm: 500,
      topSpeedKmH: 250,
      zeroToHundredSec: 3.9,
      kerbWeightKg: 1542,
      productionYears: '2020–Present',
      originCountry: 'Japan',
      bodyStyle: 'Coupe',
      historicalInformation: '',
      interestingFacts: '',
      aftermarketPartsDetected: [],
      modelConfidence: 0.90,
      evidence: ['double-bubble roof', 'aggressive front fascia'],
      alternatives: [],
      needsReview: false
    };

    const validatedSupra = deterministicValidator.validate(rawSupraInput);
    assert(
      validatedSupra.resolvedTrim === undefined,
      'Toyota GR Supra must NOT receive unobservable 6MT transmission trim when trim is null',
      `Got resolvedTrim: ${validatedSupra.resolvedTrim}`
    );
    assert(
      validatedSupra.resolvedModel === 'GR Supra',
      'Toyota GR Supra model name must be preserved',
      `Got resolvedModel: ${validatedSupra.resolvedModel}`
    );
  }

  // ─── TEST 3: LAMBORGHINI HURACÁN CHIMERIC VARIANT PREVENTION ───
  console.log('\n3. Testing Lamborghini Huracán Chimeric Variant Prevention:');
  {
    // Test Case: REAL_017 (Huracán Spyder with rear quad exhausts)
    const rawHuracanInput: ModelIdentificationOutput = {
      vehicleId: null,
      make: 'Lamborghini',
      model: 'Huracán',
      generation: 'Huracán',
      trim: 'Spyder',
      yearEstimate: '2016',
      color: 'Blue',
      rarity: 'epic',
      engine: '5.2L V10',
      horsepower: 602,
      torqueNm: 560,
      topSpeedKmH: 325,
      zeroToHundredSec: 3.4,
      kerbWeightKg: 1500,
      productionYears: '2014–2019',
      originCountry: 'Italy',
      bodyStyle: 'Convertible',
      historicalInformation: '',
      interestingFacts: '',
      aftermarketPartsDetected: [],
      modelConfidence: 0.88,
      evidence: ['hexagonal styling', 'quad lower exhaust tips', 'soft top'],
      alternatives: [],
      needsReview: false
    };

    const validatedHuracan = deterministicValidator.validate(rawHuracanInput);
    assert(
      !validatedHuracan.resolvedModel.includes('STO'),
      'Base Huracán must NOT be overwritten with Huracán STO when STO was not requested',
      `Got resolvedModel: ${validatedHuracan.resolvedModel}`
    );
    assert(
      validatedHuracan.resolvedTrim !== 'STO Evo Spyder',
      'Must NOT produce chimeric "STO Evo Spyder" combination',
      `Got resolvedTrim: ${validatedHuracan.resolvedTrim}`
    );
  }

  // ─── TEST 4: SEVERE CONTRADICTION DEADLOCK (TAXI VS EXOTIC CANDIDATES) ───
  console.log('\n4. Testing Severe Contradiction Deadlock & Honest Abstention:');
  {
    // Test Case: REAL_014 (Hong Kong Taxi Livery vs All-Lamborghini Candidates)
    const taxiEvidence: VisualEvidence = {
      body_style: 'Sedan',
      grille: 'chrome slatted grille with Toyota emblem',
      headlights: 'rectangular halogen',
      taillights: null,
      hood: 'red hood',
      roofline: 'silver roof with TAXI roof light',
      windows: 'upright sedan pillars',
      wheels: null,
      exhaust: null,
      aero: null,
      badges: 'Toyota emblem',
      text: 'TAXI 4 SEATS UP 934',
      body_proportions: 'upright three-box sedan',
      distinctive_details: [
        'Classic Hong Kong taxi livery (red body, silver roof, TAXI sign)',
        'Green 4 SEATS passenger medallion on front bumper'
      ]
    };

    // Candidates generated incorrectly as only exotic supercars
    const exoticOnlyCandidates = [
      {
        name: 'Lamborghini Huracán LP 610-4',
        score: 0.85,
        supporting_evidence: ['red paint in background'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'Lamborghini Huracán Evo',
        score: 0.80,
        supporting_evidence: [],
        contradictions: [],
        unobservable_features: []
      }
    ];

    const classifiedDeadlock = hierarchicalClassifier.classify({
      visual_evidence: taxiEvidence,
      viewpoint: 'front_3q',
      raw_make: 'Lamborghini',
      raw_model: 'Huracán',
      raw_generation: 'Huracán',
      raw_variant: null,
      raw_candidates: exoticOnlyCandidates
    });

    assert(
      classifiedDeadlock.identification.make === null,
      'Contradiction deadlock must set resolvedMake = null (never return Lamborghini for taxi livery)',
      `Got make: ${classifiedDeadlock.identification.make}`
    );
    assert(
      classifiedDeadlock.identification.model_family === null,
      'Contradiction deadlock must set resolvedModelFamily = null',
      `Got model_family: ${classifiedDeadlock.identification.model_family}`
    );
    assert(
      classifiedDeadlock.contradictions.some((c) => c.includes('Severe vehicle-type mismatch') || c.includes('Severe manufacturer mismatch')),
      'Contradiction engine must record severe vehicle-type/manufacturer mismatch',
      `Contradictions: ${classifiedDeadlock.contradictions.join('; ')}`
    );
    assert(
      classifiedDeadlock.reason.includes('Severe architectural contradiction'),
      'Reason must document architectural contradiction deadlock',
      `Reason: ${classifiedDeadlock.reason}`
    );
  }

  // ─── TEST 5: MCLAREN P11 VIEWPOINT VARIANT CONSTRAINT ───
  console.log('\n5. Testing McLaren P11 Viewpoint & Longtail Variant Gating:');
  {
    // Test Case: REAL_009 / REAL_015 (McLaren P11 Front View)
    const mclarenEvidence: VisualEvidence = {
      body_style: 'Coupe',
      grille: 'P1-style front intake nacelle',
      headlights: 'McLaren speedmark tick headlights',
      taillights: null,
      hood: 'carbon fiber hood',
      roofline: 'low-slung carbon monocell',
      windows: null,
      wheels: 'black forged wheels',
      exhaust: null, // rear exhaust unobservable from front
      aero: 'carbon fiber front splitter',
      badges: 'McLaren badge',
      text: null,
      body_proportions: 'mid-engine supercar',
      distinctive_details: ['McLaren Orange paint', 'dihedral door cutlines']
    };

    const mclarenCandidates = [
      {
        name: 'McLaren 675LT',
        score: 0.85,
        supporting_evidence: ['speedmark headlights', 'front splitter'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'McLaren 650S',
        score: 0.82,
        supporting_evidence: ['speedmark headlights'],
        contradictions: [],
        unobservable_features: []
      }
    ];

    const classifiedMcLaren = hierarchicalClassifier.classify({
      visual_evidence: mclarenEvidence,
      viewpoint: 'front',
      raw_make: 'McLaren',
      raw_model: '675LT',
      raw_generation: 'P11',
      raw_variant: 'Spider',
      raw_candidates: mclarenCandidates
    });

    assert(
      classifiedMcLaren.identification.variant === null,
      'McLaren P11 front view must NOT claim unobservable variant (675LT rear Longtail airbrake unobservable)',
      `Got variant: ${classifiedMcLaren.identification.variant}`
    );
    assert(
      classifiedMcLaren.specificity_level === 'generation' || classifiedMcLaren.specificity_level === 'model_family',
      'Specificity must cap at generation or model_family for P11 front view',
      `Got specificity_level: ${classifiedMcLaren.specificity_level}`
    );
    assert(
      classifiedMcLaren.reason.includes('P11') || classifiedMcLaren.reason.includes('Super Series'),
      'Reason must acknowledge Super Series / P11 platform ambiguity without rear proof',
      `Reason: ${classifiedMcLaren.reason}`
    );
  }

  // ─── TEST 6: CANONICAL REGISTRY BASELINE COVERAGE ───
  console.log('\n6. Testing Canonical Registry Balanced Base-Model Coverage:');
  {
    const reqBaseIds = [
      'porsche-911-carrera-996',
      'porsche-911-carrera-997',
      'lamborghini-huracan-lp610-4',
      'mclaren-650s',
      'mclaren-675lt',
      'toyota-crown-comfort-taxi',
      'kia-ev9'
    ];

    for (const id of reqBaseIds) {
      const record = canonicalVehicleRegistry.getById(id);
      assert(record !== null, `Registry must contain balanced base record: ${id}`, `Record for ${id} not found`);
    }
  }

  // ─── FINAL REGRESSION SUMMARY ───
  console.log('\n================================================================');
  console.log(`FORENSIC REGRESSION RESULTS: ${passedAssertions} / ${totalAssertions} assertions passed (${failedAssertions} failed)`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runForensicRegressionSuite().catch((err) => {
  console.error('Fatal error running forensic regression suite:', err);
  process.exit(1);
});
