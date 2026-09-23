/**
 * APEX — Fine-Grained Exact Model Discriminator
 * 
 * Production evidence-grounded discriminator for confusable vehicle models.
 * Eliminates exact-model misidentifications (e.g. MC20 vs GranTurismo, 650S vs 570S,
 * SF90 vs Daytona SP3, 996 vs 997, 675LT vs 650S) using reusable morphological traits
 * and visibility-aware evidence scoring.
 * 
 * HARD CONSTRAINTS & INVARIANTS:
 * 1. Missing expected features may only create a penalty when the feature zone is confirmed VISIBLE.
 * 2. Occluded, cropped, or viewpoint-invisible traits contribute ZERO evidence and ZERO contradiction.
 * 3. Engine layout is candidate metadata, not directly observed visual evidence unless visible.
 * 4. Verification is NEUTRAL PAIRWISE COMPARISON, not an assumed-answer prompt.
 * 5. Morphological fingerprints are reusable traits across all models; ZERO pair-specific hacks.
 * 6. Candidate generation and fine-grained scoring are deterministic/local (0 Cloudflare calls).
 * 7. Visibility-aware evidence states: VISIBLE / PARTIAL / NOT_VISIBLE / OCCLUDED.
 * 8. Only VISIBLE/PARTIAL evidence may affect scoring.
 * 9. No exact-model result can be derived solely from a generic manufacturer prior.
 */

import type { ViewpointType, VisualEvidence } from '../types';

export type TraitVisibilityState = 'VISIBLE' | 'PARTIAL' | 'NOT_VISIBLE' | 'OCCLUDED';

export type MorphologicalCategory =
  | 'headlight_shape'
  | 'front_intake_grille'
  | 'hood_geometry'
  | 'fender_architecture'
  | 'side_intake_type'
  | 'roofline_greenhouse'
  | 'rear_architecture_and_exhaust'
  | 'wing_and_spoiler_architecture'
  | 'rear_fascia_and_strakes'
  | 'door_architecture'
  | 'proportions'
  | 'aero_architecture';

export interface TraitDescriptor {
  name: string;
  positiveKeywords: string[];
  incompatibleKeywords: string[];
  isEngineMetadata?: boolean;
  isGeneric?: boolean; // If true, contributes low weight (+0.05) to prevent generic supercar priors from dominating
  // Keywords that name architecture SHARED with sibling models of the same family (e.g. the
  // 488 GTB and 488 Pista share the S-duct hood channel; both Spiders share their roof
  // mechanics with the coupe). A match on ONLY these keywords names the family, not the
  // model, and must never register as model-SPECIFIC evidence. Treated as generic-weight
  // (+0.05) support instead.
  familySharedKeywords?: string[];
  // When true, positiveKeywords matched in isolation (without at least one keyword outside
  // the family-shared set) are demoted to generic weight. Used where every positive keyword
  // is individually family-shared but co-occurrence of several is still discriminative.
  familySharedAlone?: boolean;
}

export interface ModelMorphologicalFingerprint {
  vehicleId: string;
  make: string;
  model: string;
  generation?: string;
  traits: Partial<Record<MorphologicalCategory, TraitDescriptor>>;
  proportionsDescription: string;
  confusableWith?: string[];
}

export interface TraitEvaluation {
  category: MorphologicalCategory;
  visibility: TraitVisibilityState;
  expectedTraitName: string;
  matched: boolean;
  contradicted: boolean;
  scoreDelta: number;
  reason: string;
}

export interface ScoredCandidateModel {
  vehicleId: string;
  make: string;
  model: string;
  generation?: string;
  displayName: string;
  baseScore: number;
  calibratedScore: number;
  genericEvidenceCount: number;
  specificEvidenceCount: number;
  contradictionCount: number;
  visibleTraitCount: number;
  evidenceDensity: number;
  evaluations: TraitEvaluation[];
  supportingEvidence: string[];
  contradictions: string[];
  unobservableTraits: string[];
}

export interface FineGrainedDiscriminationResult {
  topCandidate: ScoredCandidateModel | null;
  runnerUp: ScoredCandidateModel | null;
  margin: number;
  needsVerification: boolean;
  rawConflict: boolean;
  visibilityMatrix: Record<MorphologicalCategory, TraitVisibilityState>;
  scoredCandidates: ScoredCandidateModel[];
  evidenceGrounded: boolean;
  reason: string;
  variant: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWPOINT VISIBILITY MATRIX
// ─────────────────────────────────────────────────────────────────────────────

export function computeVisibilityMatrix(
  viewpoint: ViewpointType,
  evidenceText: string
): Record<MorphologicalCategory, TraitVisibilityState> {
  const normEv = evidenceText.toLowerCase();

  // Check explicit occlusion cues
  const rearOccluded = normEv.includes('rear occluded') || normEv.includes('rear cropped') || normEv.includes('tail occluded') || normEv.includes('rear not visible');
  const frontOccluded = normEv.includes('front occluded') || normEv.includes('front cropped') || normEv.includes('nose occluded') || normEv.includes('front not visible');
  const sideOccluded = normEv.includes('side occluded') || normEv.includes('profile occluded');

  let matrix: Record<MorphologicalCategory, TraitVisibilityState>;

  switch (viewpoint) {
    case 'front':
      matrix = {
        headlight_shape: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        front_intake_grille: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        hood_geometry: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        fender_architecture: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'PARTIAL',
        aero_architecture: 'PARTIAL',
        wing_and_spoiler_architecture: 'PARTIAL',
        side_intake_type: 'NOT_VISIBLE',
        rear_architecture_and_exhaust: 'NOT_VISIBLE',
        rear_fascia_and_strakes: 'NOT_VISIBLE',
        door_architecture: 'NOT_VISIBLE'
      };
      break;

    case 'front_3q':
      matrix = {
        headlight_shape: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        front_intake_grille: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        hood_geometry: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        fender_architecture: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'PARTIAL',
        aero_architecture: 'VISIBLE',
        wing_and_spoiler_architecture: 'VISIBLE',
        rear_architecture_and_exhaust: 'NOT_VISIBLE',
        rear_fascia_and_strakes: 'NOT_VISIBLE'
      };
      break;

    case 'side':
      matrix = {
        headlight_shape: frontOccluded ? 'OCCLUDED' : 'PARTIAL',
        front_intake_grille: frontOccluded ? 'OCCLUDED' : 'PARTIAL',
        hood_geometry: frontOccluded ? 'OCCLUDED' : 'PARTIAL',
        fender_architecture: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        aero_architecture: 'VISIBLE',
        wing_and_spoiler_architecture: 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'PARTIAL',
        rear_fascia_and_strakes: rearOccluded ? 'OCCLUDED' : 'PARTIAL'
      };
      break;

    case 'rear_3q':
      matrix = {
        headlight_shape: 'NOT_VISIBLE',
        front_intake_grille: 'NOT_VISIBLE',
        hood_geometry: 'NOT_VISIBLE',
        fender_architecture: sideOccluded ? 'OCCLUDED' : 'PARTIAL',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'PARTIAL',
        aero_architecture: 'VISIBLE',
        wing_and_spoiler_architecture: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        rear_fascia_and_strakes: rearOccluded ? 'OCCLUDED' : 'VISIBLE'
      };
      break;

    case 'rear':
      matrix = {
        headlight_shape: 'NOT_VISIBLE',
        front_intake_grille: 'NOT_VISIBLE',
        hood_geometry: 'NOT_VISIBLE',
        fender_architecture: 'NOT_VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'PARTIAL',
        side_intake_type: 'NOT_VISIBLE',
        door_architecture: 'NOT_VISIBLE',
        aero_architecture: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        wing_and_spoiler_architecture: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        rear_fascia_and_strakes: rearOccluded ? 'OCCLUDED' : 'VISIBLE'
      };
      break;

    case 'unknown':
    default:
      matrix = {
        headlight_shape: 'PARTIAL',
        front_intake_grille: 'PARTIAL',
        hood_geometry: 'PARTIAL',
        fender_architecture: 'PARTIAL',
        roofline_greenhouse: 'PARTIAL',
        proportions: 'PARTIAL',
        side_intake_type: 'PARTIAL',
        door_architecture: 'PARTIAL',
        aero_architecture: 'PARTIAL',
        wing_and_spoiler_architecture: 'PARTIAL',
        rear_architecture_and_exhaust: 'PARTIAL',
        rear_fascia_and_strakes: 'PARTIAL'
      };
      break;
  }

  return matrix;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC EVIDENCE ROUTING (FIELD-AWARE / VIEWPOINT-AWARE)
//
// A vision model frequently folds the rear of the car into a front field (and vice versa) —
// e.g. the `headlights` field arriving as "Front: two horizontal LED strips … Rear: two vertical
// LED strips …". Concatenating every field into one blob then lets a REAR-lamp description satisfy
// a FRONT-lamp fingerprint, which produced real exact-model misidentifications.
//
// Routing rule: a trait may not be satisfied by text that describes the OPPOSITE end of the car.
// Ambiguous clauses (carrying both front and rear cues, or neither) stay eligible everywhere, so
// proportions/roofline/side reasoning and existing evidence shapes are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceZone = 'front' | 'rear' | 'global';

const REAR_ZONE_RE = /\b(rear|tails?|taillights?|tail[\s-]?lights?|exhaust|diffuser|spoiler|wing|license\s+plate|number\s+plate|trunk|boot\s+lid|ducktail)\b/i;
const FRONT_ZONE_RE = /\b(front|nose|bonnet|hood|headlights?|headlamps?|grille|grill)\b/i;

/** Traits that must not be satisfied by text describing the opposite end of the vehicle. */
export const CATEGORY_EXCLUDED_ZONES: Partial<Record<MorphologicalCategory, EvidenceZone[]>> = {
  headlight_shape: ['rear'],
  front_intake_grille: ['rear'],
  hood_geometry: ['rear'],
  fender_architecture: ['rear'],
  rear_architecture_and_exhaust: ['front'],
  rear_fascia_and_strakes: ['front'],
  wing_and_spoiler_architecture: ['front'],
  aero_architecture: ['front']
};

/** Classify a single evidence clause by the end of the car it describes. */
export function zoneOfClause(clause: string): EvidenceZone {
  const hasRear = REAR_ZONE_RE.test(clause);
  const hasFront = FRONT_ZONE_RE.test(clause);
  if (hasRear && !hasFront) return 'rear';
  if (hasFront && !hasRear) return 'front';
  return 'global';
}

/**
 * Split free-text evidence into clauses and build the eligible evidence string per trait category.
 */
export function buildZonedEvidence(parts: string[]): {
  full: string;
  forCategory: (category: MorphologicalCategory) => string;
} {
  const clauses = parts
    .join(' . ')
    .toLowerCase()
    .split(/\s*[.;\n]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text, zone: zoneOfClause(text) }));

  const full = clauses.map((c) => c.text).join(' ');
  const withoutRear = clauses.filter((c) => c.zone !== 'rear').map((c) => c.text).join(' ');
  const withoutFront = clauses.filter((c) => c.zone !== 'front').map((c) => c.text).join(' ');

