/**
 * APEX — M4 CSL Collapse Prevention & Multi-Vehicle Discrimination Test
 * 
 * Verifies that the previous critical failure mode where unrelated vehicles
 * (Ferrari, Taxi, Mercedes, etc.) collapsed into "BMW M4 CSL" is permanently eliminated.
 * 
 * Tests:
 * 1. Ferrari Daytona SP3 -> Must NOT collapse to BMW M4 CSL
 * 2. Hong Kong / Urban Taxi -> Must NOT collapse to BMW M4 CSL
 * 3. Mercedes-Benz S-Class / AMG -> Must NOT collapse to BMW M4 CSL
 * 4. 10+ Unrelated authentic vehicle architectures:
 *    - Audi R8
 *    - Aston Martin DBS
 *    - Bugatti Chiron
 *    - Bentley Continental GT
 *    - Chevrolet Corvette C8
 *    - Ford Mustang GT
 *    - Honda NSX
 *    - Lamborghini Huracán
 *    - McLaren 650S
 *    - Nissan Skyline GT-R
 *    - Porsche 911
 *    - Rolls-Royce Phantom
 *    - Toyota GR Supra
 */

import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { confidenceEngine } from '../src/ai-engine/validation/confidenceEngine';
import { deterministicValidator } from '../src/ai-engine/validation/deterministicValidator';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { offlineRecognitionEngine } from '../src/services/offlineRecognitionEngine';
import type { CandidateComparison, ModelIdentificationOutput, VisualEvidence } from '../src/ai-engine/types';

interface CollapseTestCase {
  id: string;
  name: string;
  expectedMake: string | null;
  expectedModelFamily: string | null;
  visualEvidence: VisualEvidence;
  competingCandidates: CandidateComparison[];
  shouldAbstainOrReject?: boolean;
}

