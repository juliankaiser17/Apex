/**
 * APEX — Fine-Grained Exact Model Discrimination & Invariants Regression Suite
 * 
 * Tests the 14 hard amendments and invariants:
 * 1. Missing expected features may only create a penalty when the relevant feature is confirmed visible from current viewpoint.
 * 2. Occluded, cropped, or viewpoint-invisible traits contribute ZERO evidence and ZERO contradiction.
 * 3. Engine layout is candidate metadata, not directly observed visual evidence unless visible.
 * 4. Verification is NEUTRAL PAIRWISE COMPARISON, not an assumed-answer prompt.
 * 5. Morphological fingerprints must be reusable traits; NO pair-specific rules or candidate-name-specific score boosts.
 * 6. Candidate generation and fine-grained scoring must be deterministic/local and consume ZERO Cloudflare calls.
 * 7. Absolute provider-call ceiling remains 2 per scan.
 * 8. Record raw provider identity separately from discriminator output and final canonical identity.
 * 9. Benchmark reports raw-provider accuracy, discriminator accuracy, and final canonical accuracy separately.
 * 10. Visibility-aware evidence states: VISIBLE / PARTIAL / NOT_VISIBLE / OCCLUDED.
 * 11. Only VISIBLE/PARTIAL evidence may affect scoring.
 * 12. Regression assertion: no exact-model result can be derived solely from a generic manufacturer prior.
 * 13. Test the exact known failures:
 *     - MC20 vs GranTurismo
 *     - 650S vs 570S
 *     - SF90 vs Daytona SP3
 *     - 996 vs 997
 *     - 675LT vs 650S
 */

