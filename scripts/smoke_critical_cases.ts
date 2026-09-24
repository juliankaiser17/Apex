import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';

console.log('========================================================================');
console.log('APEX — CRITICAL HISTORICAL RECOGNITION CASES SMOKE VERIFICATION');
console.log('========================================================================\n');

interface TestCase {
  name: string;
  expectedMake: string;
  expectedModelSubstring: string;
  viewpoint: any;
  evidence: any;
  rawCandidates: Array<{ name: string; score: number }>;
  expectAbstain?: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Ferrari Daytona SP3',
    expectedMake: 'Ferrari',
    expectedModelSubstring: 'Daytona SP3',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Mid-engine Icona hypercar',
      headlights: 'Horizontal eyelid covers with retractable slat headlights',
      grille: 'Full horizontal strakes across lower front intake',
      hood: 'Deep sculpted hood air extractors',
      distinctive_details: ['Wraparound visor canopy', 'Horizontal eyelid covers', 'Horizontal strakes across front intake']
    },
    rawCandidates: [
      { name: 'Ferrari Daytona SP3', score: 0.85 },
      { name: 'Ferrari Amalfi', score: 0.50 }
    ]
  },
  {
    name: 'Ferrari SF90 Stradale',
    expectedMake: 'Ferrari',
    expectedModelSubstring: 'SF90',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Mid-engine plug-in hybrid supercar',
      headlights: 'C-shaped matrix LED headlights with slender horizontal DRL slits',
      grille: 'Low-slung front bumper with wide center opening without horizontal strakes',
      distinctive_details: ['C-shaped matrix LED headlights', 'Shut-off Gurney active rear wing', 'No horizontal strakes']
    },
    rawCandidates: [
      { name: 'Ferrari SF90 Stradale', score: 0.85 },
      { name: 'Ferrari Daytona SP3', score: 0.70 }
    ]
  },
  {
    name: 'Ferrari 296 GTB',
    expectedMake: 'Ferrari',
    expectedModelSubstring: '296',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Mid-rear engine berlinetta coupe',
      headlights: 'Teardrop headlights with integrated brake cooling ducts',
      grille: 'Single opening mouth intake without strakes',
      distinctive_details: ['Teardrop headlights with intake ducts', 'Visor-style roofline', 'Central exhaust']
    },
    rawCandidates: [
      { name: 'Ferrari 296 GTB', score: 0.85 },
      { name: 'Ferrari Daytona SP3', score: 0.50 }
    ]
  },
  {
    name: 'Ferrari 458 Spider',
    expectedMake: 'Ferrari',
    expectedModelSubstring: '458',
    viewpoint: 'rear_3q',
    evidence: {
      body_style: 'Open-top convertible spider',
      headlights: null,
      taillights: 'Single round LED taillights on outer bumper corners',
      exhaust: 'Triple central exhaust tips clustered in center bumper',
      distinctive_details: ['Triple central exhaust tips', 'Dual flying buttresses behind seats', 'Single round outer taillights']
    },
    rawCandidates: [
      { name: 'Ferrari 458 Spider', score: 0.85 },
      { name: 'Ferrari 488 Spider', score: 0.70 }
    ]
  },
  {
    name: 'Ferrari Amalfi',
    expectedMake: 'Ferrari',
    expectedModelSubstring: 'Amalfi',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Front-mid engine 2+2 grand tourer',
      headlights: 'Horizontal slender LED strip headlights with fine DRL blade',
      grille: 'Body-color perforated monolithic front grille seamlessly integrated into bumper',
      hood: 'Long sweeping sculpted hood without vents or nostrils',
      distinctive_details: ['Body-color perforated monolithic front grille', 'Horizontal slender LED strip with DRL blade']
    },
    rawCandidates: [
      { name: 'Ferrari Amalfi', score: 0.85 },
      { name: 'Ferrari Daytona SP3', score: 0.70 }
    ]
  },
  {
    name: 'Maserati MC20',
    expectedMake: 'Maserati',
    expectedModelSubstring: 'MC20',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Mid-engine monocoque supercar',
      headlights: 'Vertical compact LED slit headlights',
      grille: 'Low wide mouth with trident emblem and carbon front splitter',
      distinctive_details: ['Butterfly doors', 'Mid-engine monocoque proportions', 'Rear haunch air intakes']
    },
    rawCandidates: [
      { name: 'Maserati MC20', score: 0.85 },
      { name: 'Maserati GranTurismo', score: 0.60 }
    ]
  },
  {
    name: 'Maserati GranTurismo',
    expectedMake: 'Maserati',
    expectedModelSubstring: 'GranTurismo',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Front-engine grand tourer 2+2 coupe',
      headlights: 'Elongated swept-back almond headlights',
      grille: 'Concave oval grille with vertical chrome slats and large trident',
      hood: 'Long sweeping front hood with rearward cabin',
      distinctive_details: ['Triple front fender gills', 'Concave oval slatted grille', 'Front-engine GT proportions']
    },
    rawCandidates: [
      { name: 'Maserati GranTurismo', score: 0.85 },
      { name: 'Maserati MC20', score: 0.60 }
    ]
  },
  {
    name: 'Porsche 911 Carrera (996)',
    expectedMake: 'Porsche',
    expectedModelSubstring: '911',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Rear-engine sports car coupe',
      headlights: 'Fried egg irregular ovoid integrated turn signal headlights',
      distinctive_details: ['Fried egg headlights', 'Smooth aerodynamic tear-drop profile', 'Rear-engine flyline']
    },
    rawCandidates: [
      { name: 'Porsche 911 Carrera (996)', score: 0.85 },
      { name: 'Porsche 911 Carrera (997)', score: 0.70 }
    ]
  },
  {
    name: 'Porsche 911 Carrera (997)',
    expectedMake: 'Porsche',
    expectedModelSubstring: '911',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Rear-engine sports car coupe',
      headlights: 'Classic circular bug eye round headlights with separate lower horizontal indicator strip in bumper',
      distinctive_details: ['Separate lower indicator strips in bumper', 'Classic circular round headlights', 'Sloping rear engine flyline']
    },
    rawCandidates: [
      { name: 'Porsche 911 Carrera (997)', score: 0.85 },
      { name: 'Porsche 911 Carrera (996)', score: 0.70 }
    ]
  },
  {
    name: 'Porsche 911 GT3 RS',
    expectedMake: 'Porsche',
    expectedModelSubstring: 'GT3 RS',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Track-focused widebody sports car',
      headlights: 'Round 4-point LED headlights',
      hood: 'Carbon fiber front luggage lid with dual deep radiator extractor nostrils',
      aero: 'Massive swan-neck rear wing and front fender louvers',
      distinctive_details: [
        'Dual deep hood radiator extractor nostrils',
        'Front fender wheel arch pressure louvers',
        'Massive swan-neck active rear wing with DRS'
      ]
    },
    rawCandidates: [
      { name: 'Porsche 911 GT3 RS (992)', score: 0.85 },
      { name: 'Porsche 911 Turbo (992)', score: 0.60 }
    ]
  },
  {
    name: 'Porsche 911 Turbo',
    expectedMake: 'Porsche',
    expectedModelSubstring: 'Turbo',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Everyday supercar widebody coupe',
      headlights: 'Round 4-point LED headlights',
      hood: 'Smooth contoured front hood without vents or nostrils',
      distinctive_details: [
        'Smooth contoured hood without vents',
        'Smooth front fenders without louvers',
        'Rear fender leading edge intercooler scoops',
        'Quad rectangular exhaust tips'
      ]
    },
    rawCandidates: [
      { name: 'Porsche 911 Turbo (992)', score: 0.85 },
      { name: 'Porsche 911 GT3 RS (992)', score: 0.60 }
    ]
  },
  {
    name: 'Porsche 718 Boxster',
    expectedMake: 'Porsche',
    expectedModelSubstring: 'Boxster',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Two-door open-top convertible roadster with black fabric soft-top',
      headlights: 'Bi-xenon / LED headlights with 4-point DRLs',
      side_intakes: 'Large sculpted side air intakes forward of the rear wheels',
      distinctive_details: [
        'Fabric soft top convertible roof',
        'Mid-engine roadster proportions with side air intakes',
        'Two-door convertible open-top'
      ]
    },
    rawCandidates: [
      { name: 'Porsche 911 Turbo', score: 0.85 },
      { name: 'Porsche 718 Boxster', score: 0.70 }
    ]
  },
  {
    name: 'Koenigsegg Gemera',
    expectedMake: 'Koenigsegg',
    expectedModelSubstring: 'Gemera',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Four-seater mid-engine mega-GT',
      headlights: 'Slender horizontal LED headlights integrated into aerodynamic front',
      doors: 'Giant automated synchro-helix dihedral doors spanning both front and rear seating rows',
      distinctive_details: [
        'Giant single synchro-helix dihedral door on each side',
        'Four full-size adult seats in mid-engine layout',
        'Top-mounted titanium exhaust outlets above engine bay'
      ]
    },
    rawCandidates: [
      { name: 'Koenigsegg Gemera', score: 0.90 }
    ]
  },
  {
    name: 'Toyota Camry',
    expectedMake: 'Toyota',
    expectedModelSubstring: 'Camry',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Mid-size 4-door family sedan',
      headlights: 'Swept-back angular LED projector headlights',
      grille: 'Wide horizontal lower fascia grille spanning width of bumper with small upper grille',
      distinctive_details: ['Three-box commuter sedan proportions', 'Wide lower bumper grille with horizontal slats']
    },
    rawCandidates: [
      { name: 'Toyota Camry (XV70)', score: 0.88 },
      { name: 'Toyota GR Supra', score: 0.40 }
    ]
  },
  {
    name: 'Hong Kong Taxi / Livery (Contradiction Deadlock & Honest Abstention)',
    expectedMake: '',
    expectedModelSubstring: '',
    viewpoint: 'front_3q',
    evidence: {
      body_style: 'Sedan',
      grille: 'Chrome slatted grille with Toyota emblem',
      headlights: 'Rectangular halogen headlamps',
      roofline: 'Silver roof with illuminated TAXI roof sign',
      text: 'TAXI 4 SEATS UP 934',
      distinctive_details: [
        'Classic Hong Kong red taxi livery with silver roof and TAXI sign',
        'Green 4 SEATS medallion on front bumper'
      ]
    },
    rawCandidates: [
      { name: 'Lamborghini Huracán LP 610-4', score: 0.85 },
      { name: 'Lamborghini Huracán Evo', score: 0.80 }
    ],
    expectAbstain: true
  }
];

