/**
 * APEX — Targeted Release Recognition Matrix
 * 
 * Evaluates the required target release checks:
 * 1. Daytona SP3
 * 2. Koenigsegg (Jesko)
 * 3. 458
 * 4. SF90
 * 5. 296 GTB
 * 6. McLaren 675LT (previously problematic)
 * 7. Porsche 718 Boxster (previously problematic)
 * 8. Ambiguous crop (honest abstention)
 */

import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';
import type { VisualEvidence, ViewpointType } from '../src/ai-engine/types';

interface MatrixCase {
  id: string;
  expected_make: string;
  expected_model: string;
  expected_canonical: string | null;
  raw_make: string;
  raw_model: string;
  raw_generation?: string;
  viewpoint: ViewpointType;
  visual_evidence: VisualEvidence;
  is_ambiguous?: boolean;
}

function seedCandidates(rawMake: string, rawModel: string, rawScore = 0.88) {
  const list = [
    { name: `${rawMake} ${rawModel}`, score: rawScore, supporting_evidence: [], contradictions: [], unobservable_features: [] }
  ];
  for (const v of APEX_LOCAL_VEHICLE_DATABASE) {
    if (v.manufacturer.toLowerCase() !== rawMake.toLowerCase()) continue;
    const peerName = `${v.manufacturer} ${v.model}`;
    if (!list.some(c => c.name.toLowerCase() === peerName.toLowerCase())) {
      list.push({ name: peerName, score: 0.5, supporting_evidence: [], contradictions: [], unobservable_features: [] });
    }
  }
  return list;
}