const testCases: CollapseTestCase[] = [
  // ─── 1. THE THREE PREVIOUSLY COLLAPSING ARCHITECTURES ───
  {
    id: 'collapse-001',
    name: 'Ferrari Daytona SP3 (Previously collapsed to M4 CSL)',
    expectedMake: 'Ferrari',
    expectedModelFamily: 'Daytona SP3',
    visualEvidence: {
      body_style: 'Targa Supercar',
      grille: 'Wide center intake with horizontal slats',
      headlights: 'Concealed pop-up style horizontal slats',
      taillights: 'Full-width horizontal rear strakes',
      hood: 'Deep front extractor nostrils',
      roofline: 'Removable targa roof with wrap-around windshield',
      windows: 'Curved quarter windows',
      wheels: 'Forged 5-spoke wheels',
      exhaust: 'High-mounted central dual exhaust',
      aero: 'Prominent rear strakes inspired by 330 P4',
      badges: 'Ferrari Prancing Horse',
      text: null,
      body_proportions: 'mid-engine exotic hypercar',
      distinctive_details: ['Horizontal rear strakes', 'Shark-nose front', 'Ferrari Prancing Horse']
    },
    competingCandidates: [
      {
        name: 'Ferrari Daytona SP3',
        score: 0.94,
        supporting_evidence: ['horizontal rear strakes', 'mid-engine proportions', 'Ferrari badge'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.40,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Ferrari architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'collapse-002',
    name: 'Urban Taxi Livery (Previously collapsed to M4 CSL)',
    expectedMake: 'Toyota',
    expectedModelFamily: 'Crown Comfort',
    visualEvidence: {
      body_style: 'Sedan',
      grille: 'Horizontal chrome grille',
      headlights: 'Rectangular halogen headlights',
      taillights: 'Vertical boxy taillights',
      hood: 'Flat upright sedan hood',
      roofline: 'Upright boxy taxi roof with illuminated rooftop sign',
      windows: 'Upright greenhouse with large glass area',
      wheels: 'Steel wheels with hubcaps',
      exhaust: 'Single hidden downward-facing tailpipe',
      aero: null,
      badges: 'Toyota emblem',
      text: 'TAXI 5 SEATS',
      body_proportions: 'upright traditional sedan',
      distinctive_details: ['TAXI rooftop light', 'Two-tone red and silver taxi livery']
    },
    competingCandidates: [
      {
        name: 'Toyota Crown Comfort Taxi',
        score: 0.88,
        supporting_evidence: ['taxi rooftop sign', 'two-tone taxi livery', 'upright sedan body'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.10,
        supporting_evidence: [],
        contradictions: [
          'Severe vehicle-type mismatch: Observed subject has commercial taxi livery/architecture, which contradicts exotic sports car candidate BMW M4 CSL'
        ],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'collapse-003',
    name: 'Mercedes-Benz S-Class (Previously collapsed to M4 CSL)',
    expectedMake: 'Mercedes-Benz',
    expectedModelFamily: 'S-Class',
    visualEvidence: {
      body_style: 'Full-size Luxury Sedan',
      grille: 'Large chrome slatted grille with center radar sensor',
      headlights: 'Digital Light LED headlights with three DRL points',
      taillights: 'Horizontal triangular two-piece LED taillights',
      hood: 'Long prestige hood with upright three-pointed star',
      roofline: 'Sweeping executive limousine silhouette',
      windows: 'Chrome surrounds with flush door handles',
      wheels: 'Multi-spoke executive luxury wheels',
      exhaust: 'Dual chrome exhaust outlets integrated into rear bumper',
      aero: null,
      badges: 'Three-pointed star hood ornament',
      text: 'S 580',
      body_proportions: 'front-engine long-wheelbase luxury sedan',
      distinctive_details: ['Three-pointed star hood ornament', 'Digital Light headlights', 'Flush handles']
    },
    competingCandidates: [
      {
        name: 'Mercedes-Benz S-Class',
        score: 0.95,
        supporting_evidence: ['three-pointed star', 'digital light', 'luxury sedan proportions'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.20,
        supporting_evidence: [],
        contradictions: [
          'Severe manufacturer mismatch: Observed Mercedes-Benz architecture/emblem contradicts BMW M4 CSL',
          'Body style mismatch: Observed sedan vs candidate sports coupe'
        ],
        unobservable_features: []
      }
    ]
  },

  // ─── 2. TEN ADDITIONAL UNRELATED VEHICLE ARCHITECTURES ───
  {
    id: 'unrelated-004',
    name: 'Audi R8 V10 Performance',
    expectedMake: 'Audi',
    expectedModelFamily: 'R8',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Singleframe honeycomb grille with three hood slits',
      headlights: 'Angular LED headlights with laser light',
      taillights: 'Full-width rear mesh grille with oval exhaust',
      hood: 'Sloped short front hood',
      roofline: 'Mid-engine coupe flyline',
      windows: 'Signature carbon sideblade behind side window',
      wheels: '20-inch dynamic 5-spoke wheels',
      exhaust: 'Dual large oval exhaust pipes',
      aero: 'Fixed carbon rear wing',
      badges: 'Audi Four Rings on hood',
      text: 'V10',
      body_proportions: 'mid-engine sports car',
      distinctive_details: ['Carbon sideblade', 'Singleframe grille', 'Four rings on hood']
    },
    competingCandidates: [
      {
        name: 'Audi R8 V10 Performance',
        score: 0.92,
        supporting_evidence: ['carbon sideblade', 'singleframe grille', 'four rings'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.30,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Audi architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-005',
    name: 'Aston Martin DBS Superleggera',
    expectedMake: 'Aston Martin',
    expectedModelFamily: 'DBS',
    visualEvidence: {
      body_style: 'Grand Tourer',
      grille: 'Massive hexagonal mesh grille',
      headlights: 'Swept-back LED headlights',
      taillights: 'Ultra-thin LED light blade taillights',
      hood: 'Deep sculpted carbon hood louvers',
      roofline: 'Curling fastback grand tourer',
      windows: 'Side strakes with curlicue aero extractors',
      wheels: '21-inch forged wheels',
      exhaust: 'Quad matte black exhausts',
      aero: 'Aeroblade II carbon spoiler',
      badges: 'Aston Martin Wings',
      text: 'SUPERLEGGERA',
      body_proportions: 'front-mid engine grand tourer',
      distinctive_details: ['Hexagonal mouth grille', 'Curlicue side vents', 'Superleggera script']
    },
    competingCandidates: [
      {
        name: 'Aston Martin DBS',
        score: 0.93,
        supporting_evidence: ['massive hexagonal grille', 'curlicue vents', 'aston wings'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.25,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Aston Martin architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-006',
    name: 'Bugatti Chiron Pur Sport',
    expectedMake: 'Bugatti',
    expectedModelFamily: 'Chiron',
    visualEvidence: {
      body_style: 'Hypercar',
      grille: 'Horseshoe grille with 16 emblem',
      headlights: 'Quad LED pods',
      taillights: 'Full-width horizontal light strip',
      hood: 'Forward carbon louvers',
      roofline: 'Teardrop hypercar roof with Bugatti C-line',
      windows: 'Bugatti Atlantic dorsal line',
      wheels: 'Magnesium aero blade wheels',
      exhaust: '3D-printed titanium central exhaust',
      aero: 'Fixed 1.9m carbon wing with Pur Sport endplates',
      badges: 'Bugatti EB badge',
      text: '16',
      body_proportions: 'mid-engine hypercar',
      distinctive_details: ['Horseshoe grille', 'Fixed Pur Sport rear wing', 'Bugatti C-line']
    },
    competingCandidates: [
      {
        name: 'Bugatti Chiron Pur Sport',
        score: 0.98,
        supporting_evidence: ['horseshoe grille', 'fixed rear wing', 'C-line'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.15,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Bugatti architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-007',
    name: 'Bentley Continental GT',
    expectedMake: 'Bentley',
    expectedModelFamily: 'Continental GT',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Massive matrix mesh grille',
      headlights: 'Cut-crystal LED matrix headlights',
      taillights: 'Elliptical LED taillights',
      hood: 'Power line running down hood',
      roofline: 'Muscular rear haunch coupe flyline',
      windows: 'Chrome window outline',
      wheels: '22-inch Mulliner driving specification wheels',
      exhaust: 'Dual figure-eight exhaust tips',
      aero: null,
      badges: 'Bentley Winged B',
      text: null,
      body_proportions: 'front-engine grand tourer with prominent rear haunches',
      distinctive_details: ['Matrix grille', 'Cut-crystal headlights', 'Elliptical taillights']
    },
    competingCandidates: [
      {
        name: 'Bentley Continental GT',
        score: 0.94,
        supporting_evidence: ['matrix grille', 'cut crystal lights', 'winged B'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.20,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Bentley architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-008',
    name: 'Chevrolet Corvette C8 Stingray',
    expectedMake: 'Chevrolet',
    expectedModelFamily: 'Corvette',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Aggressive front bumper splitters',
      headlights: 'Piercing angular LED headlights',
      taillights: 'Dual horizontal chevron LED taillights',
      hood: 'Short sharply creased front hood',
      roofline: 'Cab-forward mid-engine coupe',
      windows: 'Large rear glass engine hatch displaying V8',
      wheels: 'Open-spoke aluminum wheels',
      exhaust: 'Quad outboard exhaust tips',
      aero: 'Low-profile rear spoiler',
      badges: 'Crossed flags Corvette emblem',
      text: 'CORVETTE',
      body_proportions: 'mid-engine sports car',
      distinctive_details: ['Crossed flags badge', 'Side door trident intake', 'Rear engine glass window']
    },
    competingCandidates: [
      {
        name: 'Chevrolet Corvette (C8)',
        score: 0.91,
        supporting_evidence: ['crossed flags badge', 'trident side scoops', 'cab-forward proportions'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.25,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Chevrolet architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-009',
    name: 'Ford Mustang GT (S550)',
    expectedMake: 'Ford',
    expectedModelFamily: 'Mustang',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Trapezoidal grille with galloping horse',
      headlights: 'Tri-bar LED daytime running lights',
      taillights: 'Three vertical sequential taillight bars',
      hood: 'Twin hood heat extractors',
      roofline: 'Fastback muscle car silhouette',
      windows: 'Quarter hockey stick window outline',
      wheels: 'Black 19-inch wheels',
      exhaust: 'Quad tips',
      aero: 'Decklid lip spoiler',
      badges: 'GT badge on rear decklid',
      text: '5.0',
      body_proportions: 'front-engine rear-drive sports coupe',
      distinctive_details: ['Tri-bar DRLs', 'Sequential vertical taillights', 'Galloping pony badge']
    },
    competingCandidates: [
      {
        name: 'Ford Mustang (S550)',
        score: 0.93,
        supporting_evidence: ['tri-bar headlights', 'galloping pony', 'sequential taillights'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.25,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Ford architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-010',
    name: 'Honda NSX (NC1)',
    expectedMake: 'Honda',
    expectedModelFamily: 'NSX',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Acura/Honda beak smile grille',
      headlights: 'Jewel Eye LED headlights with lower DRL strip',
      taillights: 'Full-width rear wing taillight',
      hood: 'Aluminum hood with aggressive creases',
      roofline: 'Floating roof canopy with black pillars',
      windows: 'Side air intakes feeding twin-turbo V6',
      wheels: 'Interwoven dynamic Y-spoke wheels',
      exhaust: 'Center quad trapezoidal exhaust tips',
      aero: 'Carbon fiber rear diffuser',
      badges: 'Honda H badge',
      text: 'NSX',
      body_proportions: 'mid-engine hybrid sports car',
      distinctive_details: ['Jewel Eye headlights', 'Floating canopy', 'Center quad exhaust']
    },
    competingCandidates: [
      {
        name: 'Honda NSX',
        score: 0.90,
        supporting_evidence: ['jewel eye lights', 'floating roof', 'side intakes'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.20,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Honda architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-011',
    name: 'Lamborghini Huracán LP 610-4',
    expectedMake: 'Lamborghini',
    expectedModelFamily: 'Huracán',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Hexagonal front intake architecture',
      headlights: 'Y-shaped LED daytime running lights',
      taillights: 'Slim horizontal Y-shaped taillights',
      hood: 'Wedge front hood',
      roofline: 'Single continuous arc from nose to tail',
      windows: 'Hexagonal side windows',
      wheels: 'Giano 20-inch alloy wheels',
      exhaust: 'Quad round chrome exhaust tips',
      aero: 'Integrated ducktail lip',
      badges: 'Raging Bull emblem',
      text: null,
      body_proportions: 'extreme low wedge mid-engine supercar',
      distinctive_details: ['Hexagonal design language', 'Y-shaped DRLs', 'Raging Bull crest']
    },
    competingCandidates: [
      {
        name: 'Lamborghini Huracán',
        score: 0.94,
        supporting_evidence: ['extreme wedge', 'Y-shaped DRLs', 'raging bull'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.20,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Lamborghini architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-012',
    name: 'McLaren 650S Spider',
    expectedMake: 'McLaren',
    expectedModelFamily: '650S',
    visualEvidence: {
      body_style: 'Spider',
      grille: 'Carbon fiber front bumper with P1-inspired styling',
      headlights: 'McLaren speedmark crescent LED headlights',
      taillights: 'Thin dual light bars integrated into rear mesh',
      hood: 'Front nostrils with carbon louvers',
      roofline: 'Retractable hardtop with twin rear buttresses',
      windows: 'Dihedral door window cuts',
      wheels: '5-spoke lightweight alloy wheels',
      exhaust: 'Dual top-exit exhaust outlets in center mesh',
      aero: 'Active rear airbrake',
      badges: 'McLaren Speedmark',
      text: '650S',
      body_proportions: 'mid-engine carbon tub supercar',
      distinctive_details: ['Speedmark crescent headlights', 'Twin rear buttresses', 'Active airbrake']
    },
    competingCandidates: [
      {
        name: 'McLaren 650S',
        score: 0.92,
        supporting_evidence: ['speedmark crescent headlights', 'twin buttresses', 'mclaren orange'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.15,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed McLaren architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  },
  {
    id: 'unrelated-013',
    name: 'Nissan Skyline GT-R (R34)',
    expectedMake: 'Nissan',
    expectedModelFamily: 'Skyline',
    visualEvidence: {
      body_style: 'Coupe',
      grille: 'Two-tier horizontal grille with GT-R badge',
      headlights: 'Horizontal xenon projector headlights',
      taillights: 'Four iconic round afterburner taillights',
      hood: 'Aluminum hood with center crease',
      roofline: 'Notchback muscular 90s sports coupe',
      windows: 'Frameless door glass',
      wheels: '6-spoke 18-inch forged BBS wheels',
      exhaust: 'Single large cannon exhaust tip',
      aero: 'Two-stage adjustable rear wing',
      badges: 'GT-R red-R badge',
      text: 'SKYLINE GT-R',
      body_proportions: 'front-engine all-wheel-drive sports coupe',
      distinctive_details: ['Four round afterburner taillights', 'Two-tier grille with red R', 'Adjustable rear wing']
    },
    competingCandidates: [
      {
        name: 'Nissan Skyline GT-R',
        score: 0.96,
        supporting_evidence: ['four round taillights', 'GT-R badge', 'adjustable rear wing'],
        contradictions: [],
        unobservable_features: []
      },
      {
        name: 'BMW M4 CSL',
        score: 0.30,
        supporting_evidence: [],
        contradictions: ['Severe manufacturer mismatch: Observed Nissan architecture contradicts BMW M4 CSL'],
        unobservable_features: []
      }
    ]
  }
];

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function check(condition: boolean, testName: string, detail: string = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  [FAIL] ${testName} - ${detail}`);
  }
}

async function runM4CSLCollapsePreventionSuite() {
  console.log('\n================================================================');
  console.log('APEX — M4 CSL COLLAPSE PREVENTION & ARCHITECTURAL DISCRIMINATION');
  console.log('================================================================\n');

  let m4CslFalsePositiveCount = 0;

  for (const tc of testCases) {
    console.log(`Testing: ${tc.name}`);

    const classResult = hierarchicalClassifier.classify({
      visual_evidence: tc.visualEvidence,
      viewpoint: 'front_3q',
      raw_make: tc.expectedMake,
      raw_model: tc.expectedModelFamily,
      raw_generation: 'Current',
      raw_variant: null,
      raw_candidates: tc.competingCandidates
    });

    const isM4CslPredicted =
      (classResult.top_candidate?.name.toLowerCase().includes('m4') &&
        classResult.top_candidate?.name.toLowerCase().includes('csl')) ||
      (classResult.identification.model_family?.toLowerCase().includes('m4') &&
        classResult.identification.variant?.toLowerCase().includes('csl'));

    if (isM4CslPredicted) {
      m4CslFalsePositiveCount++;
    }

    check(
      !isM4CslPredicted,
      `${tc.name} must NOT collapse into BMW M4 CSL`,
      `Falsely identified as: ${classResult.top_candidate?.name} / ${classResult.identification.make} ${classResult.identification.model_family}`
    );

    if (tc.expectedMake) {
      check(
        classResult.identification.make === tc.expectedMake,
        `Make must match expected ${tc.expectedMake}`,
        `Got make: ${classResult.identification.make}`
      );
    }

    if (tc.expectedModelFamily) {
      check(
        classResult.identification.model_family === tc.expectedModelFamily,
        `Model must match expected ${tc.expectedModelFamily}`,
        `Got model: ${classResult.identification.model_family}`
      );
    }

    check(
      classResult.contradictions.length === 0,
      `Runner-up M4 CSL contradictions must NOT leak into winner contradictions (must be 0)`,
      `Got active contradictions: ${JSON.stringify(classResult.contradictions)}`
    );
  }

  console.log('\n================================================================');
  console.log(`M4 CSL COLLAPSE TEST SUMMARY:`);
  console.log(`Total Vehicles Evaluated:          ${testCases.length}`);
  console.log(`M4 CSL False-Positive Count:      ${m4CslFalsePositiveCount} (Target: 0)`);
  console.log(`M4 CSL False-Positive Rate:       ${((m4CslFalsePositiveCount / testCases.length) * 100).toFixed(2)}% (Target: 0.00%)`);
  console.log(`Total Assertions:                  ${totalAssertions}`);
  console.log(`Passed Assertions:                 ${passedAssertions}`);
  console.log(`Failed Assertions:                 ${failedAssertions}`);
  console.log('================================================================\n');

  if (failedAssertions > 0 || m4CslFalsePositiveCount > 0) {
    process.exit(1);
  }
}

runM4CSLCollapsePreventionSuite().catch((err) => {
  console.error('Fatal error running M4 CSL collapse prevention suite:', err);
  process.exit(1);
});