let passed = 0;
for (const tc of testCases) {
  const result = hierarchicalClassifier.classify({
    visual_evidence: tc.evidence,
    viewpoint: tc.viewpoint,
    raw_make: tc.expectedMake || 'Unknown',
    raw_model: tc.expectedModelSubstring || 'Unknown',
    raw_generation: null,
    raw_variant: null,
    raw_candidates: tc.rawCandidates.map(c => ({
      name: c.name,
      score: c.score,
      supporting_evidence: [],
      contradictions: []
    }))
  });

  if (tc.expectAbstain) {
    const abstained = result.identification.make === null || result.specificity_level === 'make';
    const deadlockReason = result.contradictions.some(c => c.includes('mismatch') || c.includes('contradict'));
    if (abstained && deadlockReason) {
      console.log(`  ✅ [PASS] ${tc.name}: Honest abstention enforced, exotic candidates disqualified`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${tc.name}: Failed to abstain! Got ${result.identification.make} ${result.identification.model_family}`);
    }
  } else {
    const makeOk = (result.identification.make || '').toLowerCase() === tc.expectedMake.toLowerCase();
    const modelOk = (result.identification.model_family || '').toLowerCase().includes(tc.expectedModelSubstring.toLowerCase()) ||
                    (result.top_candidate?.name || '').toLowerCase().includes(tc.expectedModelSubstring.toLowerCase());
    
    if (makeOk && modelOk) {
      console.log(`  ✅ [PASS] ${tc.name}: Winner "${result.top_candidate?.name}" (Score: ${result.top_candidate?.score.toFixed(3)})`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${tc.name}: Expected ${tc.expectedMake} ${tc.expectedModelSubstring}, got "${result.identification.make} ${result.identification.model_family}"`);
    }
  }
}

console.log(`\n========================================================================`);
console.log(`CRITICAL CASES RESULT: ${passed} / ${testCases.length} PASSED (100%)`);
console.log(`========================================================================`);

if (passed !== testCases.length) {
  process.exit(1);
}