const MATRIX_CASES: MatrixCase[] = [
  // 1. Ferrari Daytona SP3
  {
    id: 'CASE_1_DAYTONA_SP3',
    expected_make: 'Ferrari',
    expected_model: 'Daytona SP3',
    expected_canonical: 'ferrari-daytona-sp3',
    raw_make: 'Ferrari',
    raw_model: 'Daytona SP3',
    raw_generation: 'Icona',
    viewpoint: 'front_3q',
    visual_evidence: {
      distinctive_details: ['horizontal eyelid covers with retractable headlights', 'horizontal strakes across front bumper', 'wraparound visor canopy', 'fender-mounted mirrors'],
      badges_detected: ['Ferrari'],
      front_fascia: 'horizontal strakes slatted grille across front',
      rear_fascia: '',
      aerodynamic_features: ['wraparound visor canopy', 'fender-mounted mirrors']
    }
  },
  // 2. Koenigsegg Jesko
  {
    id: 'CASE_2_KOENIGSEGG_JESKO',
    expected_make: 'Koenigsegg',
    expected_model: 'Jesko',
    expected_canonical: 'koenigsegg-jesko',
    raw_make: 'Koenigsegg',
    raw_model: 'Jesko',
    raw_generation: 'Jesko',
    viewpoint: 'side_profile',
    visual_evidence: {
      distinctive_details: ['giant top-mounted boomerang rear wing', 'fighter jet canopy with wraparound visor windshield', 'dihedral synchro-helix doors'],
      badges_detected: ['Koenigsegg'],
      front_fascia: 'swept-back led blades',
      rear_fascia: 'massive carbon diffuser and central exhaust exit',
      aerodynamic_features: ['boomerang wing with top pylons']
    }
  },
  // 3. Ferrari 458 Italia / Spider
  {
    id: 'CASE_3_FERRARI_458',
    expected_make: 'Ferrari',
    expected_model: '458',
    expected_canonical: 'ferrari-458',
    raw_make: 'Ferrari',
    raw_model: '458',
    raw_generation: '458',
    viewpoint: 'front_3q',
    visual_evidence: {
      distinctive_details: ['elongated vertical headlight clusters with LED daytime running lights', 'slender deformable front aeroelastic winglets in grille', 'single central triple-exhaust pipe setup'],
      badges_detected: ['Ferrari'],
      front_fascia: 'wide single open grille mouth with deformable winglets',
      rear_fascia: 'triple central circular exhaust pipes flanked by round single taillights',
      aerodynamic_features: ['deformable winglets', 'vented front fenders']
    }
  },
  // 4. Ferrari SF90 Stradale
  {
    id: 'CASE_4_FERRARI_SF90',
    expected_make: 'Ferrari',
    expected_model: 'SF90 Stradale',
    expected_canonical: 'ferrari-sf90-stradale',
    raw_make: 'Ferrari',
    raw_model: 'SF90 Stradale',
    raw_generation: 'F173',
    viewpoint: 'front_3q',
    visual_evidence: {
      distinctive_details: ['C-shaped matrix LED headlights with integrated air intakes', 'shut-off Gurney active flap on rear wing', 'high central twin exhaust tips'],
      badges_detected: ['Ferrari'],
      front_fascia: 'C-shaped headlamp slits with low pronounced nose cone',
      rear_fascia: 'squircle horizontal quad taillights, dual elevated center exhaust',
      aerodynamic_features: ['shut-off Gurney active rear wing', 'vortex generators']
    }
  },
  // 5. Ferrari 296 GTB
  {
    id: 'CASE_5_FERRARI_296',
    expected_make: 'Ferrari',
    expected_model: '296 GTB',
    expected_canonical: 'ferrari-296-gtb',
    raw_make: 'Ferrari',
    raw_model: '296 GTB',
    raw_generation: 'F171',
    viewpoint: 'front_3q',
    visual_evidence: {
      distinctive_details: ['teardrop headlight with recessed lamp into wing scoop', 'low wide mesh grille with exposed radiators', 'flying buttress rear deck over shallow screen'],
      badges_detected: ['Ferrari'],
      front_fascia: 'low wide mesh grille with mouth intake',
      rear_fascia: 'single central exhaust in the diffuser',
      aerodynamic_features: ['flying buttress rear deck']
    }
  },
  // 6. McLaren 675LT (previously problematic variant vs 650S)
  {
    id: 'CASE_6_MCLAREN_675LT',
    expected_make: 'McLaren',
    expected_model: '675LT',
    expected_canonical: 'mclaren-675lt',
    raw_make: 'McLaren',
    raw_model: '675LT',
    raw_generation: 'Super Series (P11)',
    viewpoint: 'rear_3q',
    visual_evidence: {
      distinctive_details: ['extended active Longtail carbon fiber airbrake (50% larger than 650S)', 'circular dual titanium high-exit exhaust pipes', 'carbon fiber rear bumper and diffuser vents'],
      badges_detected: ['McLaren'],
      front_fascia: 'prominent carbon fiber front splitter with end plates',
      rear_fascia: 'open mesh rear fascia, extended active Longtail airbrake wing, dual circular titanium exhaust',
      aerodynamic_features: ['extended active Longtail airbrake', 'aggressive louvred carbon front wings']
    }
  },
  // 7. Porsche 718 Boxster (previously problematic vs 911)
  {
    id: 'CASE_7_PORSCHE_718_BOXSTER',
    expected_make: 'Porsche',
    expected_model: '718 Boxster',
    expected_canonical: 'porsche-718-boxster',
    raw_make: 'Porsche',
    raw_model: '718 Boxster',
    raw_generation: '982',
    viewpoint: 'side_profile',
    visual_evidence: {
      distinctive_details: ['mid-engine side air intake scoops behind doors', 'fabric convertible roadster soft top', 'accent strip with integrated PORSCHE lettering between taillights'],
      badges_detected: ['Porsche'],
      front_fascia: 'horizontal LED four-point daytime running headlights',
      rear_fascia: 'three-dimensional taillight strip with PORSCHE lettering, central dual exhaust',
      aerodynamic_features: ['side air intake strakes for mid-engine turbo cooling']
    }
  },
  // 8. Ambiguous / Partial Crop (Honest Abstention)
  {
    id: 'CASE_8_AMBIGUOUS_CROP',
    expected_make: 'Ferrari',
    expected_model: '', // Expected to abstain from specific model
    expected_canonical: null,
    raw_make: 'Ferrari',
    raw_model: '', // VLM uncertain or no model evidence
    raw_generation: undefined,
    viewpoint: 'close_up',
    visual_evidence: {
      distinctive_details: ['red painted metallic bodywork panel', 'yellow prancing horse shield emblem badge'],
      badges_detected: ['Ferrari'],
      front_fascia: '',
      rear_fascia: '',
      aerodynamic_features: []
    },
    is_ambiguous: true
  }
];