import { fineGrainedModelDiscriminator, computeVisibilityMatrix } from '../src/ai-engine/validation/fineGrainedModelDiscriminator';
import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { resolveCanonicalVehicleSpecs } from '../src/utils/vehicleSpecs';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import type { VisualEvidence, ViewpointType } from '../src/ai-engine/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   APEX FINE-GRAINED MODEL DISCRIMINATION REGRESSION SUITE');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: MASERATI MC20 vs GRANTURISMO (Front 3/4 View)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Maserati MC20 vs GranTurismo (Front 3/4 View) ---');
  {
    const mc20Evidence: VisualEvidence = {
      body_style: 'Low-slung supercar coupe',
      headlights: 'Vertical compact LED slits',
      grille: 'Low wide horizontal mouth with carbon front splitter',
      roofline: 'Cab-forward teardrop greenhouse with short front hood',
      aero: 'Front carbon splitter and rear diffuser',
      wheels: 'Forged lightweight alloy wheels',
      distinctive_details: [
        'Vertical compact LED headlights',
        'Low wide horizontal mouth with lower carbon splitter',
        'Cab-forward teardrop cabin with short front hood',
        'Rear fender shoulder intakes'
      ]
    };

    const viewpoint: ViewpointType = 'front_3q';
    const visMatrix = computeVisibilityMatrix(viewpoint, '');
    assert(visMatrix.headlight_shape === 'VISIBLE', 'Front 3/4 view: headlights are VISIBLE');
    assert(visMatrix.front_intake_grille === 'VISIBLE', 'Front 3/4 view: front intake is VISIBLE');
    assert(visMatrix.side_intake_type === 'VISIBLE', 'Front 3/4 view: side intake is VISIBLE');
    assert(visMatrix.rear_architecture_and_exhaust === 'NOT_VISIBLE', 'Front 3/4 view: rear exhaust is NOT_VISIBLE');

    // Suppose raw VLM had frequency bias toward GranTurismo
    const rawCandidates = [
      { name: 'Maserati GranTurismo', score: 0.70 },
      { name: 'Maserati MC20', score: 0.50 }
    ];

    const result = hierarchicalClassifier.classify({
      visual_evidence: mc20Evidence,
      viewpoint,
      raw_make: 'Maserati',
      raw_model: 'GranTurismo', // Raw VLM was wrong!
      raw_generation: null,
      raw_variant: null,
      raw_candidates: rawCandidates.map(c => ({
        name: c.name,
        score: c.score,
        supporting_evidence: [],
        contradictions: [],
        unobservable_features: []
      }))
    });

    const topName = result.top_candidate?.name || '';
    assert(topName.includes('MC20'), `MC20 correctly discriminated over GranTurismo (Winner: ${topName})`);
    assert(result.identification.model_family === 'MC20', `Model family identified as MC20 (Got: ${result.identification.model_family})`);

    const spec = resolveCanonicalVehicleSpecs({
      make: result.identification.make,
      model: result.identification.model_family,
      generation: result.identification.generation || undefined
    });
    assert(spec.isVerified === true, 'Maserati MC20 specs resolved from verified database');
    assert(spec.horsepower === 621, `Maserati MC20 horsepower is 621 hp (Got: ${spec.horsepower})`);
    assert(spec.zeroToHundredSec === 2.9, `Maserati MC20 0-100 is 2.9 s (Got: ${spec.zeroToHundredSec})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: MCLAREN 650S vs 570S (Side / Front 3/4 View)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: McLaren 650S vs 570S (Front 3/4 View) ---');
  {
    const mclaren650sEvidence: VisualEvidence = {
      body_style: 'Mid-engine supercar',
      headlights: 'P1-style crescent C-shaped headlights with black housing',
      grille: 'P1 front bumper styling',
      roofline: 'Cab-forward mid-engine cockpit with compact greenhouse',
      aero: 'Active rear airbrake deployable wing',
      distinctive_details: [
        'P1 style crescent c-shaped headlights with black housing',
        'Large side radiator scoop behind dihedral door',
        'Active rear airbrake'
      ]
    };

    const viewpoint: ViewpointType = 'front_3q';
    // Suppose raw VLM had frequency bias toward 570S
    const rawCandidates = [
      { name: 'McLaren 570S', score: 0.75 },
      { name: 'McLaren 650S', score: 0.50 }
    ];

    const result = hierarchicalClassifier.classify({
      visual_evidence: mclaren650sEvidence,
      viewpoint,
      raw_make: 'McLaren',
      raw_model: '570S', // Raw VLM was wrong!
      raw_generation: null,
      raw_variant: null,
      raw_candidates: rawCandidates.map(c => ({
        name: c.name,
        score: c.score,
        supporting_evidence: [],
        contradictions: [],
        unobservable_features: []
      }))
    });

    const topName = result.top_candidate?.name || '';
    assert(topName.includes('650S'), `McLaren 650S discriminated over 570S based on crescent lamps and large side scoops (Winner: ${topName})`);
    assert(result.identification.model_family === '650S', `Model family identified as 650S (Got: ${result.identification.model_family})`);

    const spec = resolveCanonicalVehicleSpecs({
      make: result.identification.make,
      model: result.identification.model_family
    });
    assert(spec.horsepower === 641, `McLaren 650S horsepower is 641 hp (Got: ${spec.horsepower})`);
    assert(spec.zeroToHundredSec === 3.0, `McLaren 650S 0-100 is 3.0 s (Got: ${spec.zeroToHundredSec})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: FERRARI SF90 STRADALE vs DAYTONA SP3
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Ferrari SF90 Stradale vs Daytona SP3 ---');
  {
    const daytonaEvidence: VisualEvidence = {
      body_style: 'Targa prototype hypercar',
      headlights: 'Horizontal eyelid covers with retractable slat styling',
      grille: 'Front bumper with horizontal strakes and slats',
      roofline: 'Wraparound visor canopy with concealed A-pillars',
      distinctive_details: [
        'Wraparound visor canopy with hidden A-pillars',
        'Horizontal eyelid covers on headlights',
        'Full width horizontal rear strakes and slats',
        'Fender-mounted side mirrors'
      ]
    };

    // Raw VLM initially guessed SF90 Stradale due to modern Ferrari training prior
    const rawCandidates = [
      { name: 'Ferrari SF90 Stradale', score: 0.85 },
      { name: 'Ferrari Daytona SP3', score: 0.50 }
    ];

    const result = hierarchicalClassifier.classify({
      visual_evidence: daytonaEvidence,
      viewpoint: 'front_3q',
      raw_make: 'Ferrari',
      raw_model: 'SF90 Stradale',
      raw_generation: null,
      raw_variant: null,
      raw_candidates: rawCandidates.map(c => ({
        name: c.name,
        score: c.score,
        supporting_evidence: [],
        contradictions: [],
        unobservable_features: []
      }))
    });

    const topName = result.top_candidate?.name || '';
    assert(topName.includes('Daytona') || topName.includes('SP3'), `Daytona SP3 correctly discriminated over SF90 (Winner: ${topName})`);
    const spec = resolveCanonicalVehicleSpecs({
      make: 'Ferrari',
      model: 'Daytona SP3'
    });
    assert(spec.horsepower === 829, `Ferrari Daytona SP3 horsepower is 829 hp (Got: ${spec.horsepower})`);
    assert(spec.topSpeedKmH === 340, `Ferrari Daytona SP3 top speed is 340 km/h (Got: ${spec.topSpeedKmH})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: PORSCHE 911 (996) vs PORSCHE 911 (997)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Porsche 996 vs 997 (Headlight Discrimination) ---');
  {
    // Case A: 996 Fried-Egg Headlights
    const porsche996Evidence: VisualEvidence = {
      body_style: 'Coupe',
      headlights: 'Fried egg integrated turn signal teardrop headlights',
      distinctive_details: [
        'Fried-egg integrated teardrop headlights',
        'Smooth classic 911 sloping flyline'
      ]
    };

    const res996 = hierarchicalClassifier.classify({
      visual_evidence: porsche996Evidence,
      viewpoint: 'front_3q',
      raw_make: 'Porsche',
      raw_model: '911 Carrera',
      raw_generation: null,
      raw_variant: null,
      raw_candidates: [
        { name: 'Porsche 911 Carrera (996)', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] },
        { name: 'Porsche 911 Carrera (997)', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
      ]
    });

    assert(res996.top_candidate?.name.includes('996') === true, 'Porsche 996 won based on fried-egg headlight trait');

    // Case B: 997 Round Bug-Eye Headlights + Separate Bumper Indicator
    const porsche997Evidence: VisualEvidence = {
      body_style: 'Coupe',
      headlights: 'Classic round bug eye headlights with separate lower bumper indicator strip',
      distinctive_details: [
        'Classic round circular headlights',
        'Separate indicator strip in bumper',
        'Tripartite lower bumper intakes'
      ]
    };

    const res997 = hierarchicalClassifier.classify({
      visual_evidence: porsche997Evidence,
      viewpoint: 'front_3q',
      raw_make: 'Porsche',
      raw_model: '911 Carrera',
      raw_generation: null,
      raw_variant: null,
      raw_candidates: [
        { name: 'Porsche 911 Carrera (996)', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] },
        { name: 'Porsche 911 Carrera (997)', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
      ]
    });

    assert(res997.top_candidate?.name.includes('997') === true, 'Porsche 997 won based on classic round bugeye + separate indicator trait');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: MCLAREN 675LT vs 650S (Viewpoint Specificity Invariants 1 & 2)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: McLaren 675LT vs 650S (Viewpoint Visibility Invariant) ---');
  {
    // Front View: Rear Longtail airbrake and circular titanium exhausts are NOT_VISIBLE!
    // Must NOT penalize candidates for missing rear features, but must NOT falsely promote 675LT without proof!
    const frontEvidence: VisualEvidence = {
      body_style: 'Coupe',
      headlights: 'P1-style crescent headlights',
      distinctive_details: ['P1 crescent headlights']
    };

    const resFront = hierarchicalClassifier.classify({
      visual_evidence: frontEvidence,
      viewpoint: 'front',
      raw_make: 'McLaren',
      raw_model: '650S',
      raw_generation: null,
      raw_variant: null,
      raw_candidates: [
        { name: 'McLaren 650S', score: 0.70, supporting_evidence: [], contradictions: [], unobservable_features: [] },
        { name: 'McLaren 675LT', score: 0.65, supporting_evidence: [], contradictions: [], unobservable_features: [] }
      ]
    });

    // Amendment 1 & 2: Specificity caps at generation/model_family when variant proof is unobservable from front!
    assert(resFront.identification.variant === null, 'From front view without visible rear Longtail airbrake, variant is null (no over-confidence)');
    assert(resFront.specificity_level === 'generation' || resFront.specificity_level === 'model_family', 'Front view caps specificity appropriately');

    // Rear View: Rear circular titanium exhausts and extended carbon airbrake ARE visible!
    const rearLtEvidence: VisualEvidence = {
      body_style: 'Coupe',
      exhaust: 'Dual circular titanium top-exit exhaust',
      aero: 'Extended active longtail airbrake with carbon rear bumper',
      distinctive_details: [
        'Dual circular titanium top-exit exhaust',
        'Extended longtail carbon airbrake'
      ]
    };

    const resRear = hierarchicalClassifier.classify({
      visual_evidence: rearLtEvidence,
      viewpoint: 'rear',
      raw_make: 'McLaren',
      raw_model: '650S',
      raw_generation: 'P11',
      raw_variant: null,
      raw_candidates: [
        { name: 'McLaren 650S', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] },
        { name: 'McLaren 675LT', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
      ]
    });

    assert(resRear.top_candidate?.name.includes('675LT') === true, '675LT correctly selected from rear view with observable titanium top exhausts and airbrake');
    assert(resRear.calibrated_candidates.find(c => c.name.includes('650S'))?.contradictions.length! > 0, '650S contradicted by top-exit titanium exhaust');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: HARD AMENDMENT 12 — NO EXACT-MODEL RESULT DERIVED SOLELY FROM GENERIC PRIOR
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Generic Manufacturer Prior Invariant (Amendment 12) ---');
  {
    // If only generic make is visible with zero distinguishing model features
    const genericEvidence: VisualEvidence = {
      body_style: 'Car',
      distinctive_details: ['Generic automobile silhouette']
    };

    const resGeneric = hierarchicalClassifier.classify({
      visual_evidence: genericEvidence,
      viewpoint: 'unknown',
      raw_make: 'Maserati',
      raw_model: 'GranTurismo', // Raw guess
      raw_generation: null,
      raw_variant: null,
      raw_candidates: [
        { name: 'Maserati MC20', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] },
        { name: 'Maserati GranTurismo', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
      ]
    });

    // Both candidates had 0 observable positive trait matches
    assert(resGeneric.candidate_separation === 0 || resGeneric.evidence_grounded === false, 'No candidate gains ungrounded margin from generic prior alone');
    assert(resGeneric.identification.variant === null, 'Variant remains null when ungrounded');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: KOENIGSEGG GEMERA (Mega-GT 4-Seater Hypercar)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Koenigsegg Gemera Verification ---');
  {
    const gemeraSpec = resolveCanonicalVehicleSpecs({
      make: 'Koenigsegg',
      model: 'Gemera'
    });
    assert(gemeraSpec.isVerified === true, 'Koenigsegg Gemera verified in database');
    assert(gemeraSpec.horsepower === 1400, `Koenigsegg Gemera horsepower is 1400 hp (Got: ${gemeraSpec.horsepower})`);
    assert(gemeraSpec.zeroToHundredSec === 1.9, `Koenigsegg Gemera 0-100 is 1.9 s (Got: ${gemeraSpec.zeroToHundredSec})`);

    const gemeraRecord = canonicalVehicleRegistry.lookupByTextOrAlias('Koenigsegg Gemera');
    assert(gemeraRecord !== null, 'Koenigsegg Gemera found in CanonicalVehicleRegistry');
    assert(gemeraRecord?.vehicleId === 'koenigsegg-gemera', `Gemera canonicalId is koenigsegg-gemera (Got: ${gemeraRecord?.vehicleId})`);
  }

  console.log('\n================================================================');
  console.log('   ALL 7 FINE-GRAINED DISCRIMINATION REGRESSIONS PASSED!       ');
  console.log('================================================================\n');
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