  return {
    full,
    forCategory: (category: MorphologicalCategory) => {
      const excluded = CATEGORY_EXCLUDED_ZONES[category];
      if (!excluded) return full;
      if (excluded.includes('rear')) return withoutRear;
      if (excluded.includes('front')) return withoutFront;
      return full;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE MORPHOLOGICAL FINGERPRINT REGISTRY
// Zero pair-specific rules. Every model registers standardized structural traits.
// ─────────────────────────────────────────────────────────────────────────────

export const MORPHOLOGICAL_FINGERPRINTS: ModelMorphologicalFingerprint[] = [
  // ── MASERATI MC20 ──
  {
    vehicleId: 'maserati-mc20',
    make: 'Maserati',
    model: 'MC20',
    generation: 'M240',
    proportionsDescription: 'Mid-engine cab-forward low-slung supercar with short front hood',
    confusableWith: ['maserati-mc20-cielo', 'maserati-granturismo'],
    traits: {
      headlight_shape: {
        name: 'vertical_compact_led_slit',
        positiveKeywords: ['vertical led', 'vertical slit', 'compact vertical', 'stacked led', 'vertical headlight', 'slit headlight'],
        incompatibleKeywords: ['almond swept', 'curved oval', 'large swept back', 'fried egg', 'round bug eye']
      },
      front_intake_grille: {
        name: 'low_wide_horizontal_mouth_splitter',
        positiveKeywords: ['low wide mouth', 'carbon splitter', 'low-slung intake', 'wide lower mesh', 'front splitter', 'horizontal lower grille', 'low mouth'],
        incompatibleKeywords: ['upright oval grille', 'concave oval grille', 'tall vertical grille', 'prominent central chrome oval']
      },
      side_intake_type: {
        name: 'rear_fender_shoulder_intake',
        positiveKeywords: ['shoulder intake', 'rear fender shoulder', 'rear haunch intake', 'mid-engine intake', 'side air intake behind door', 'c-pillar intake'],
        incompatibleKeywords: ['triple front fender gills', 'shark gills', 'no side intake', 'smooth doors without intake']
      },
      roofline_greenhouse: {
        name: 'cab_forward_teardrop_deck',
        positiveKeywords: ['cab-forward', 'cab forward', 'short front hood', 'glass engine cover', 'teardrop cabin', 'mid-engine deck', 'trident louver'],
        incompatibleKeywords: ['long hood short deck', 'rearward cabin', 'grand tourer proportions', 'upright windshield', '2+2 coupe']
      },
      door_architecture: {
        name: 'butterfly_doors',
        positiveKeywords: ['butterfly door', 'upward opening door', 'dihedral butterfly'],
        incompatibleKeywords: ['conventional front hinged']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_central_mid_bumper_exhaust',
        positiveKeywords: ['dual central exhaust', 'mid-height exhaust', 'twin center exhaust', 'high diffuser', 'horizontal led blade taillight'],
        incompatibleKeywords: ['quad outer bumper exhaust', 'four tailpipes', 'vertical triangular taillight']
      },
      proportions: {
        name: 'mid_engine_cab_forward',
        positiveKeywords: ['cab-forward', 'cab forward', 'short front overhang', 'wide low-slung stance', 'supercar proportions'],
        incompatibleKeywords: ['front-engine grand tourer', 'long hood short deck', 'sedan proportions']
      }
    }
  },

  // ── MASERATI GRANTURISMO ──
  {
    vehicleId: 'maserati-granturismo',
    make: 'Maserati',
    model: 'GranTurismo',
    generation: 'Gen 1 (M145)',
    proportionsDescription: 'Front-engine grand tourer with long sweeping hood and rearward 2+2 cabin',
    confusableWith: ['maserati-mc20', 'maserati-grancabrio'],
    traits: {
      headlight_shape: {
        name: 'swept_back_almond_cluster',
        positiveKeywords: ['almond', 'swept-back almond', 'curved oval', 'swept back headlight', 'elongated headlight'],
        incompatibleKeywords: ['vertical slit', 'vertical compact led', 'horizontal strakes', 'fried egg']
      },
      front_intake_grille: {
        name: 'large_concave_oval_trident_grille',
        positiveKeywords: ['concave grille', 'upright oval grille', 'slatted grille', 'vertical slats', 'large central oval', 'oval trident grille', 'concave vertical'],
        incompatibleKeywords: ['low wide horizontal mouth', 'carbon front splitter', 'horizontal strakes']
      },
      side_intake_type: {
        name: 'front_fender_triple_gills_smooth_quarter',
        positiveKeywords: ['front fender gills', 'triple gills', 'shark gills', 'triple fender vents', 'smooth rear quarter', 'no side scoops', 'smooth door'],
        incompatibleKeywords: ['rear fender shoulder intake', 'large side scoop', 'mid-engine intake behind door']
      },
      roofline_greenhouse: {
        name: 'long_hood_rearward_cabin_gt',
        positiveKeywords: ['long hood', 'rearward cabin', 'short rear deck', 'sweeping fastback', '2+2', 'grand tourer', 'upright windshield', 'long bonnet'],
        incompatibleKeywords: ['cab-forward', 'short front hood', 'glass engine cover over rear axle']
      },
      door_architecture: {
        name: 'conventional_doors',
        positiveKeywords: ['conventional door', 'front-hinged door', 'standard door'],
        incompatibleKeywords: ['butterfly door', 'upward opening door', 'dihedral']
      },
      rear_architecture_and_exhaust: {
        name: 'quad_exhaust_tips_outer_bumper',
        positiveKeywords: ['quad exhaust', 'quad tips', 'four exhaust pipes', 'outer bumper exhaust', 'triangular taillight'],
        incompatibleKeywords: ['dual central mid-height exhaust', 'single center exhaust', 'full horizontal strakes']
      },
      proportions: {
        name: 'front_engine_grand_tourer',
        positiveKeywords: ['long hood', 'rearward cabin', 'grand tourer proportions', 'long dash to axle'],
        incompatibleKeywords: ['cab-forward mid-engine', 'short front overhang']
      }
    }
  },

  // ── MCLAREN 650S ──
  {
    vehicleId: 'mclaren-650s',
    make: 'McLaren',
    model: '650S',
    generation: 'P11',
    proportionsDescription: 'Mid-engine Super Series supercar with P1-style crescent headlights and large side radiator intakes',
    confusableWith: ['mclaren-650s-spider', 'mclaren-675lt', 'mclaren-675lt-spider', 'mclaren-570s', 'mclaren-720s'],
    traits: {
      headlight_shape: {
        name: 'p1_crescent_c_shape',
        positiveKeywords: ['crescent', 'c-shape', 'c shape', 'p1 style', 'blade crescent', 'curved blade', 'black crescent housing'],
        incompatibleKeywords: ['teardrop swept cluster', 'elongated teardrop without crescent', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'p1_style_front_bumper',
        positiveKeywords: ['p1 bumper', 'deep dual intakes', 'bumper pods', 'p1-inspired front'],
        incompatibleKeywords: ['three-segment aero blade', 'singleframe', 'upright oval']
      },
      side_intake_type: {
        name: 'large_side_radiator_scoop',
        positiveKeywords: ['large side scoop', 'radiator intake behind door', 'prominent side scoop', 'deep door recess', 'open side radiator', 'side radiator scoop'],
        incompatibleKeywords: ['floating tendon', 'tendon duct without open scoop', 'smooth door tendon', 'fender gills only']
      },
      roofline_greenhouse: {
        name: 'cab_forward_mid_engine_cockpit',
        positiveKeywords: ['cab-forward', 'mid-engine cockpit', 'glass engine bay', 'compact greenhouse'],
        incompatibleKeywords: ['flying buttress', 'wraparound visor canopy', 'long hood gt']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_central_mid_bumper_exhaust_airbrake',
        positiveKeywords: ['dual central exhaust', 'mid-height exhaust', 'active rear airbrake', 'black rear fascia'],
        incompatibleKeywords: ['top-exit', 'top exit', 'titanium exhaust', 'circular titanium', 'quad exhaust', 'full width strakes']
      },
      aero_architecture: {
        name: 'active_rear_airbrake',
        positiveKeywords: ['active airbrake', 'deployable rear wing', 'airbrake'],
        incompatibleKeywords: ['fixed giant swan neck wing', 'fixed ducktail']
      },
      proportions: {
        name: 'mid_engine_supercar',
        positiveKeywords: ['mid-engine', 'cab-forward', 'low slung', 'supercar'],
        incompatibleKeywords: ['front-engine', 'suv', 'sedan']
      }
    }
  },

  // ── MCLAREN 570S ──
  {
    vehicleId: 'mclaren-570s',
    make: 'McLaren',
    model: '570S',
    generation: 'Sports Series',
    proportionsDescription: 'Mid-engine Sports Series coupe featuring dihedral doors with floating aerodynamic tendons and teardrop lighting',
    confusableWith: ['mclaren-650s', 'mclaren-650s-spider', 'mclaren-675lt', 'mclaren-720s'],
    traits: {
      headlight_shape: {
        name: 'teardrop_swept_cluster',
        positiveKeywords: ['teardrop headlight', 'swept cluster', 'elongated teardrop lens', 'integrated daytime blade', 'swept back lens'],
        incompatibleKeywords: ['crescent', 'p1-inspired', 'p1 style', 'p1 crescent', 'c-shape black housing', 'c-shape', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'three_segment_aero_blade_bumper',
        positiveKeywords: ['three-segment', 'aero blade', 'tripartite front splitter', 'sports series bumper'],
        incompatibleKeywords: ['p1 front bumper', 'p1-derived', 'p1-inspired', 'p1 bumper', 'large concave oval', 'horizontal strakes']
      },
      side_intake_type: {
        name: 'dihedral_floating_tendon_intake',
        positiveKeywords: ['floating tendon', 'tendon duct', 'door channel', 'no open side scoop', 'smooth door tendon', 'floating door tendon', 'integrated door duct'],
        incompatibleKeywords: ['side radiator', 'radiator intake', 'large side scoop', 'large open side scoop', 'radiator intake behind door', 'prominent open side scoop', 'strakes', 'side intake']
      },
      roofline_greenhouse: {
        name: 'flying_buttress_c_pillar',
        positiveKeywords: ['floating c-pillar', 'floating pillar', 'glass hatch', 'sports series roofline'],
        incompatibleKeywords: ['retractable hardtop', 'spider tonneau', 'canvas roof', 'soft top', 'p11 roofline', 'wraparound visor canopy', 'long hood gt']
      },
      aero_architecture: {
        name: 'fixed_rear_spoiler_no_airbrake',
        positiveKeywords: ['fixed rear spoiler', 'fixed aero'],
        incompatibleKeywords: ['active airbrake', 'active rear airbrake', 'deployable airbrake', 'airbrake']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_lower_bumper_exhaust_tips',
        positiveKeywords: ['dual lower exhaust', 'lower bumper tips', 'curved led blade', 'fixed rear mesh'],
        incompatibleKeywords: ['active airbrake', 'dual top-exit circular titanium', 'quad exhaust']
      },
      door_architecture: {
        name: 'dihedral_doors_with_floating_tendons',
        positiveKeywords: ['dihedral door', 'tendon door', 'floating door'],
        incompatibleKeywords: ['conventional door', 'gullwing']
      },
      proportions: {
        name: 'mid_engine_sports_series',
        positiveKeywords: ['mid-engine', 'cab-forward', 'compact supercar'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── MCLAREN 675LT ──
  {
    vehicleId: 'mclaren-675lt',
    make: 'McLaren',
    model: '675LT',
    generation: 'P11',
    proportionsDescription: 'Lightweight track-focused Longtail with extended carbon airbrake and dual top-exit circular titanium exhausts',
    confusableWith: ['mclaren-675lt-spider', 'mclaren-650s', 'mclaren-650s-spider', 'mclaren-570s', 'mclaren-720s'],
    traits: {
      headlight_shape: {
        name: 'p1_crescent_c_shape',
        positiveKeywords: ['crescent', 'c-shape', 'p1 style', 'blade crescent'],
        incompatibleKeywords: ['teardrop swept cluster', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'carbon_splitter_with_endplates',
        positiveKeywords: ['carbon front endplate', 'aggressive front splitter', 'front endplate', 'carbon endplate'],
        incompatibleKeywords: ['three-segment aero blade', 'concave oval']
      },
      side_intake_type: {
        name: 'carbon_side_radiator_scoop',
        positiveKeywords: ['large side scoop', 'carbon side intake', 'radiator scoop'],
        incompatibleKeywords: ['floating tendon', 'tendon duct', 'smooth door']
      },
      roofline_greenhouse: {
        name: 'cab_forward_cockpit',
        positiveKeywords: ['cab-forward', 'glass engine cover', 'compact cockpit'],
        incompatibleKeywords: ['flying buttress', 'long hood gt']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_circular_titanium_top_exit_exhaust',
        positiveKeywords: ['dual circular titanium exhaust', 'top-exit exhaust', 'titanium exhaust tips', 'extended longtail airbrake', 'enlarged airbrake', 'carbon rear bumper'],
        incompatibleKeywords: ['dual lower bumper exhaust', 'quad exhaust tips']
      },
      aero_architecture: {
        name: 'extended_longtail_active_airbrake',
        positiveKeywords: ['longtail airbrake', '50% larger airbrake', 'extended rear wing', 'carbon airbrake'],
        incompatibleKeywords: ['no airbrake', 'fixed ducktail']
      },
      proportions: {
        name: 'mid_engine_longtail',
        positiveKeywords: ['mid-engine', 'extended rear longtail', 'low slung'],
        incompatibleKeywords: ['front-engine gt', 'sedan']
      }
    }
  },

  // ── FERRARI AMALFI ──
  {
    vehicleId: 'ferrari-amalfi',
    make: 'Ferrari',
    model: 'Amalfi',
    generation: 'F169M',
    proportionsDescription: 'Front-mid engine 2+2 grand tourer with long sweeping sculpted hood, body-color perforated front grille, clean body sides, and active 3-position rear spoiler',
    confusableWith: ['ferrari-daytona-sp3', 'ferrari-sf90-stradale', 'ferrari-458-italia', 'ferrari-296-gtb'],
    traits: {
      proportions: {
        name: 'front_mid_engine_2plus2_grand_tourer',
        positiveKeywords: ['front-mid engine', 'long sweeping hood', 'grand tourer proportions', '2+2', 'cab-rearward', 'fastback', 'grand touring coupe'],
        incompatibleKeywords: ['cab-forward mid-engine', 'short front hood', 'extreme wedge monovolume', 'targa prototype']
      },
      front_intake_grille: {
        name: 'monolithic_body_color_perforated_grille',
        positiveKeywords: ['body-color perforated', 'perforated grille', 'monolithic front grille', 'integrated front grille', 'seamless grille surface', 'body-colour grille'],
        // Bare "horizontal slats" is unreliable mesh-grille wording (VLMs describe real 296
        // grilles that way), so it must not contradict the monolithic nose; the full-width
        // strakes architecture remains a genuine contradiction.
        incompatibleKeywords: ['horizontal strakes across entire grille', 'open gaping mouth with deformable winglets', 'oval trident grille']
      },
      // STRUCTURED GEOMETRY ONLY. Generic lamp wording ("slender LED", "horizontal LED strip",
      // "slim horizontal headlight") is shared by every modern Ferrari and must never be a
      // discriminating trait — it is what let a generic LED description promote the wrong model.
      // The Amalfi's discriminator is a shallow lamp BAR whose inner tip sweeps DOWN into the
      // grille's leading edge, with no closed/annular element.
      headlight_shape: {
        name: 'thin_lamp_bar_with_indown_swept_inner_tip',
        positiveKeywords: ['drl blade', 'lamp bar', 'thin horizontal lamp', 'narrow lamp bar', 'lamp bar along the nose', 'inward down swept lamp tip', 'lamp merging into the grille edge'],
        incompatibleKeywords: ['c-shaped', 'c-clamp', 'c shaped', 'annular lamp', 'ring shaped lamp', 'slotted lamp', 'elongated vertical', 'vertical lens', 'tall narrow lamp', 'eyelid', 'partial cover', 'round bug eye', 'fried egg']
      },
      hood_geometry: {
        name: 'long_sculpted_hood_without_vents',
        // "long hood" / "sweeping hood" is family-shared front-mid-engine Ferrari wording
        // (measured: bare "long hood" manufactures this trait on non-Amalfi cars); only the
        // ventless-sculpture observation may satisfy it.
        positiveKeywords: ['sculpted hood without vents', 'clean hood surface', 'ventless sculpted hood', 'hood without vents or nostrils'],
        incompatibleKeywords: ['deep hood nostrils', 'dual hood vents with strakes', 'radiator extractor in hood']
      },
      side_intake_type: {
        name: 'clean_sculpted_body_sides_without_side_scoops',
        positiveKeywords: ['clean body sides', 'smooth doors', 'no side scoops', 'sculpted waistline without intakes', 'clean flanks'],
        incompatibleKeywords: ['large side radiator scoops', 'rear fender shoulder intake', 'side air boxes', 'side intake ducts behind doors']
      },
      door_architecture: {
        name: 'conventional_front_hinged_doors',
        positiveKeywords: ['conventional door', 'front hinged door', 'standard door'],
        incompatibleKeywords: ['butterfly doors', 'dihedral doors', 'gullwing doors', 'scissor doors']
      },
      wing_and_spoiler_architecture: {
        name: 'active_three_position_flush_rear_spoiler',
        positiveKeywords: ['active 3-position spoiler', 'three-position spoiler', 'flush rear spoiler', 'integrated rear spoiler at base of window'],
        incompatibleKeywords: ['towering rear wing', 'swan-neck wing', 'large fixed track wing', 'prominent ducktail spoiler']
      },
      rear_fascia_and_strakes: {
        name: 'minimalist_horizontal_led_lightbars_and_lower_diffuser',
        positiveKeywords: ['minimalist taillight', 'horizontal led lightbar', 'clean rear tail', 'lower aerodynamic diffuser'],
        incompatibleKeywords: ['full-width horizontal rear strakes', 'horizontal slats across entire rear', 'quad round taillights']
      },
      rear_architecture_and_exhaust: {
        name: 'quad_round_exhaust_tailpipes_in_dual_clusters',
        positiveKeywords: ['quad round exhaust', 'quad circular exhaust', 'dual pairs of round exhaust', 'four circular tailpipes'],
        incompatibleKeywords: ['triple central exhaust', 'dual high-mounted rectangular exhaust in center', 'top-exit exhaust', 'single central exhaust', 'single centre exhaust', 'one central tailpipe']
      }
    }
  },

  // ── FERRARI DAYTONA SP3 ──
  {
    vehicleId: 'ferrari-daytona-sp3',
    make: 'Ferrari',
    model: 'Daytona SP3',
    generation: 'Icona',
    proportionsDescription: 'Icona hypercar with wraparound visor canopy, horizontal louvers/strakes, and fender-mounted mirrors',
    confusableWith: ['ferrari-amalfi', 'ferrari-sf90-stradale', 'ferrari-488-pista', 'ferrari-458-italia', 'ferrari-296-gtb'],
    traits: {
      headlight_shape: {
        name: 'horizontal_eyelid_covers',
        positiveKeywords: ['eyelid', 'eyelid covers', 'partial covers', 'horizontal partial cover', 'slat headlights', 'retractable covers'],
        incompatibleKeywords: ['open c-shape matrix', 'c-clamp headlight', 'c-shaped', 'c-shape', 'matrix led', 'vertical slit', 'round bug eye', 'elongated vertical', 'swept-back headlights', 'vertical led strip']
      },
      front_intake_grille: {
        name: 'horizontal_strakes_slatted_grille',
        // Generic "slats" wording is how VLMs commonly describe ANY mesh grille (measured on
        // real 296 GTB photographs), so only the distinctive SP3 strakes architecture may
        // satisfy this trait.
        positiveKeywords: ['horizontal strakes', 'strake grille', 'strakes across', 'full width strakes'],
        incompatibleKeywords: ['open mesh grille', 'vertical slats', 'kidney grille', 'singleframe', 'front mustache', 'deformable winglets', 'shut-off gurney', 'gurney', 'body-color perforated']
      },
      hood_geometry: {
        name: 'sculpted_hood_with_deep_air_vents',
        positiveKeywords: ['hood vents', 'sculpted air vents on hood', 'hood air extractors', 'dual hood scoops'],
        incompatibleKeywords: ['clean sculpted hood without vents', 'smooth hood without vents']
      },
      side_intake_type: {
        name: 'door_top_sculpted_air_channel',
        positiveKeywords: ['sculpted waist', 'door top intake', 'door air duct', 'butterfly door intake box', 'waist channel'],
        incompatibleKeywords: ['triple fender gills only', 'floating tendon', 'smooth door', 'clean rear fender', 'clean body sides']
      },
      roofline_greenhouse: {
        name: 'wraparound_visor_canopy',
        positiveKeywords: ['wraparound visor', 'visor canopy', 'helmet canopy', 'targa visor', 'hidden a-pillar', 'curved glass windshield'],
        incompatibleKeywords: ['conventional pillars', 'standard coupe greenhouse', 'sedan roofline', 'fastback grand tourer']
      },
      door_architecture: {
        name: 'butterfly_doors_with_intake_box',
        positiveKeywords: ['butterfly door', 'fender-mounted mirror', 'door tops mirror'],
        incompatibleKeywords: ['conventional door', 'front hinged door']
      },
      wing_and_spoiler_architecture: {
        name: 'integrated_lip_spoiler_above_horizontal_strakes',
        positiveKeywords: ['integrated lip spoiler', 'rear strake wing', 'lip spoiler'],
        incompatibleKeywords: ['active 3-position spoiler', 'towering swan-neck wing']
      },
      rear_fascia_and_strakes: {
        name: 'full_width_horizontal_rear_strakes',
        positiveKeywords: ['horizontal rear strakes', 'rear strakes', 'horizontal slats rear', 'rear louvers'],
        incompatibleKeywords: ['minimalist taillight', 'clean rear tail without strakes']
      },
      rear_architecture_and_exhaust: {
        name: 'full_width_horizontal_rear_strakes_twin_central_high_exit',
        positiveKeywords: ['horizontal rear strakes', 'rear strakes', 'horizontal slats rear', 'twin central high-exit rectangular exhaust', 'central rectangular exhaust'],
        incompatibleKeywords: ['round twin exhaust tips', 'quad outer tips', 'round taillights', 'single round taillights', 'triple central exhaust', 'triple exhaust', 'three central exhaust', 'quad round exhaust']
      },
      proportions: {
        name: 'mid_engine_icona_prototype',
        positiveKeywords: ['cab-forward', 'prototype sports car proportions', 'sculpted waist', 'low slung'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan', 'long sweeping hood and cab-rearward']
      }
    }
  },

  // ── FERRARI 458 ITALIA ──
  {
    vehicleId: 'ferrari-458-italia',
    make: 'Ferrari',
    model: '458 Italia',
    generation: 'F142',
    proportionsDescription: 'Mid-rear naturally aspirated V8 coupe with elongated vertical swept-back headlights, deformable mustache aero winglets, single round taillights, and triple central exhaust',
    confusableWith: ['ferrari-458-spider', 'ferrari-488-pista', 'ferrari-sf90-stradale', 'ferrari-daytona-sp3', 'ferrari-amalfi', 'ferrari-296-gtb'],
    traits: {
      // STRUCTURED GEOMETRY ONLY: the F142 discriminator is a TALL, vertically oriented lens that
      // sweeps back along the wing — not generic "LED strip" wording.
      headlight_shape: {
        name: 'tall_vertical_swept_back_lens',
        positiveKeywords: ['elongated vertical', 'swept-back headlight', 'vertical lens', 'vertically oriented lamp', 'vertical headlight', 'f142 headlight', 'tall narrow lamp'],
        incompatibleKeywords: ['horizontal eyelid covers', 'retractable covers', 'c-clamp', 'c-shaped', 'c shaped', 'annular lamp', 'slotted lamp', 'lamp bar', 'round bug eye', 'fried egg']
      },
      front_intake_grille: {
        name: 'single_wide_mouth_with_flexible_mustache_winglets',
        positiveKeywords: ['single wide mouth', 'front mustache', 'deformable winglets', 'flexible aero elastomeric', 'central horse badge grille', 'mustache winglets'],
        incompatibleKeywords: ['horizontal strakes', 'horizontal slats', 'twin kidney', 'panamericana', 'slatted front bumper']
      },
      side_intake_type: {
        name: 'clean_haunches_no_side_scoop',
        positiveKeywords: ['smooth door', 'clean rear fender', 'clean flank', 'no side intake scoop', 'smooth waist', 'unbroken haunches'],
        incompatibleKeywords: ['sculpted waist channel', 'butterfly door intake box', 'large side scoop', 'haunch intake']
      },
      roofline_greenhouse: {
        name: 'fixed_coupe_roof_sloping_rear_glass_engine_cover',
        positiveKeywords: ['fixed coupe roof', 'glass rear engine cover', 'sloping rear glass', 'mid-engine glass hatch', 'coupe roofline'],
        incompatibleKeywords: ['dual rear flying buttresses', 'buttresses', 'open top targa', 'retractable hardtop', 'wraparound visor canopy']
      },
      rear_architecture_and_exhaust: {
        name: 'triple_central_exhaust_pipes_single_round_taillights',
        positiveKeywords: ['triple central exhaust', 'triple exhaust', 'three central exhaust', '3 central exhaust', 'three exhaust tips', 'single round taillights', 'round circular taillights'],
        incompatibleKeywords: ['full width horizontal rear strakes', 'horizontal rear strakes', 'rectangular exhaust', 'twin dual outer exhaust', 'squircle taillights', 'single central exhaust', 'single centre exhaust', 'one central tailpipe']
      },
      proportions: {
        name: 'mid_engine_berlinetta',
        positiveKeywords: ['mid-engine', 'cab-forward', 'berlinetta', 'low slung supercar', 'swept front'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── FERRARI 458 SPIDER ──
  {
    vehicleId: 'ferrari-458-spider',
    make: 'Ferrari',
    model: '458 Spider',
    generation: 'F142',
    proportionsDescription: 'Mid-rear naturally aspirated V8 open-top supercar with retractable aluminum hardtop, dual rear flying buttresses, single round taillights, and triple central exhaust',
    confusableWith: ['ferrari-458-italia', 'ferrari-488-pista', 'ferrari-sf90-stradale', 'ferrari-296-gtb'],
    traits: {
      // STRUCTURED GEOMETRY ONLY: the F142 discriminator is a TALL, vertically oriented lens that
      // sweeps back along the wing — not generic "LED strip" wording.
      headlight_shape: {
        name: 'tall_vertical_swept_back_lens',
        positiveKeywords: ['elongated vertical', 'swept-back headlight', 'vertical lens', 'vertically oriented lamp', 'vertical headlight', 'f142 headlight', 'tall narrow lamp'],
        incompatibleKeywords: ['horizontal eyelid covers', 'retractable covers', 'c-clamp', 'c-shaped', 'c shaped', 'annular lamp', 'slotted lamp', 'lamp bar', 'round bug eye', 'fried egg']
      },
      front_intake_grille: {
        name: 'single_wide_mouth_with_flexible_mustache_winglets',
        positiveKeywords: ['single wide mouth', 'front mustache', 'deformable winglets', 'flexible aero elastomeric', 'central horse badge grille', 'mustache winglets'],
        incompatibleKeywords: ['horizontal strakes', 'horizontal slats', 'twin kidney', 'panamericana', 'slatted front bumper']
      },
      side_intake_type: {
        name: 'clean_haunches_no_side_scoop',
        positiveKeywords: ['smooth door', 'clean rear fender', 'clean flank', 'no side intake scoop', 'smooth waist', 'unbroken haunches'],
        incompatibleKeywords: ['sculpted waist channel', 'butterfly door intake box', 'large side scoop', 'haunch intake']
      },
      roofline_greenhouse: {
        name: 'dual_flying_buttresses_retractable_hardtop',
        // STRUCTURED GEOMETRY ONLY: an open-top architecture claim must rest on observable
        // roof mechanics. Bare tokens like "buttresses" or "spider" are satisfied by shared
        // family wording on CLOSED cars (296/F8/SF90 all have flying buttresses; "spider" is
        // a trim name), and let a closed-car candidate win an open-top trait it cannot have.
        positiveKeywords: ['hardtop', 'retractable roof', 'convertible roof', 'folding roof', 'soft top', 'soft-top', 'spider tonneau', 'spider engine cover', 'open-top', 'open top', 'open cockpit', 'drop-top', 'targa roofline'],
        incompatibleKeywords: ['sloping full glass rear hatch', 'coupe rear glass cover', 'wraparound visor canopy', 'fixed roof', 'fixed coupe roof']
      },
      rear_architecture_and_exhaust: {
        name: 'triple_central_exhaust_pipes_single_round_taillights',
        positiveKeywords: ['triple central exhaust', 'triple exhaust', 'three central exhaust', '3 central exhaust', 'three exhaust tips', 'single round taillights', 'round circular taillights'],
        incompatibleKeywords: ['full width horizontal rear strakes', 'horizontal rear strakes', 'rectangular exhaust', 'twin dual outer exhaust', 'squircle taillights', 'single central exhaust', 'single centre exhaust', 'one central tailpipe']
      },
      proportions: {
        name: 'mid_engine_spider',
        positiveKeywords: ['mid-engine spider', 'cab-forward convertible', 'open-top supercar', 'low slung spider'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── FERRARI 488 PISTA ──
  {
    vehicleId: 'ferrari-488-pista',
    make: 'Ferrari',
    model: '488 Pista',
    generation: 'F142M',
    proportionsDescription: 'Mid-engine track-focused V8 supercar with front hood S-Duct channel, dual side intake splitters, and raised dual circular exhausts',
    confusableWith: ['ferrari-458-italia', 'ferrari-458-spider', 'ferrari-sf90-stradale', 'ferrari-daytona-sp3'],
    traits: {
      headlight_shape: {
        name: 'swept_back_projector_led',
        positiveKeywords: ['swept-back headlights', 'f142m headlights', 'elongated led headlight', 'projector led'],
        // 488 GTB shares swept/elongated/projector lamps; only the F142M code is Pista-specific.
        familySharedKeywords: ['swept-back headlights', 'elongated led headlight', 'projector led'],
        incompatibleKeywords: ['horizontal eyelid covers', 'retractable covers', 'c-clamp', 'c-shaped', 'horizontal strakes']
      },
      front_intake_grille: {
        name: 'f1_derived_s_duct_hood_channel',
        positiveKeywords: ['s-duct', 'front hood vent', 'bonnet scoop', 'hood air channel', 'front aerodynamic duct', 'carbon front intake'],
        // The S-duct hood channel is on every 488; only exposed-carbon intake wording is Pista-specific.
        familySharedKeywords: ['s-duct', 'front hood vent', 'bonnet scoop', 'hood air channel', 'front aerodynamic duct'],
        incompatibleKeywords: ['horizontal strakes', 'slatted front bumper', 'smooth unvented hood', 'kidney grille']
      },
      side_intake_type: {
        name: 'dual_stage_side_intake_with_splitter_flap',
        positiveKeywords: ['side intake scoop', 'large side air scoop', 'split side intake', 'intercooler duct', 'side intake flap'],
        incompatibleKeywords: ['clean flank without scoop', 'smooth door', 'triple fender gills only']
      },
      roofline_greenhouse: {
        name: 'compact_berlinetta_cockpit_racing_livery',
        positiveKeywords: ['center racing stripe', 'sloping rear glass', 'glass engine cover', 'dolphin tail spoiler'],
        incompatibleKeywords: ['wraparound visor canopy', 'targa visor']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_high_mounted_circular_exhaust_integrated_spoiler',
        positiveKeywords: ['dual circular exhaust', 'twin round exhaust', 'high exit exhaust', 'blown rear spoiler', 'rear diffuser with active flaps'],
        incompatibleKeywords: ['horizontal rear strakes', 'triple central exhaust', 'single center exhaust']
      },
      proportions: {
        name: 'mid_engine_track_special',
        positiveKeywords: ['mid-engine', 'cab-forward', 'track focused', 'low slung supercar'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── FERRARI SF90 STRADALE ──
  {
    vehicleId: 'ferrari-sf90-stradale',
    make: 'Ferrari',
    model: 'SF90 Stradale',
    generation: 'F173',
    proportionsDescription: 'Mid-engine flagship PHEV supercar with slender C-shaped matrix headlights and shut-off Gurney flap',
    confusableWith: ['ferrari-daytona-sp3', 'ferrari-amalfi', 'ferrari-488-pista', 'ferrari-458-italia', 'ferrari-458-spider', 'ferrari-296-gtb'],
    traits: {
      // STRUCTURED GEOMETRY ONLY: the SF90 discriminator is the CLOSED C / annular lamp with an
      // open slot — an actual shape signature, not generic "matrix LED" marketing wording.
      headlight_shape: {
        name: 'closed_c_annular_lamp_with_open_slot',
        positiveKeywords: ['c-shaped', 'c shaped', 'c-clamp', 'annular lamp', 'ring shaped lamp', 'open slot in the lamp', 'slotted lamp', 'closed c daytime running light', 'c shaped daytime running light'],
        incompatibleKeywords: ['horizontal eyelid covers', 'retractable slat cover', 'round bug eye', 'fried egg', 'teardrop', 'teardrop headlight', 'elongated vertical', 'vertical lens', 'tall narrow lamp', 'lamp bar']
      },
      front_intake_grille: {
        name: 'open_nose_wing_diffuser',
        positiveKeywords: ['open nose wing', 'front diffuser channel', 'low slung slotted intake', 'lower bumper splitter', 'shut-off gurney', 'gurney'],
        incompatibleKeywords: ['horizontal strakes front', 'slatted front bumper', 'oval grille']
      },
      side_intake_type: {
        name: 'high_mounted_rear_haunch_intakes',
        positiveKeywords: ['haunch intake', 'rear shoulder intake', 'sculpted side waist'],
        incompatibleKeywords: ['floating tendon', 'triple fender gills']
      },
      roofline_greenhouse: {
        name: 'conventional_coupe_greenhouse',
        positiveKeywords: ['sloping coupe roof', 'conventional a-pillars', 'bubble cabin', 'compact glass engine deck'],
        incompatibleKeywords: ['wraparound visor canopy', 'targa visor', 'hidden a-pillar']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_high_mounted_central_exhaust_squircle',
        positiveKeywords: ['dual high-mounted central exhaust', 'squircle taillights', 'horizontal squircle', 'shut-off gurney flap'],
        incompatibleKeywords: ['horizontal rear strakes', 'slatted rear', 'full width louvers', 'single central', 'single exhaust', 'single center']
      },
      proportions: {
        name: 'mid_engine_flagship_supercar',
        positiveKeywords: ['cab-forward', 'mid-engine', 'wide rear haunches'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── FERRARI 296 GTB ──
  // Discriminators are chosen only where they separate this car from the other fingerprinted
  // Ferrari models (Amalfi, Daytona SP3, SF90 Stradale, 458 Italia, 458 Spider, 488 Pista):
  // a mid-engine TWO-seat berlinetta (not a front-mid-engined 2+2 GT), lamps recessed into
  // front-wing scoops, a flying-buttress rear deck over a shallow rear screen, and a SINGLE
  // central exhaust exiting at the centre of the diffuser.
  {
    vehicleId: 'ferrari-296-gtb',
    make: 'Ferrari',
    model: '296 GTB',
    generation: 'F171',
    proportionsDescription: 'Mid-engine two-seat berlinetta with a short low nose, recessed lamp scoops, flying-buttress rear deck and a single central exhaust',
    confusableWith: ['ferrari-sf90-stradale', 'ferrari-458-italia', 'ferrari-458-spider', 'ferrari-amalfi', 'ferrari-daytona-sp3'],
    traits: {
      proportions: {
        name: 'mid_engine_two_seat_berlinetta',
        positiveKeywords: ['mid-engine two-seater', 'mid-engine berlinetta', 'short front overhang', 'cabin set forward', 'very short nose', 'compact two-seat cabin'],
        incompatibleKeywords: ['front-engine grand tourer', 'front-mid engine 2+2', 'long dash to axle', 'four-door', 'suv']
      },
      headlight_shape: {
        name: 'lamp_recessed_into_front_wing_scoop',
        positiveKeywords: ['recessed lamp', 'headlamp recessed', 'lamp recessed into', 'recessed into the wing', 'recessed into a scoop', 'lamp set into a scoop', 'lamp sunk into the wing', 'lamp housing undercut', 'lamp inside a bodywork recess'],
        incompatibleKeywords: ['c-shaped', 'c shaped', 'c-clamp', 'annular lamp', 'ring shaped lamp', 'elongated vertical', 'vertical lens', 'lamp bar', 'eyelid', 'partial cover', 'round bug eye', 'fried egg']
      },
      front_intake_grille: {
        name: 'low_wide_mesh_grille_with_exposed_radiators',
        positiveKeywords: ['low wide mesh grille', 'exposed radiators', 'two large radiator openings', 'wide lower mesh without slats', 'low short nose with a wide mesh mouth'],
        incompatibleKeywords: ['horizontal strakes', 'horizontal slats', 'body-color perforated', 'upright oval grille', 'kidney grille']
      },
      hood_geometry: {
        name: 'short_hood_forward_of_the_cabin',
        positiveKeywords: ['short bonnet ahead of the cabin', 'brief front lid', 'short hood over a small front compartment'],
        incompatibleKeywords: ['long sweeping hood', 'long bonnet with the cabin set back', 's-duct hood channel']
      },
      roofline_greenhouse: {
        name: 'flying_buttress_deck_over_shallow_rear_screen',
        positiveKeywords: ['flying buttress rear deck', 'buttress sloping into the tail', 'shallow rear screen', 'narrow rear window above a buttress', 'rear deck buttress over the engine bay'],
        incompatibleKeywords: ['wraparound visor canopy', 'fixed coupe roof with a full glass hatch', 'retractable hardtop', 'fabric soft top', 'long hood short deck gt']
      },
      rear_architecture_and_exhaust: {
        name: 'single_central_exhaust_in_the_diffuser',
        positiveKeywords: ['single central exhaust', 'single centre exhaust', 'one central tailpipe', 'exhaust exiting the centre of the diffuser', 'centre exit exhaust'],
        incompatibleKeywords: ['dual high-mounted central exhaust', 'quad round exhaust', 'triple central exhaust', 'twin central rectangular exhaust', 'top-exit exhaust']
      },
      aero_architecture: {
        name: 'active_rear_spoiler_above_a_centre_exit',
        positiveKeywords: ['active rear spoiler above the centre exit', 'integrated deployable spoiler', 'body-colour rear spoiler'],
        incompatibleKeywords: ['towering swan-neck wing', 'full-width horizontal rear strakes', 'integrated lip spoiler above strakes']
      }
    }
  },

  // ── PORSCHE 911 GT3 RS ──
  {
    vehicleId: 'porsche-911-gt3-rs',
    make: 'Porsche',
    model: '911 GT3 RS',
    generation: '992',
    proportionsDescription: 'Extreme motorsport-derived track car with prominent swan-neck active DRS wing, dual front hood extractor nostrils, and front fender pressure louvers',
    confusableWith: ['porsche-911-turbo', 'porsche-911-carrera-997', 'porsche-911-carrera-996'],
    traits: {
      headlight_shape: {
        name: 'round_oval_projector_headlights_4point_drl',
        positiveKeywords: ['round headlight', 'oval headlight', '4-point', 'four-point led', 'projector led'],
        incompatibleKeywords: ['fried egg', 'fried-egg', 'vertical slit', 'horizontal strakes']
      },
      hood_geometry: {
        name: 'dual_carbon_fiber_hood_air_extractor_nostrils',
        positiveKeywords: ['hood nostril', 'hood extractor', 'carbon hood vents', 'dual nostrils', 'radiator extractor', 'hood vents', 'extractor ducts', 'cooling nostrils', 'nostrils'],
        incompatibleKeywords: ['smooth hood without vents', 'clean hood without nostrils', 'power bulge without nostrils', 'flat smooth luggage lid', 'smooth front hood', 'smooth contoured front', 'without hood vents']
      },
      fender_architecture: {
        name: 'front_fender_top_louvers_wheel_arch_cutouts',
        positiveKeywords: ['fender louver', 'fender louvers', 'wheel arch vents', 'pressure louvers', 'fender cutouts', 'slatted fender', 'fender slats', 'louvers'],
        incompatibleKeywords: ['smooth front fenders without vents', 'unvented fenders', 'triple gills only']
      },
      wing_and_spoiler_architecture: {
        name: 'towering_swan_neck_top_mount_active_drs_wing',
        positiveKeywords: ['swan neck', 'swan-neck', 'massive rear wing', 'tall rear wing', 'drs wing', 'active drs', 'top-mount wing', 'towering wing', 'gt3 rs wing', 'high-mounted wing'],
        incompatibleKeywords: ['integrated active spoiler', 'low ducktail only', 'clean decklid without wing', 'no fixed rear wing', 'retractable spoiler flush with body']
      },
      front_intake_grille: {
        name: 'motorsport_wide_mouth_with_side_air_blades',
        positiveKeywords: ['air dam', 'side air blades', 'central radiator', 'wide lower front air dam', 'motorsport front bumper', 'front splitter'],
        incompatibleKeywords: ['panamericana', 'spindle grille', 'concave oval grille']
      },
      side_intake_type: {
        name: 'side_intake_and_front_wheel_arch_cutaways',
        positiveKeywords: ['front wheel cutaways', 'fender openings', 'side decals', 'gt3 rs side script', 'quarter panel air intake'],
        incompatibleKeywords: ['clean smooth body side without aero', 'triple gills']
      },
      rear_architecture_and_exhaust: {
        name: 'central_dual_titanium_exhaust_rear_diffuser',
        positiveKeywords: ['central dual exhaust', 'center exhaust', 'titanium exhaust', 'central twin pipes', 'underbody diffuser'],
        incompatibleKeywords: ['quad rectangular exhaust', 'quad outer exhaust', 'dual outer oval exhaust']
      },
      proportions: {
        name: 'widebody_track_focused_911_supercar',
        positiveKeywords: ['sloping flyline', 'rear-engine', 'wide rear track', 'track-focused', 'aerodynamic guide fins', 'roof fins', 'center-lock'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── PORSCHE 911 TURBO ──
  {
    vehicleId: 'porsche-911-turbo',
    make: 'Porsche',
    model: '911 Turbo',
    generation: '992',
    proportionsDescription: 'Widebody rear-engine everyday supercar with rear fender side air intake ducts, clean front hood, and low integrated active rear spoiler',
    confusableWith: ['porsche-911-gt3-rs', 'porsche-911-carrera-997', 'porsche-911-carrera-996'],
    traits: {
      headlight_shape: {
        name: 'round_oval_projector_headlights_4point_drl',
        positiveKeywords: ['round headlight', 'oval headlight', '4-point', 'four-point led', 'projector led'],
        incompatibleKeywords: ['fried egg', 'fried-egg', 'vertical slit', 'horizontal strakes']
      },
      hood_geometry: {
        name: 'smooth_contoured_front_luggage_lid',
        positiveKeywords: ['smooth hood', 'clean front hood', 'smooth front hood', 'contoured hood without vents', 'unvented hood', 'smooth luggage compartment lid', 'smooth contoured front luggage lid', 'without hood vents'],
        incompatibleKeywords: ['hood nostril', 'dual nostrils', 'radiator extractor', 'cooling nostrils', 'hood extractor ducts', 'nostrils']
      },
      fender_architecture: {
        name: 'smooth_widened_front_fenders_without_louvers',
        isGeneric: true,
        positiveKeywords: ['wide front track without vents', 'unvented front fenders'],
        incompatibleKeywords: ['fender louvers', 'wheel arch pressure louvers', 'slatted fender vents', 'louvers']
      },
      wing_and_spoiler_architecture: {
        name: 'low_profile_integrated_active_rear_spoiler',
        positiveKeywords: ['integrated active spoiler', 'active rear spoiler', 'extendable rear spoiler', 'low rear wing', 'turbo rear spoiler', 'variable rear wing'],
        incompatibleKeywords: ['towering swan neck', 'swan-neck', 'massive top-mount wing', 'high-mounted fixed wing', 'drs actuator']
      },
      side_intake_type: {
        name: 'rear_fender_leading_edge_intercooler_intakes',
        positiveKeywords: ['rear fender intake', 'side air intake', 'intercooler scoop', 'intakes on rear fenders', 'rear haunch intake scoops', 'side intake ducts'],
        incompatibleKeywords: ['no side intakes on rear fenders', 'smooth rear quarter panels without scoops']
      },
      front_intake_grille: {
        name: 'tripartite_lower_bumper_with_active_cooling_flaps',
        positiveKeywords: ['active cooling flaps', 'tripartite lower intake', 'horizontal front bumper slats', 'wide lower front bumper'],
        incompatibleKeywords: ['prominent hood nostrils', 'panamericana', 'spindle grille']
      },
      rear_architecture_and_exhaust: {
        name: 'quad_rectangular_or_dual_oval_outer_exhaust',
        positiveKeywords: ['quad rectangular exhaust', 'outer exhaust tips', 'dual oval exhaust', 'quad exhaust tips', 'wide rear bumper air vents'],
        incompatibleKeywords: ['central dual exhaust', 'central twin round pipes in center of diffuser']
      },
      proportions: {
        name: 'widebody_rear_engine_supercar_proportions',
        positiveKeywords: ['sloping flyline', 'rear-engine', 'wide rear haunches', '911 silhouette', 'all-wheel drive stance'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── PORSCHE 911 (996) ──
  {
    vehicleId: 'porsche-911-carrera-996',
    make: 'Porsche',
    model: '911 Carrera',
    generation: '996',
    proportionsDescription: 'Rear-engine sports car with distinctive integrated fried-egg teardrop headlights',
    confusableWith: ['porsche-911-carrera-997', 'porsche-911-carrera-cabriolet-996', 'porsche-911-gt3-rs', 'porsche-911-turbo', 'porsche-718-boxster'],
    traits: {
      headlight_shape: {
        name: 'fried_egg_integrated_cluster',
        positiveKeywords: ['fried egg', 'fried-egg', 'integrated turn signal', 'irregular ovoid', 'teardrop cutout', 'integrated headlight turn'],
        incompatibleKeywords: ['traditional round', 'circular bug eye', 'separate indicator strip', 'vertical slit']
      },
      front_intake_grille: {
        name: 'simple_bumper_slits',
        positiveKeywords: ['lower apron intake', 'simple bumper slits', 'horizontal bumper intake'],
        incompatibleKeywords: ['large concave oval', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'classic_911_flyline',
        positiveKeywords: ['sloping flyline', 'teardrop flyline', 'classic 911 silhouette', 'rear-engine flyline'],
        incompatibleKeywords: ['soft top', 'convertible roof', 'convertible', 'cabriolet', 'canvas roof', 'fabric convertible', 'wraparound visor canopy', 'mid-engine cab forward', 'long hood gt']
      },
      rear_architecture_and_exhaust: {
        name: 'narrow_horizontal_taillights_smooth_tail',
        positiveKeywords: ['narrow horizontal taillight', 'smooth rounded tail', 'dual exhaust'],
        incompatibleKeywords: ['full width strakes', 'quad outer gt tips', 'top-exit exhaust']
      },
      proportions: {
        name: 'rear_engine_sports_car',
        positiveKeywords: ['rear engine', 'sloping flyline', 'bulbous front fenders'],
        incompatibleKeywords: ['mid-engine cab forward', 'front engine gt']
      }
    }
  },

  // ── PORSCHE 911 (997) ──
  {
    vehicleId: 'porsche-911-carrera-997',
    make: 'Porsche',
    model: '911 Carrera',
    generation: '997',
    proportionsDescription: 'Rear-engine sports car returning to classic round bug-eye headlights with separate bumper indicator strips',
    confusableWith: ['porsche-911-carrera-996', 'porsche-911-gt3-rs', 'porsche-911-turbo', 'porsche-718-boxster'],
    traits: {
      headlight_shape: {
        name: 'classic_round_bugeye_separate_indicators',
        positiveKeywords: ['classic round', 'circular headlight', 'bug eye', 'round headlight', 'separate indicator strip', 'separate lower indicator'],
        incompatibleKeywords: ['fried egg', 'fried-egg', 'integrated turn signal teardrop', 'vertical slit']
      },
      front_intake_grille: {
        name: 'tripartite_lower_intakes_with_led',
        positiveKeywords: ['tripartite', 'three lower intakes', 'horizontal led in intake', 'wide bumper intakes'],
        incompatibleKeywords: ['large concave oval', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'classic_911_flyline_pronounced_hips',
        positiveKeywords: ['sloping flyline', 'pronounced rear hips', 'wide rear fenders', 'classic 911 flyline'],
        incompatibleKeywords: ['soft top', 'convertible roof', 'convertible', 'cabriolet', 'canvas roof', 'fabric convertible', 'wraparound visor canopy', 'mid-engine cab forward']
      },
      rear_architecture_and_exhaust: {
        name: 'wider_angular_taillights',
        positiveKeywords: ['wider taillight', 'angular taillight', 'dual or quad exhaust tips'],
        incompatibleKeywords: ['full width strakes', 'top-exit exhaust']
      },
      proportions: {
        name: 'rear_engine_sports_car',
        positiveKeywords: ['rear engine', 'sloping flyline', 'pronounced rear fender arches'],
        incompatibleKeywords: ['mid-engine cab forward', 'front engine gt']
      }
    }
  },

  // ── KOENIGSEGG GEMERA ──
  {
    vehicleId: 'koenigsegg-gemera',
    make: 'Koenigsegg',
    model: 'Gemera',
    generation: 'Gemera',
    proportionsDescription: 'Four-seater Mega-GT hypercar with extended wheelbase, wraparound visor canopy, and giant B-pillarless KATSAD doors',
    confusableWith: [],
    traits: {
      headlight_shape: {
        name: 'slim_horizontal_quad_matrix',
        positiveKeywords: ['slim horizontal', 'recessed aerodynamic blade', 'matrix led', 'narrow slit cluster'],
        incompatibleKeywords: ['round bug eye', 'fried egg', 'almond swept']
      },
      roofline_greenhouse: {
        name: 'extended_wraparound_visor_canopy',
        positiveKeywords: ['wraparound visor', 'visor canopy', 'extended wheelbase', 'four-seater hypercar', 'long roofline', 'mega-gt'],
        incompatibleKeywords: ['compact two-seat cabin', 'upright sedan']
      },
      door_architecture: {
        name: 'katsad_automated_twisted_synchro_helix_doors',
        positiveKeywords: ['katsad', 'synchro-helix', 'giant door', 'b-pillarless', 'twisted synchro helix'],
        incompatibleKeywords: ['conventional door', 'conventional front-hinged']
      },
      side_intake_type: {
        name: 'sculpted_long_wheelbase_intake',
        positiveKeywords: ['side intake behind door', 'sculpted rocker channel', 'long wheelbase intake'],
        incompatibleKeywords: ['triple front fender gills only']
      },
      rear_architecture_and_exhaust: {
        name: 'top_mounted_hot_titanium_exhaust_slits',
        positiveKeywords: ['top mounted exhaust', 'titanium exhaust slit', 'aerodynamic rear diffuser', 'full width aerodynamic blade'],
        incompatibleKeywords: ['quad outer gt tips', 'low bumper exhaust']
      },
      proportions: {
        name: 'four_seater_mega_gt',
        positiveKeywords: ['four-seater hypercar', 'extended wheelbase', 'mega-gt', 'low slung long hypercar'],
        incompatibleKeywords: ['compact 2-seater', 'suv', 'sedan']
      }
    }
  },

  // ── BMW M4 (G82 / CSL) ──
  {
    vehicleId: 'bmw-m4-csl-g82',
    make: 'BMW',
    model: 'M4',
    generation: 'G82',
    proportionsDescription: 'Front-engine high-performance coupe with vertical twin kidney grilles and double-bubble carbon roof',
    confusableWith: [],
    traits: {
      headlight_shape: {
        name: 'slim_laserlight_with_yellow_drl',
        positiveKeywords: ['yellow drl', 'yellow racing drl', 'laserlight', 'slim headlights'],
        incompatibleKeywords: ['round bug eye', 'fried egg', 'vertical slit']
      },
      front_intake_grille: {
        name: 'vertical_twin_kidney_grille_red_contour',
        positiveKeywords: ['vertical twin kidney', 'twin kidney', 'red perimeter accents', 'kidney grille with red', 'kidney'],
        incompatibleKeywords: ['panamericana', 'singleframe', 'concave oval', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'double_bubble_carbon_roof_hofmeister',
        positiveKeywords: ['double-bubble carbon roof', 'hofmeister kink', 'front-engine long-hood coupe', 'carbon roof'],
        incompatibleKeywords: ['wraparound visor canopy', 'cab-forward teardrop']
      },
      aero_architecture: {
        name: 'csl_ducktail_and_carbon_splitter',
        positiveKeywords: ['ducktail spoiler', 'csl aerodynamic package', 'carbon front splitter with red', 'csl'],
        incompatibleKeywords: ['active airbrake', 'swan neck wing']
      },
      proportions: {
        name: 'front_engine_m_coupe',
        positiveKeywords: ['front-engine long-hood coupe proportions', 'front-engine coupe', 'long hood short deck'],
        incompatibleKeywords: ['mid-engine cab forward', 'suv', 'sedan']
      }
    }
  },

  // ── MERCEDES-AMG GT ──
  {
    vehicleId: 'mercedes-amg-gt',
    make: 'Mercedes-Benz',
    model: 'AMG GT',
    generation: 'C190',
    proportionsDescription: 'Front-mid engine grand tourer sports car with Panamericana vertical grille and long dash-to-axle ratio',
    confusableWith: [],
    traits: {
      front_intake_grille: {
        name: 'panamericana_vertical_slats_grille',
        positiveKeywords: ['panamericana', 'vertical chrome slats', 'amg panamericana', 'panamericana grille'],
        incompatibleKeywords: ['kidney grille', 'singleframe', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'long_hood_short_rear_hatch_gt',
        positiveKeywords: ['long hood', 'rearward cabin', 'sweeping fastback hatch', 'teardrop cockpit'],
        incompatibleKeywords: ['cab-forward teardrop', 'wraparound visor canopy']
      },
      proportions: {
        name: 'front_mid_engine_sports_car',
        positiveKeywords: ['long dash to axle', 'long hood proportions', 'extreme cab-rearward'],
        incompatibleKeywords: ['cab-forward mid-engine', 'suv', 'sedan']
      }
    }
  },

  // ── MASERATI GRANCABRIO ──
  {
    vehicleId: 'maserati-grancabrio',
    make: 'Maserati',
    model: 'GranCabrio',
    generation: 'Gen 1 (M145)',
    proportionsDescription: 'Front-engine grand tourer convertible with long sweeping hood, 2+2 canvas soft top, and oval trident grille',
    confusableWith: ['maserati-granturismo', 'maserati-mc20-cielo'],
    traits: {
      headlight_shape: {
        name: 'swept_back_almond_cluster',
        positiveKeywords: ['almond', 'swept-back almond', 'curved oval', 'swept back headlight', 'elongated headlight'],
        incompatibleKeywords: ['vertical slit', 'vertical compact led', 'horizontal strakes', 'fried egg']
      },
      front_intake_grille: {
        name: 'large_concave_oval_trident_grille',
        positiveKeywords: ['concave grille', 'upright oval grille', 'slatted grille', 'vertical slats', 'large central oval', 'oval trident grille', 'concave vertical'],
        incompatibleKeywords: ['low wide horizontal mouth', 'carbon front splitter', 'horizontal strakes']
      },
      side_intake_type: {
        name: 'front_fender_triple_gills_smooth_quarter',
        positiveKeywords: ['front fender gills', 'triple gills', 'shark gills', 'triple fender vents', 'smooth rear haunch', 'no side scoops'],
        incompatibleKeywords: ['rear fender shoulder intake', 'large side scoop', 'mid-engine intake behind door']
      },
      roofline_greenhouse: {
        name: 'convertible_soft_top_2plus2_gt',
        positiveKeywords: ['soft top', 'canvas roof', 'convertible roof', 'open top', 'cabriolet', 'open-air 2+2'],
        incompatibleKeywords: ['fixed coupe roof', 'glass engine cover over rear axle', 'cab-forward teardrop']
      },
      rear_architecture_and_exhaust: {
        name: 'quad_exhaust_tips_outer_bumper',
        positiveKeywords: ['quad exhaust', 'quad tips', 'four exhaust pipes', 'outer bumper exhaust', 'triangular taillight'],
        incompatibleKeywords: ['dual central mid-height exhaust', 'single center exhaust', 'full horizontal strakes']
      },
      proportions: {
        name: 'front_engine_grand_tourer_convertible',
        positiveKeywords: ['long hood', 'rearward cabin', 'grand tourer proportions', 'convertible grand tourer', 'long dash to axle'],
        incompatibleKeywords: ['cab-forward mid-engine', 'short front overhang', 'sedan']
      }
    }
  },

  // ── MASERATI MC20 CIELO ──
  {
    vehicleId: 'maserati-mc20-cielo',
    make: 'Maserati',
    model: 'MC20 Cielo',
    generation: 'M240',
    proportionsDescription: 'Mid-engine open-top supercar with electrochromic glass roof, butterfly doors, and rear haunch air intakes',
    confusableWith: ['maserati-mc20', 'maserati-grancabrio'],
    traits: {
      headlight_shape: {
        name: 'vertical_compact_led_slit',
        positiveKeywords: ['vertical led', 'vertical slit', 'compact vertical', 'stacked led', 'vertical headlight', 'slit headlight'],
        incompatibleKeywords: ['almond swept', 'curved oval', 'large swept back', 'fried egg', 'round bug eye']
      },
      front_intake_grille: {
        name: 'low_wide_horizontal_mouth_splitter',
        positiveKeywords: ['low wide mouth', 'carbon splitter', 'low-slung intake', 'wide lower mesh', 'front splitter', 'horizontal lower grille'],
        incompatibleKeywords: ['upright oval grille', 'concave oval grille', 'tall vertical grille']
      },
      side_intake_type: {
        name: 'rear_fender_shoulder_intake',
        positiveKeywords: ['shoulder intake', 'rear fender shoulder', 'rear haunch intake', 'mid-engine intake', 'side air intake behind door'],
        incompatibleKeywords: ['triple front fender gills', 'shark gills', 'no side intake']
      },
      roofline_greenhouse: {
        name: 'cielo_smart_glass_convertible_deck',
        positiveKeywords: ['cielo', 'smart glass roof', 'electrochromic glass', 'spyder engine deck', 'trident deck decal', 'convertible roofline'],
        incompatibleKeywords: ['long hood short deck', 'rearward cabin', 'grand tourer proportions', 'canvas soft top 2+2']
      },
      proportions: {
        name: 'mid_engine_cab_forward_spyder',
        positiveKeywords: ['cab-forward', 'cab forward', 'short front hood', 'wide low-slung stance', 'supercar proportions'],
        incompatibleKeywords: ['front-engine grand tourer', 'long hood short deck', 'sedan proportions']
      }
    }
  },

  // ── MCLAREN 720S ──
  {
    vehicleId: 'mclaren-720s',
    make: 'McLaren',
    model: '720S',
    generation: 'Super Series',
    proportionsDescription: 'Mid-engine Super Series flagship with eye-socket deep headlight cavities, smooth internal door ducts, and dual high-mounted circular exhausts',
    confusableWith: ['mclaren-650s', 'mclaren-675lt', 'mclaren-570s'],
    traits: {
      headlight_shape: {
        name: 'eye_socket_deep_headlight_cavities',
        positiveKeywords: ['eye socket', 'eye-socket', 'deep headlight cavity', 'socket headlight', 'eye socket intake', 'slotted light socket'],
        incompatibleKeywords: ['crescent', 'p1-inspired', 'p1 style', 'c-shape', 'c shape', 'p1 crescent', 'c-shape black housing', 'crescent headlight', 'fried egg', 'round bug eye']
      },
      front_intake_grille: {
        name: 'low_slung_aero_splitter_nose',
        positiveKeywords: ['720s front', 'carbon lower splitter', 'low pointed nose', 'smooth front fascia'],
        incompatibleKeywords: ['p1 front bumper', 'large concave oval', 'horizontal strakes']
      },
      side_intake_type: {
        name: 'dihedral_door_internal_air_channel',
        positiveKeywords: ['internal door duct', 'smooth door surface', 'integrated door channel', 'no open side scoop', 'clean body side duct', 'double skin door'],
        incompatibleKeywords: ['side radiator', 'radiator intake', 'large side scoop', 'strakes', 'prominent side scoop', 'open side radiator', 'side intake']
      },
      roofline_greenhouse: {
        name: 'monocage_ii_glass_canopy',
        positiveKeywords: ['monocage', 'glazed c-pillars', 'glass teardrop canopy', '360 degree visibility', 'glass roof panel'],
        incompatibleKeywords: ['wraparound visor canopy', 'long hood gt']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_high_mounted_central_exhaust_tips',
        positiveKeywords: ['high-mounted exhaust', 'dual high exhaust', 'round high exhaust', 'central mesh grille', 'thin horizontal led taillight blade'],
        incompatibleKeywords: ['dual lower bumper exhaust', 'rectangular lower exhaust', 'quad exhaust', 'longtail airbrake', 'active longtail', 'longtail', 'circular titanium', 'titanium circular exhaust']
      },
      proportions: {
        name: 'mid_engine_super_series',
        positiveKeywords: ['mid-engine', 'cab-forward', 'low slung supercar', 'teardrop cabin'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── MCLAREN 650S SPIDER ──
  {
    vehicleId: 'mclaren-650s-spider',
    make: 'McLaren',
    model: '650S Spider',
    generation: 'P11',
    proportionsDescription: 'Mid-engine retractable hardtop supercar with P1 crescent headlights, large side radiator scoops, and dual flying buttress tonneau cover',
    confusableWith: ['mclaren-650s', 'mclaren-675lt-spider', 'mclaren-675lt', 'mclaren-570s'],
    traits: {
      headlight_shape: {
        name: 'p1_crescent_c_shape',
        positiveKeywords: ['crescent', 'c-shape', 'c shape', 'p1 style', 'p1-inspired', 'blade crescent'],
        incompatibleKeywords: ['eye socket', 'eye-socket', 'teardrop swept cluster', 'vertical slit', 'round bug eye']
      },
      side_intake_type: {
        name: 'large_side_radiator_scoop',
        positiveKeywords: ['large side scoop', 'radiator intake', 'prominent side scoop', 'open side radiator', 'side radiator', 'strakes', 'side intake'],
        incompatibleKeywords: ['internal door duct', 'smooth door surface', 'floating tendon']
      },
      roofline_greenhouse: {
        name: 'retractable_hardtop_spider_tonneau',
        // Same open-top discipline as the Ferrari Spider trait: roof MECHANICS or nothing.
        positiveKeywords: ['hardtop', 'retractable roof', 'convertible roof', 'folding roof', 'soft top', 'soft-top', 'spider tonneau', 'open cockpit', 'open-top', 'open top', 'drop-top'],
        incompatibleKeywords: ['monocage glass canopy', 'full glass rear hatch', 'long hood gt', 'fixed roof', 'fixed coupe roof']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_central_mid_bumper_exhaust_airbrake',
        positiveKeywords: ['dual central exhaust', 'mid-height exhaust', 'active rear airbrake'],
        incompatibleKeywords: ['top-exit', 'circular titanium', 'titanium circular exhaust', 'quad exhaust', 'high-mounted round exhaust', 'longtail airbrake', 'active longtail', 'longtail']
      },
      aero_architecture: {
        name: 'standard_650s_airbrake_body_color_sills',
        positiveKeywords: ['650s airbrake', 'body color sills'],
        incompatibleKeywords: ['extended carbon', 'carbon side skirts', 'carbon side sills', 'longtail airbrake', 'active longtail', 'longtail']
      },
      proportions: {
        name: 'mid_engine_spider_supercar',
        positiveKeywords: ['mid-engine spider', 'cab-forward convertible', 'supercar'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── MCLAREN 675LT SPIDER ──
  {
    vehicleId: 'mclaren-675lt-spider',
    make: 'McLaren',
    model: '675LT Spider',
    generation: 'P11',
    proportionsDescription: 'Lightweight track-focused Longtail spider with 3-piece folding hardtop, enlarged carbon airbrake, and dual circular titanium exhausts',
    confusableWith: ['mclaren-675lt', 'mclaren-650s-spider', 'mclaren-650s'],
    traits: {
      headlight_shape: {
        name: 'p1_crescent_c_shape',
        positiveKeywords: ['crescent', 'c-shape', 'c shape', 'p1 style', 'p1-inspired', 'blade crescent'],
        incompatibleKeywords: ['eye socket', 'eye-socket', 'teardrop swept cluster', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'carbon_splitter_with_endplates',
        positiveKeywords: ['carbon front endplate', 'aggressive front splitter', 'front endplate', 'carbon endplate'],
        incompatibleKeywords: ['three-segment aero blade', 'eye socket']
      },
      side_intake_type: {
        name: 'carbon_side_radiator_scoop',
        positiveKeywords: ['large side scoop', 'carbon side intake', 'radiator scoop', 'radiator intake', 'side radiator', 'strakes', 'side intake', 'carbon side sills', 'side sills', 'side skirts', 'extended carbon'],
        incompatibleKeywords: ['internal door duct', 'floating tendon', 'smooth door']
      },
      roofline_greenhouse: {
        name: 'retractable_hardtop_longtail_spider',
        positiveKeywords: ['spider tonneau', 'folding hardtop', 'retractable hardtop', 'open-top spider', 'convertible tonneau', 'flying buttress', 'flying buttresses', 'buttresses'],
        incompatibleKeywords: ['fixed coupe roof', 'monocage glass canopy']
      },
      rear_architecture_and_exhaust: {
        name: 'dual_circular_titanium_top_exit_exhaust',
        positiveKeywords: ['dual circular titanium exhaust', 'top-exit exhaust', 'titanium exhaust tips', 'circular titanium', 'extended longtail airbrake', 'enlarged airbrake', 'carbon rear bumper'],
        incompatibleKeywords: ['dual lower bumper exhaust', 'quad exhaust tips', 'rectangular exhaust']
      },
      aero_architecture: {
        name: 'extended_longtail_active_airbrake',
        positiveKeywords: ['longtail airbrake', 'active longtail', '50% larger airbrake', 'extended rear wing', 'carbon airbrake', 'carbon side skirts', 'carbon side sills', 'extended carbon', 'airbrake'],
        incompatibleKeywords: ['no airbrake', 'fixed ducktail']
      },
      proportions: {
        name: 'mid_engine_longtail_spider',
        positiveKeywords: ['mid-engine spider', 'extended rear longtail', 'low slung spider', 'supercar', 'convertible', 'mid-engine'],
        incompatibleKeywords: ['front-engine gt', 'sedan']
      }
    }
  },

  // ── PORSCHE 911 CARRERA CABRIOLET (996) ──
  {
    vehicleId: 'porsche-911-carrera-cabriolet-996',
    make: 'Porsche',
    model: '911 Carrera Cabriolet',
    generation: '996',
    proportionsDescription: 'Rear-engine convertible sports car with fried-egg integrated headlights and canvas soft-top flyline',
    confusableWith: ['porsche-911-carrera-996', 'porsche-718-boxster'],
    traits: {
      headlight_shape: {
        name: 'fried_egg_integrated_cluster',
        positiveKeywords: ['fried egg', 'fried-egg', 'integrated turn signal', 'irregular ovoid', 'teardrop cutout', 'integrated headlight turn'],
        incompatibleKeywords: ['traditional round', 'circular bug eye', 'separate indicator strip', 'vertical slit', 'four-point led']
      },
      front_intake_grille: {
        name: 'simple_bumper_slits',
        positiveKeywords: ['lower apron intake', 'simple bumper slits', 'horizontal bumper intake'],
        incompatibleKeywords: ['large concave oval', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'soft_top_convertible_flyline',
        positiveKeywords: ['soft top', 'canvas roof', 'convertible roof', 'cabriolet', 'black soft top', 'folding fabric roof'],
        incompatibleKeywords: ['fixed coupe roof', 'coupe', 'hardtop coupe', 'glass engine cover', 'wraparound visor canopy']
      },
      rear_architecture_and_exhaust: {
        name: 'narrow_horizontal_taillights_smooth_tail',
        positiveKeywords: ['narrow horizontal taillight', 'smooth rounded tail', 'dual exhaust'],
        incompatibleKeywords: ['full width strakes', 'top-exit exhaust']
      },
      proportions: {
        name: 'rear_engine_convertible_flyline',
        positiveKeywords: ['rear engine', 'convertible flyline', 'sloping rear soft top', 'bulbous front fenders'],
        incompatibleKeywords: ['mid-engine cab forward', 'front engine gt']
      }
    }
  },

  // ── PORSCHE 718 BOXSTER (982) ──
  {
    vehicleId: 'porsche-718-boxster',
    make: 'Porsche',
    model: '718 Boxster',
    generation: '982',
    proportionsDescription: 'Mid-engine two-seater roadster with lateral side air scoops, 4-point LED DRLs, and fabric roadster top',
    confusableWith: ['porsche-911-carrera-cabriolet-996', 'porsche-911-carrera-996', 'porsche-911-carrera-997'],
    traits: {
      headlight_shape: {
        name: 'four_point_led_cluster',
        positiveKeywords: ['four-point led', '4-point led', 'four point led', 'bi-xenon projector', 'compact modern porsche headlight'],
        incompatibleKeywords: ['fried egg', 'fried-egg', 'classic bug eye with separate lower strip']
      },
      front_intake_grille: {
        name: 'lateral_bumper_cooling_ducts',
        positiveKeywords: ['lateral intake', 'horizontal cooling fins', '718 front bumper', 'wide lower air ducts'],
        incompatibleKeywords: ['kidney grille', 'concave oval']
      },
      side_intake_type: {
        name: 'prominent_mid_engine_side_scoop',
        positiveKeywords: ['side intake', 'side air scoop', 'lateral intake behind door', 'door intake scoop', 'mid-engine intake'],
        incompatibleKeywords: ['smooth rear haunch without scoop', 'no side intake', 'smooth 911 rear quarter']
      },
      roofline_greenhouse: {
        name: 'roadster_soft_top_two_seater',
        positiveKeywords: ['roadster', 'soft top', 'speedster haunches', 'two-seat convertible', 'boxster roofline'],
        incompatibleKeywords: ['rear-engine 2+2 flyline', 'fixed coupe roof', 'coupe flyline']
      },
      rear_architecture_and_exhaust: {
        name: 'central_trapezoidal_or_twin_exhaust_porsche_accent_strip',
        positiveKeywords: ['central exhaust', 'black accent strip between taillights', 'three-dimensional porsche badge', 'compact rear deck'],
        incompatibleKeywords: ['full width strakes', 'top-exit titanium']
      },
      proportions: {
        name: 'mid_engine_roadster_proportions',
        positiveKeywords: ['mid-engine roadster', 'compact roadster', 'short wheelbase sports car'],
        incompatibleKeywords: ['rear-engine 911 2+2 proportions', 'front-engine gt', 'sedan']
      }
    }
  },

  // ── LAMBORGHINI GALLARDO (L140) ──
  {
    vehicleId: 'lamborghini-gallardo',
    make: 'Lamborghini',
    model: 'Gallardo',
    generation: 'L140',
    proportionsDescription: 'Mid-engine V10 wedge supercar with upright trapezoidal headlights and angular side radiator scoops',
    confusableWith: ['lamborghini-huracan-lp610-4'],
    traits: {
      headlight_shape: {
        name: 'upright_trapezoidal_lens',
        positiveKeywords: ['trapezoidal headlight', 'vertical rectangular lens', 'straight-edged headlight', 'tall headlight lens', 'halogen projector', 'xenon trapezoid'],
        incompatibleKeywords: ['y-shaped led', 'y-signature drl', 'hexagonal led', 'round bug eye', 'fried egg']
      },
      front_intake_grille: {
        name: 'dual_rectangular_front_intakes',
        positiveKeywords: ['twin rectangular intake', 'straight horizontal front air scoops', 'slatted lower bumper pods', 'dual front air dams'],
        incompatibleKeywords: ['hexagonal front splitter', 'y-shaped front winglets', 'omega splitter']
      },
      side_intake_type: {
        name: 'triangular_side_intake_duct',
        positiveKeywords: ['triangular side scoop', 'angular side intake behind door', 'large side air scoop', 'lower rocker intake'],
        incompatibleKeywords: ['smooth flank without scoop', 'triple fender gills']
      },
      roofline_greenhouse: {
        name: 'classic_angular_wedge_cockpit',
        positiveKeywords: ['angular wedge greenhouse', 'steep raked windshield', 'short sloping rear engine glass', 'classic wedge silhouette'],
        incompatibleKeywords: ['wraparound visor canopy', 'long hood gt']
      },
      rear_architecture_and_exhaust: {
        name: 'tall_vertical_rectangular_taillights_dual_oval_exhaust',
        positiveKeywords: ['tall vertical taillight', 'rectangular rear grille', 'dual or quad round exhausts in lower bumper'],
        incompatibleKeywords: ['horizontal y-shaped taillights', 'high exit hexagonal exhaust', 'full horizontal strakes']
      },
      proportions: {
        name: 'classic_compact_wedge_supercar',
        positiveKeywords: ['angular wedge', 'compact wedge supercar', 'cab-forward v10'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── LAMBORGHINI HURACÁN (LP 610-4) ──
  {
    vehicleId: 'lamborghini-huracan-lp610-4',
    make: 'Lamborghini',
    model: 'Huracán LP 610-4',
    generation: 'Huracán',
    proportionsDescription: 'Modern mid-engine V10 supercar featuring signature dual Y-shaped LED daytime running lights and hexagonal styling',
    confusableWith: ['lamborghini-gallardo'],
    traits: {
      headlight_shape: {
        name: 'dual_y_shaped_led_drl',
        positiveKeywords: ['y-shaped led', 'y-signature', 'dual y led', 'slanted full led headlights', 'sharp angular led drl'],
        incompatibleKeywords: ['upright trapezoidal lens', 'vertical rectangular lens', 'round bug eye', 'fried egg']
      },
      front_intake_grille: {
        name: 'hexagonal_sculpted_front_intake',
        positiveKeywords: ['hexagonal intake', 'sharp angular front splitter', 'aerodynamic front nostrils', 'hexagonal mesh'],
        incompatibleKeywords: ['dual rectangular front intakes', 'twin kidney', 'singleframe']
      },
      side_intake_type: {
        name: 'horizontal_lower_sill_and_shoulder_ducts',
        positiveKeywords: ['lower sill intake', 'shoulder intake scoop', 'hexagonal window cutline'],
        incompatibleKeywords: ['triangular side scoop', 'triple fender gills']
      },
      roofline_greenhouse: {
        name: 'fastback_wedge_hexagon_windows',
        positiveKeywords: ['sloping fastback', 'hexagonal side glass', 'louvers or glass engine cover'],
        incompatibleKeywords: ['wraparound visor canopy', 'upright sedan']
      },
      rear_architecture_and_exhaust: {
        name: 'horizontal_y_taillights_quad_exhausts',
        positiveKeywords: ['horizontal y-shaped taillights', 'quad lower exhaust tips', 'high diffuser', 'hexagonal rear mesh'],
        incompatibleKeywords: ['tall vertical rectangular taillights', 'single center exhaust']
      },
      proportions: {
        name: 'modern_hexagonal_wedge_supercar',
        positiveKeywords: ['hexagonal wedge', 'low slung supercar', 'cab forward v10'],
        incompatibleKeywords: ['front-engine gt', 'suv', 'sedan']
      }
    }
  },

  // ── NISSAN SKYLINE GT-R (R34) ──
  {
    vehicleId: 'nissan-skyline-gtr-r34',
    make: 'Nissan',
    model: 'Skyline GT-R',
    generation: 'R34',
    proportionsDescription: 'Front-engine all-wheel-drive Japanese icon with rectangular xenon headlights, central front intercooler, and signature quad round taillights',
    confusableWith: [],
    traits: {
      headlight_shape: {
        name: 'rectangular_xenon_cluster',
        positiveKeywords: ['rectangular headlight', 'horizontal block lens', 'r34 xenon lens', 'sharp rectangular cluster'],
        incompatibleKeywords: ['quad round projector', 'vertical slit', 'fried egg', 'crescent']
      },
      front_intake_grille: {
        name: 'horizontal_grille_with_central_intercooler_mouth',
        positiveKeywords: ['intercooler', 'front intercooler', 'exposed intercooler', 'gt-r badge', 'horizontal upper grille', 'wide lower bumper opening'],
        incompatibleKeywords: ['kidney grille', 'panamericana', 'singleframe', 'horizontal strakes']
      },
      roofline_greenhouse: {
        name: 'three_box_coupe_greenhouse',
        positiveKeywords: ['three-box coupe', 'upright windshield', 'coupe roofline', 'japanese sports coupe'],
        incompatibleKeywords: ['cab-forward mid-engine', 'wraparound visor canopy', 'flying buttress']
      },
      rear_architecture_and_exhaust: {
        name: 'signature_dual_round_taillights_pedestal_wing',
        positiveKeywords: ['twin round taillights', 'quad round taillights', 'circular taillights', 'pedestal rear wing', 'single large canon exhaust', 'large bore exhaust'],
        incompatibleKeywords: ['full width strakes', 'vertical taillights', 'triple central exhaust']
      },
      proportions: {
        name: 'front_engine_muscular_jdm_coupe',
        positiveKeywords: ['front-engine coupe', 'blistered rear fenders', 'muscular rear quarters', 'japanese performance coupe'],
        incompatibleKeywords: ['cab-forward mid-engine', 'extreme wedge', 'suv']
      }
    }
  },

  // ── HONDA INTEGRA TYPE R (DC2) ──
  {
    vehicleId: 'honda-integra-type-r-dc2',
    make: 'Honda',
    model: 'Integra Type R',
    generation: 'DC2',
    proportionsDescription: 'Lightweight front-engine front-wheel-drive sports coupe with signature high rear pedestal wing, slim nose, and red Honda badge',
    confusableWith: [],
    traits: {
      headlight_shape: {
        name: 'quad_round_projector_or_slim_horizontal',
        positiveKeywords: ['four round headlights', 'quad round projector', 'bug eye round projector', 'slim horizontal headlights', 'dc2 headlights'],
        incompatibleKeywords: ['twin kidney', 'fried egg', 'crescent', 'vertical slit']
      },
      front_intake_grille: {
        name: 'slim_front_intake_with_red_h_badge',
        positiveKeywords: ['red h badge', 'red honda emblem', 'slim front bumper opening', 'front lip spoiler', 'integra front bumper'],
        incompatibleKeywords: ['large exposed intercooler', 'kidney grille', 'panamericana']
      },
      roofline_greenhouse: {
        name: 'compact_liftback_coupe_greenhouse',
        positiveKeywords: ['liftback coupe', 'sloping rear hatch', 'thin pillars', 'compact japanese coupe'],
        incompatibleKeywords: ['cab-forward mid-engine', 'wraparound visor canopy']
      },
      rear_architecture_and_exhaust: {
        name: 'high_pedestal_rear_spoiler_and_horizontal_taillights',
        positiveKeywords: ['pedestal rear wing', 'high rear spoiler', 'horizontal wrap-around taillights', 'single exhaust tip', 'type r wing'],
        incompatibleKeywords: ['twin round taillights', 'quad round taillights', 'quad exhaust']
      },
      proportions: {
        name: 'front_engine_fwd_sports_coupe',
        positiveKeywords: ['front-engine coupe', 'long front overhang', 'compact lightweight coupe'],
        incompatibleKeywords: ['cab-forward mid-engine', 'widebody rear haunches', 'suv']
      }
    }
  },

  // ── TOYOTA GR SUPRA (A90) ──
  {
    vehicleId: 'toyota-gr-supra-a90',
    make: 'Toyota',
    model: 'GR Supra',
    generation: 'A90 (DB)',
    proportionsDescription: 'Front-engine rear-drive sports coupe with double-bubble roof, central pointed nose, wide rear haunches, and integrated ducktail',
    confusableWith: ['toyota-camry'],
    traits: {
      headlight_shape: {
        name: 'swept_back_six_lens_led_with_drl_hook',
        positiveKeywords: ['six-lens led', 'downward drl hook', 'swept-back led headlights', 'slender three-projector', 'supra headlights'],
        incompatibleKeywords: ['round bug eye', 'fried egg', 'vertical slit', 'rectangular block']
      },
      front_intake_grille: {
        name: 'central_pointed_f1_nose_tripartite_intake',
        positiveKeywords: ['central pointed nose', 'tripartite intake', 'three lower intakes', 'f1 style nose', 'gr supra front bumper'],
        incompatibleKeywords: ['kidney grille', 'singleframe', 'panamericana', 'large central oval']
      },
      roofline_greenhouse: {
        name: 'double_bubble_aerodynamic_roof',
        positiveKeywords: ['double-bubble', 'double bubble roof', 'sloping rear hatch', 'compact two-seat cabin'],
        incompatibleKeywords: ['canvas soft top', 'wraparound visor canopy', 'convertible roof']
      },
      side_intake_type: {
        name: 'door_and_rear_quarter_sculpted_accent_ducts',
        positiveKeywords: ['door accent vent', 'sculpted door crease', 'rear haunch flare', 'muscular rear arches'],
        incompatibleKeywords: ['triple front fender gills only', 'large open side radiator scoop']
      },
      rear_architecture_and_exhaust: {
        name: 'integrated_ducktail_dual_circular_exhausts',
        positiveKeywords: ['integrated ducktail spoiler', 'ducktail spoiler', 'dual circular exhaust', 'central f1-style reverse light', 'slender curved led taillights'],
        incompatibleKeywords: ['quad round taillights', 'top-exit exhaust', 'horizontal rear strakes']
      },
      proportions: {
        name: 'front_engine_short_wheelbase_widebody_coupe',
        positiveKeywords: ['long hood short rear deck', 'front-engine rear-wheel drive', 'golden ratio 1.55 wheelbase', 'wide rear haunches'],
        incompatibleKeywords: ['cab-forward mid-engine', 'suv', 'sedan']
      }
    }
  },

  // ── TOYOTA CAMRY (XV70) ──
  {
    vehicleId: 'toyota-camry',
    make: 'Toyota',
    model: 'Camry',
    generation: 'XV70',
    proportionsDescription: 'Mid-size front-engine four-door passenger sedan with wide lower bumper grille, swept-back headlights, and formal sedan roofline',
    confusableWith: ['toyota-gr-supra-a90'],
    traits: {
      headlight_shape: {
        name: 'swept_back_slender_led_headlights',
        positiveKeywords: ['swept-back headlights', 'swept back headlights', 'slender headlights', 'led headlights', 'projector beam'],
        incompatibleKeywords: ['round bug eye', 'fried egg', 'pop-up']
      },
      front_intake_grille: {
        name: 'wide_lower_bumper_grille_catamaran_accent',
        positiveKeywords: ['wide lower grille', 'wide lower bumper grille', 'trapezoidal lower grille', 'horizontal slatted lower air dam'],
        incompatibleKeywords: ['kidney grille', 'singleframe', 'panamericana', 'spindle grille']
      },
      roofline_greenhouse: {
        name: 'formal_four_door_sedan_greenhouse',
        positiveKeywords: ['sedan roofline', 'four-door sedan', 'four-door', 'fixed steel roof', 'sedan'],
        incompatibleKeywords: ['canvas soft top', 'wraparound visor canopy', 'convertible roof', 'spider', 'targa', 'two-door coupe']
      },
      rear_architecture_and_exhaust: {
        name: 'horizontal_sedan_taillights',
        positiveKeywords: ['horizontal sedan taillights', 'wrap-around taillights', 'dual exhaust outlets'],
        incompatibleKeywords: ['quad round taillights', 'top-exit exhaust', 'horizontal rear strakes', 'swan neck wing']
      },
      proportions: {
        name: 'front_engine_four_door_passenger_sedan',
        positiveKeywords: ['four-door sedan', 'sedan', 'mid-size sedan', 'three-box sedan', 'front-wheel drive proportions'],
        incompatibleKeywords: ['cab-forward mid-engine', 'low slung supercar', 'two-seat sports coupe', 'open-top spider']
      }
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// FINE-GRAINED DISCRIMINATOR CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class FineGrainedModelDiscriminator {
  private fingerprintCatalog: Map<string, ModelMorphologicalFingerprint> = new Map();

  constructor() {
    MORPHOLOGICAL_FINGERPRINTS.forEach((fp) => {
      this.fingerprintCatalog.set(fp.vehicleId.toLowerCase(), fp);
      this.fingerprintCatalog.set(`${fp.make} ${fp.model}`.toLowerCase(), fp);
      if (fp.generation) {
        this.fingerprintCatalog.set(`${fp.make} ${fp.model} ${fp.generation}`.toLowerCase(), fp);
        this.fingerprintCatalog.set(`${fp.make} ${fp.model} (${fp.generation})`.toLowerCase(), fp);
      }
    });

    // INVARIANT 4: Reject startup if confusable graph has orphaned or asymmetric edges
    const graphValidation = this.validateConfusableGraph();
    if (!graphValidation.valid) {
      throw new Error(`[FineGrainedModelDiscriminator] Confusable graph integrity invariant failed:\n${graphValidation.errors.join('\n')}`);
    }
  }

  public getFingerprint(query: string): ModelMorphologicalFingerprint | null {
    if (!query) return null;
    const norm = query.toLowerCase().trim();
    return this.fingerprintCatalog.get(norm) || null;
  }

  public findFingerprintsByMake(make: string): ModelMorphologicalFingerprint[] {
    const normMake = make.toLowerCase().trim();
    const results: ModelMorphologicalFingerprint[] = [];
    const seen = new Set<string>();

    for (const fp of MORPHOLOGICAL_FINGERPRINTS) {
      if (fp.make.toLowerCase() === normMake && !seen.has(fp.vehicleId)) {
        seen.add(fp.vehicleId);
        results.push(fp);
      }
    }
    return results;
  }

  /**
   * Discriminate between candidate models using evidence-grounded morphological comparison.
   * STRICT INVARIANTS:
   * - Trait contributes 0 if NOT_VISIBLE or OCCLUDED.
   * - Missing expected feature only penalizes if confirmed VISIBLE.
   * - No exact model derived solely from manufacturer prior.
   */
  public discriminate(params: {
    visualEvidence: VisualEvidence;
    viewpoint: ViewpointType;
    evidenceList?: string[];
    candidates?: { name: string; score?: number }[];
    fallbackMake?: string;
    fallbackModel?: string;
  }): FineGrainedDiscriminationResult {
    const { visualEvidence, viewpoint, evidenceList, fallbackMake, fallbackModel } = params;
    const candidates: { name: string; score?: number }[] = params.candidates || (params as any).rawCandidates?.map((c: any) => ({
      name: `${c.make} ${c.model}`,
      score: c.confidence
    })) || [];

    // 1. Build semantic evidence: full text plus per-category eligibility (front/rear routing).
    const zonedEvidence = buildZonedEvidence([
      visualEvidence.body_style || '',
      visualEvidence.grille || '',
      visualEvidence.headlights || '',
      visualEvidence.taillights || '',
      visualEvidence.hood || '',
      visualEvidence.roofline || '',
      visualEvidence.windows || '',
      visualEvidence.wheels || '',
      visualEvidence.exhaust || '',
      visualEvidence.aero || '',
      visualEvidence.badges || '',
      visualEvidence.body_proportions || '',
      ...(visualEvidence.distinctive_details || []),
      ...(evidenceList || [])
    ]);
    const evidenceText = zonedEvidence.full;

    // 2. Compute viewpoint-aware visibility matrix
    const visibilityMatrix = computeVisibilityMatrix(viewpoint, evidenceText);

    // 3. Assemble candidate fingerprints
    const candidateFingerprints: { candidateName: string; initialScore: number; fp: ModelMorphologicalFingerprint }[] = [];
    const seenIds = new Set<string>();

    // Determine verified target make: fallbackMake takes precedence over adversarial candidate names
    const targetMake = fallbackMake || (candidates[0] ? this.resolveFingerprintForCandidate(candidates[0].name)?.make : undefined);

    // Helper to test if a candidate string matches a confusable term with token-safe boundaries
    const matchesConfusable = (text: string, term: string): boolean => {
      const cleanText = text.toLowerCase();
      const cleanTerm = term.toLowerCase().trim();
      if (!cleanTerm) return false;
      if (cleanTerm.includes(' ') || cleanTerm.includes('-')) {
        return cleanText.includes(cleanTerm);
      }
      const regex = new RegExp(`\\b${cleanTerm}\\b`, 'i');
      return regex.test(cleanText);
    };

    const candidateQueries = [
      ...candidates.map((c: { name: string; score?: number }) => c.name),
      fallbackModel || ''
    ].filter(Boolean);

    // A. Add fingerprints directly matching incoming candidates
    for (const c of candidates) {
      const fp = this.resolveFingerprintForCandidate(c.name);
      if (fp && !seenIds.has(fp.vehicleId)) {
        // If a verified target make is active, do not allow adversarial candidates from foreign makes into peer comparison!
        if (targetMake && fp.make.toLowerCase() !== targetMake.toLowerCase()) {
          continue;
        }
        seenIds.add(fp.vehicleId);
        candidateFingerprints.push({
          candidateName: c.name,
          initialScore: typeof c.score === 'number' ? c.score : 0.50,
          fp
        });
      }
    }

    // B. If fallbackModel directly matches a fingerprint of targetMake
    if (fallbackModel && targetMake) {
      const fp = this.resolveFingerprintForCandidate(fallbackModel);
      if (fp && fp.make.toLowerCase() === targetMake.toLowerCase() && !seenIds.has(fp.vehicleId)) {
        seenIds.add(fp.vehicleId);
        candidateFingerprints.push({
          candidateName: `${fp.make} ${fp.model}`,
          initialScore: 0.50,
          fp
        });
      }
    }

    // C. Confusable Peer Expansion:
    // Only pull in registered peers from targetMake if:
    // 1) Any already added candidateFingerprint lists peer.vehicleId in confusableWith, OR
    // 2) peer lists any already added candidateFingerprint in confusableWith, OR
    // 3) candidate queries match peer.model or peer.vehicleId, OR
    // 4) candidateFingerprints is empty and targetMake is specified (Amendment 3: No-Registry Fallthrough)
    if (targetMake) {
      const peers = this.findFingerprintsByMake(targetMake);
      const isUniverseFallback = candidateFingerprints.length === 0;

      for (const peer of peers) {
        if (seenIds.has(peer.vehicleId)) continue;

        const isConfusableWithCandidates = candidateFingerprints.some((cf) =>
          cf.fp.confusableWith?.includes(peer.vehicleId) || peer.confusableWith?.includes(cf.fp.vehicleId)
        );

        const isConfusableWithQuery = candidateQueries.some((q) =>
          matchesConfusable(q, peer.model) ||
          matchesConfusable(q, peer.vehicleId) ||
          (peer.confusableWith && peer.confusableWith.some((term) => matchesConfusable(q, term)))
        );

        if (isUniverseFallback || isConfusableWithCandidates || isConfusableWithQuery) {
          seenIds.add(peer.vehicleId);
          candidateFingerprints.push({
            candidateName: `${peer.make} ${peer.model}`,
            initialScore: 0.50,
            fp: peer
          });
        }
      }
    }

    // If no candidate fingerprints exist for this manufacturer, return early with empty result to avoid foreign candidate pollution!
    if (candidateFingerprints.length === 0) {
      return {
        topCandidate: null,
        runnerUp: null,
        margin: 0,
        needsVerification: false,
        rawConflict: false,
        visibilityMatrix,
        scoredCandidates: [],
        evidenceGrounded: false,
        reason: 'No morphological fingerprints catalogued for target manufacturer.',
        variant: null
      };
    }

    // 4. Score each candidate model against observable evidence
    // INVARIANT 1: RAW PROVIDER NEUTRALITY
    // All same-manufacturer candidates start at the identical neutral baseline (0.50).
    // Raw provider confidence MUST NOT create an initial score advantage.
    const neutralBaseline = 0.50;
    const scoredCandidates: ScoredCandidateModel[] = candidateFingerprints.map(({ fp }) => {
      let score = neutralBaseline;
      const evaluations: TraitEvaluation[] = [];
      const supporting: string[] = [];
      const contradictions: string[] = [];
      const unobservable: string[] = [];
      let genericEvidenceCount = 0;
      let specificEvidenceCount = 0;
      let contradictionCount = 0;
      let visibleTraitCount = 0;

      // Evaluate each morphological category
      for (const [categoryKey, visibility] of Object.entries(visibilityMatrix) as [MorphologicalCategory, TraitVisibilityState][]) {
        const expectedTrait = fp.traits[categoryKey];
        if (!expectedTrait) continue;

        // INVARIANT 6: Viewpoint Gating
        // NOT_VISIBLE / OCCLUDED = exactly zero evidence, zero contradiction, zero penalty.
        if (visibility === 'NOT_VISIBLE' || visibility === 'OCCLUDED') {
          unobservable.push(`${expectedTrait.name} (${categoryKey}) is ${visibility.toLowerCase()} from ${viewpoint} viewpoint`);
          evaluations.push({
            category: categoryKey,
            visibility,
            expectedTraitName: expectedTrait.name,
            matched: false,
            contradicted: false,
            scoreDelta: 0,
            reason: `Feature is ${visibility.toLowerCase()} from current angle. Contributes ZERO evidence and ZERO penalty.`
          });
          continue;
        }

        // Feature zone IS VISIBLE or PARTIAL
        visibleTraitCount += 1;
        const weight = visibility === 'VISIBLE' ? 1.0 : 0.5;

        // FIELD-AWARE ROUTING: this trait may only be judged on evidence that does not describe
        // the opposite end of the vehicle (a rear-lamp description can never satisfy a front trait).
        const categoryText = zonedEvidence.forCategory(categoryKey);

        // Helper to check if a keyword match is negated by preceding tokens.
        // Handles natural language conjunctive negation:
        //   "without hood vents or nostrils" negates both "hood vents" AND "nostrils"
        //   "no side scoops, intakes, or vents" negates all three
        // Algorithm: Find keyword position, walk backwards across conjunction tokens
        //           (or, and, commas) to find a negation root word.
        const isTermNegated = (text: string, kw: string): boolean => {
          // Phase 1: Check for direct negation adjacency (fast path)
          // Word-boundary anchored: a bare substring test would treat "piano hood" as a
          // negation of "hood" because the token "no" appears inside an unrelated word.
          const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const directNegRe = new RegExp(
            `\\b(?:without|lacks|lack\\s+of|absence\\s+of|not|no)\\b\\s*${escapedKw}|\\bnon-${escapedKw}`,
            'i'
          );
          if (directNegRe.test(text)) return true;

          // Phase 2: Conjunctive negation detection
          // For "without A or B", "without A, B, or C", "no A and B"
          // Walk backwards from the keyword to see if it's part of a negated conjunction.
          //
          // Negation roots MUST be matched as whole words. Substring matching here is a proven
          // defect: the token "no" is a substring of ordinary vehicle words ("nose", "nothing",
          // "notch"), so a preceding phrase such as "along the nose" silently negated every
          // following keyword and suppressed real evidence.
          const negRootRe = /\b(?:without|no|lacks|lack\s+of|absence\s+of|not)\b/;
          const kwIdx = text.indexOf(kw);
          if (kwIdx < 0) return false;

          // Negation scope never crosses a clause/sentence boundary.
          const rawPreceding = text.substring(Math.max(0, kwIdx - 120), kwIdx);
          const clauseBoundary = Math.max(
            rawPreceding.lastIndexOf('.'),
            rawPreceding.lastIndexOf(';'),
            rawPreceding.lastIndexOf('\n')
          );
          const preceding = rawPreceding.substring(clauseBoundary + 1).trimEnd();

          // Scope check: find the negation root that governs the keyword, then verify no
          // positive-scope preposition intervenes between that root and the keyword.
          // "not a convertible, with quad exhausts" — "quad exhausts" is AFFIRMED by "with"
          // and must NOT inherit the negation from "not". Without this guard, a negated
          // clause suppresses every following positive feature in the same sentence.
          const POSITIVE_SCOPE_RE = /\b(?:with|including|featuring|showing|wearing|has|have|plus)\b/i;
          const globalRootRe = new RegExp(negRootRe.source, 'gi');
          let lastRoot: RegExpExecArray | null = null;
          let rootMatch: RegExpExecArray | null;
          while ((rootMatch = globalRootRe.exec(preceding)) !== null) lastRoot = rootMatch;

          if (lastRoot) {
            const between = preceding.substring(lastRoot.index + lastRoot[0].length).trim();
            const firstToken = between.split(/\s+/)[0] ?? '';
            // "not with hood vents" — the preposition is directly governed by the negation
            // root, so the keyword is still negated.
            const prepositionGovernedByRoot =
              /\b(?:with|including|featuring|showing|wearing)\b/i.test(firstToken) &&
              (lastRoot[0] === 'not' || lastRoot[0] === 'no');
            if (!prepositionGovernedByRoot && POSITIVE_SCOPE_RE.test(between)) {
              return false; // positive scope shift: the keyword is affirmed, not negated
            }
            return true;
          }

          return false;
        };

        // Check for positive keyword match. FAMILY-SHARED DISCIPLINE: a keyword that names
        // architecture shared with sibling models of the same family (e.g. the S-duct is on
        // every 488; roof mechanics are shared between a Spider and its coupe) names the
        // FAMILY, not the model, and cannot register as model-specific evidence on its own.
        const matchedPositiveKws = expectedTrait.positiveKeywords.filter((kw) =>
          categoryText.includes(kw) && !isTermNegated(categoryText, kw)
        );
        const familySharedSet = new Set((expectedTrait.familySharedKeywords ?? []).map((k) => k.toLowerCase()));
        const specificPositiveKws = matchedPositiveKws.filter((kw) => !familySharedSet.has(kw.toLowerCase()));
        const matchedOnlyFamilyShared =
          matchedPositiveKws.length > 0 && specificPositiveKws.length === 0;
        const matchesPositive = matchedPositiveKws.length > 0;

        // Check for explicit contradiction
        const matchesContradiction = expectedTrait.incompatibleKeywords.some((kw) =>
          categoryText.includes(kw) && !isTermNegated(categoryText, kw)
        );

        if (matchesPositive && !matchesContradiction) {
          // INVARIANT 7: GENERIC VS SPECIFIC EVIDENCE
          // Generic traits contribute low weight (+0.05). Model-discriminating traits contribute high weight (+0.30).
          // Family-shared-only matches (see above) are generic-weight: they support the family,
          // but must not manufacture model-specific separation between siblings.
          const isGeneric =
            expectedTrait.isGeneric ||
            categoryKey === 'proportions' ||
            matchedOnlyFamilyShared;
          const delta = isGeneric ? (0.05 * weight) : (0.30 * weight);
          score += delta;
          if (isGeneric) {
            genericEvidenceCount += 1;
          } else {
            specificEvidenceCount += 1;
          }
          supporting.push(`Observed ${categoryKey.replace(/_/g, ' ')} matches ${fp.model} ${matchedOnlyFamilyShared ? 'family-shared architecture (not model-specific)' : `signature (${expectedTrait.name})`}`);
          evaluations.push({
            category: categoryKey,
            visibility,
            expectedTraitName: expectedTrait.name,
            matched: true,
            contradicted: false,
            scoreDelta: delta,
            reason: `Confirmed ${isGeneric ? 'generic' : 'specific'} match with ${expectedTrait.name} (+${delta.toFixed(2)})`
          });
        } else if (matchesContradiction) {
          // Explicit contradiction observed in visible zone
          contradictionCount += 1;
          const delta = -0.40 * weight;
          score += delta;
          contradictions.push(`Observed ${categoryKey.replace(/_/g, ' ')} directly contradicts ${fp.model} architecture`);
          evaluations.push({
            category: categoryKey,
            visibility,
            expectedTraitName: expectedTrait.name,
            matched: false,
            contradicted: true,
            scoreDelta: delta,
            reason: `Direct contradiction observed in visible area (${delta.toFixed(2)})`
          });
        } else {
          // Feature zone is visible, but neutral
          evaluations.push({
            category: categoryKey,
            visibility,
            expectedTraitName: expectedTrait.name,
            matched: false,
            contradicted: false,
            scoreDelta: 0,
            reason: `Neutral: feature zone is ${visibility.toLowerCase()} but lacks distinctive distinguishing cues.`
          });
        }
      }

      // INVARIANT 8: DISCRIMINATIVE EVIDENCE DENSITY
      // Winner depends on specific supporting evidence minus specific contradictions
      const evidenceDensity = Number(
        ((specificEvidenceCount - (1.5 * contradictionCount)) / Math.max(1, visibleTraitCount)).toFixed(3)
      );

      const boundedScore = Math.max(0.01, Math.min(0.99, Number(score.toFixed(3))));

      return {
        vehicleId: fp.vehicleId,
        make: fp.make,
        model: fp.model,
        generation: fp.generation,
        displayName: fp.generation ? `${fp.make} ${fp.model} (${fp.generation})` : `${fp.make} ${fp.model}`,
        baseScore: neutralBaseline,
        calibratedScore: boundedScore,
        genericEvidenceCount,
        specificEvidenceCount,
        contradictionCount,
        visibleTraitCount,
        evidenceDensity,
        evaluations,
        supportingEvidence: supporting,
        contradictions,
        unobservableTraits: unobservable
      };
    });

    // 5. Sort candidates descending by calibrated score (tie-break on evidenceDensity)
    scoredCandidates.sort((a, b) => {
      if (b.calibratedScore !== a.calibratedScore) {
        return b.calibratedScore - a.calibratedScore;
      }
      return b.evidenceDensity - a.evidenceDensity;
    });

    const topCandidate = scoredCandidates[0] || null;
    const runnerUp = scoredCandidates[1] || null;
    const margin = topCandidate && runnerUp
      ? Number((topCandidate.calibratedScore - runnerUp.calibratedScore).toFixed(3))
      : (topCandidate ? topCandidate.calibratedScore : 0);

    // INVARIANT 5: RAW-VS-DISCRIMINATOR CONFLICT
    // A disagreement between raw provider identity and discriminator winner MUST trigger verification
    const rawMatchesTop = Boolean(
      fallbackModel && topCandidate &&
      (topCandidate.model.toLowerCase().includes(fallbackModel.toLowerCase()) ||
       fallbackModel.toLowerCase().includes(topCandidate.model.toLowerCase()))
    );
    const rawConflict = Boolean(fallbackModel && !rawMatchesTop && topCandidate);

    const evidenceGrounded = Boolean(topCandidate && topCandidate.specificEvidenceCount > 0);
    const needsVerification = Boolean(
      (margin < 0.15 && scoredCandidates.length >= 2) ||
      (topCandidate && topCandidate.contradictions.length > 0) ||
      rawConflict ||
      (topCandidate && topCandidate.specificEvidenceCount === 0 && scoredCandidates.length >= 2)
    );

    let reason = 'Fine-grained model discrimination completed.';
    if (topCandidate && runnerUp) {
      if (margin >= 0.15 && evidenceGrounded) {
        reason = `Selected ${topCandidate.displayName} over ${runnerUp.displayName} based on observable morphological evidence (margin: ${margin.toFixed(2)}).`;
      } else if (rawConflict) {
        reason = `Raw provider identity (${fallbackModel}) conflicts with discriminator winner (${topCandidate.displayName}). Verification recommended.`;
      } else if (margin < 0.15) {
        reason = `Close candidate contest between ${topCandidate.displayName} and ${runnerUp.displayName} (margin: ${margin.toFixed(2)}). Verification recommended.`;
      } else if (!evidenceGrounded) {
        reason = `Distinguishing morphological traits unobservable from ${viewpoint} viewpoint; abstaining from exact variant over-confidence.`;
      }
    }

    // Invariant: variant can ONLY be asserted if evidence is grounded with positive observable traits and a decisive margin
    const resolvedVariant = (evidenceGrounded && topCandidate && margin >= 0.15)
      ? (topCandidate.generation || topCandidate.model)
      : null;

    return {
      topCandidate,
      runnerUp,
      margin,
      needsVerification,
      rawConflict,
      visibilityMatrix,
      scoredCandidates,
      evidenceGrounded,
      reason,
      variant: resolvedVariant
    };
  }

  /**
   * INVARIANT 4: CONFUSABLE GRAPH INTEGRITY
   * Validates that every confusable edge A -> B has a registered target B and reciprocal B -> A.
   */
  public validateConfusableGraph(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const fp of MORPHOLOGICAL_FINGERPRINTS) {
      if (!fp.confusableWith) continue;
      for (const targetId of fp.confusableWith) {
        const targetFp = this.fingerprintCatalog.get(targetId.toLowerCase());
        if (!targetFp) {
          errors.push(`Orphaned confusable reference: "${fp.vehicleId}" (${fp.model}) references unknown vehicleId "${targetId}"`);
          continue;
        }
        if (targetFp.make.toLowerCase() !== fp.make.toLowerCase()) {
          errors.push(`Cross-make confusable edge forbidden: "${fp.vehicleId}" (${fp.make}) -> "${targetId}" (${targetFp.make})`);
        }
        const hasReciprocal = targetFp.confusableWith?.includes(fp.vehicleId);
        if (!hasReciprocal) {
          errors.push(`Missing reciprocal confusable edge: "${fp.vehicleId}" -> "${targetFp.vehicleId}", but "${targetFp.vehicleId}" does not list "${fp.vehicleId}"`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  private resolveFingerprintForCandidate(candidateName: string): ModelMorphologicalFingerprint | null {
    if (!candidateName) return null;
    const norm = candidateName.toLowerCase().trim();
    if (this.fingerprintCatalog.has(norm)) {
      return this.fingerprintCatalog.get(norm)!;
    }
    const cleanNorm = norm.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (this.fingerprintCatalog.has(cleanNorm)) {
      return this.fingerprintCatalog.get(cleanNorm)!;
    }

    for (const [key, fp] of this.fingerprintCatalog.entries()) {
      if (norm === fp.make.toLowerCase()) continue;
      if (norm.includes(key) || cleanNorm.includes(key)) {
        return fp;
      }
      if (key.includes(norm) && norm.length >= 4 && norm !== fp.make.toLowerCase()) {
        if (fp.model.toLowerCase().includes(norm) || norm.includes(fp.model.toLowerCase())) {
          return fp;
        }
      }
    }
    return null;
  }
}

export const fineGrainedModelDiscriminator = new FineGrainedModelDiscriminator();