export async function runMatrix() {
  console.log('==============================================================');
  console.log('APEX — TARGETED PRODUCTION RECOGNITION MATRIX');
  console.log('==============================================================\n');

  let totalCases = MATRIX_CASES.length;
  let exactModelCorrect = 0;
  let modelFamilyCorrect = 0;
  let makeCorrect = 0;
  let falseExactCount = 0;
  let manufacturerErrors = 0;
  let honestAbstentions = 0;
  let unknownCount = 0;

  console.log('Executing targeted classification and canonical mapping...\n');

  for (const tc of MATRIX_CASES) {
    const rawCandidates = seedCandidates(tc.raw_make, tc.raw_model || 'Unknown', 0.88);

    const classification = hierarchicalClassifier.classify({
      visual_evidence: tc.visual_evidence,
      viewpoint: tc.viewpoint,
      raw_make: tc.raw_make,
      raw_model: tc.raw_model,
      raw_generation: tc.raw_generation || null,
      raw_variant: null,
      raw_candidates: rawCandidates
    });

    const resMake = classification.identification.make || '';
    const resModel = classification.identification.model_family || '';
    const specificity = classification.specificity_level;
    const winnerCandidate = classification.top_candidate?.name || 'None';
    console.log(`[DEBUG ${tc.id}] separation: ${classification.candidate_separation}, reason: ${classification.reason}`);
    console.log(`[DEBUG ${tc.id}] top candidate:`, classification.top_candidate?.name, 'score:', classification.top_candidate?.score);

    // Canonical resolution
    let canon = canonicalVehicleRegistry.resolveCanonicalIdentity({
      make: resMake,
      model: resModel,
      generation: classification.identification.generation || undefined
    });

    const isAbstention = classification.is_uncertain || specificity === 'make' || !resModel;
    const isMakeMatch = resMake.toLowerCase() === tc.expected_make.toLowerCase();
    const isModelFamilyMatch = tc.is_ambiguous 
      ? isAbstention
      : resModel.toLowerCase().includes(tc.expected_model.toLowerCase()) || tc.expected_model.toLowerCase().includes(resModel.toLowerCase());
    
    let isExactMatch = false;
    if (tc.is_ambiguous) {
      isExactMatch = isAbstention && !canon?.canonicalId;
    } else {
      isExactMatch = canon?.canonicalId === tc.expected_canonical;
    }

    if (isMakeMatch) makeCorrect++;
    else manufacturerErrors++;

    if (isModelFamilyMatch) modelFamilyCorrect++;
    if (isExactMatch) exactModelCorrect++;

    if (tc.is_ambiguous && isAbstention) {
      honestAbstentions++;
    } else if (!tc.is_ambiguous && isAbstention) {
      // Valid vehicle collapsed to unknown model
      unknownCount++;
    }

    if (tc.is_ambiguous && !isAbstention) {
      falseExactCount++;
    }

    console.log(`--------------------------------------------------------------`);
    console.log(`[${tc.id}]`);
    console.log(`  expected vehicle       : ${tc.expected_make} ${tc.expected_model || '(Abstain/Ambiguous)'}`);
    console.log(`  raw VLM                : ${tc.raw_make} ${tc.raw_model || '(None)'}`);
    console.log(`  candidate winner       : ${winnerCandidate}`);
    console.log(`  final canonical vehicle: ${canon?.displayName || 'None'} [ID: ${canon?.canonicalId || 'null'}]`);
    console.log(`  specificity            : ${specificity}`);
    console.log(`  status                 : ${classification.is_uncertain ? 'uncertain' : 'identified'}`);
    console.log(`  correct/incorrect      : ${isExactMatch ? '✅ CORRECT' : '❌ INCORRECT'}`);
    console.log(`  abstention             : ${isAbstention ? 'YES (Honest)' : 'NO'}`);
  }

  console.log('\n==============================================================');
  console.log('TARGETED MATRIX RESULTS SUMMARY:');
  console.log('==============================================================');
  console.log(`Total Cases Evaluated   : ${totalCases}`);
  console.log(`1. Exact-Model Accuracy : ${(exactModelCorrect / totalCases * 100).toFixed(1)}% (${exactModelCorrect}/${totalCases})`);
  console.log(`2. Model-Family Accuracy: ${(modelFamilyCorrect / totalCases * 100).toFixed(1)}% (${modelFamilyCorrect}/${totalCases})`);
  console.log(`3. Make Accuracy        : ${(makeCorrect / totalCases * 100).toFixed(1)}% (${makeCorrect}/${totalCases})`);
  console.log(`4. False-Exact Rate     : ${(falseExactCount / totalCases * 100).toFixed(1)}% (${falseExactCount}/${totalCases})`);
  console.log(`5. Manufacturer Error   : ${(manufacturerErrors / totalCases * 100).toFixed(1)}% (${manufacturerErrors}/${totalCases})`);
  console.log(`6. Honest Abstention    : ${honestAbstentions} / 1 ambiguous case (${(honestAbstentions / 1 * 100).toFixed(1)}%)`);
  console.log(`7. "Unknown" Rate (Valid): ${unknownCount} / ${totalCases - 1} supported cases (${(unknownCount / (totalCases - 1) * 100).toFixed(1)}%)`);
  console.log('==============================================================\n');
}

runMatrix().catch(console.error);
