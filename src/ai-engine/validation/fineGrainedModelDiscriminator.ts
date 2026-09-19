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
  | 'side_intake_type'
  | 'roofline_greenhouse'
  | 'rear_architecture_and_exhaust'
  | 'door_architecture'
  | 'proportions'
  | 'aero_architecture';

export interface TraitDescriptor {
  name: string;
  positiveKeywords: string[];
  incompatibleKeywords: string[];
  isEngineMetadata?: boolean;
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
  visibilityMatrix: Record<MorphologicalCategory, TraitVisibilityState>;
  scoredCandidates: ScoredCandidateModel[];
  evidenceGrounded: boolean;
  reason: string;
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
        roofline_greenhouse: 'VISIBLE',
        proportions: 'PARTIAL',
        aero_architecture: 'PARTIAL',
        side_intake_type: 'NOT_VISIBLE',
        rear_architecture_and_exhaust: 'NOT_VISIBLE',
        door_architecture: 'NOT_VISIBLE'
      };
      break;

    case 'front_3q':
      matrix = {
        headlight_shape: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        front_intake_grille: frontOccluded ? 'OCCLUDED' : 'VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'PARTIAL',
        aero_architecture: 'VISIBLE',
        rear_architecture_and_exhaust: 'NOT_VISIBLE'
      };
      break;

    case 'side':
      matrix = {
        headlight_shape: frontOccluded ? 'OCCLUDED' : 'PARTIAL',
        front_intake_grille: frontOccluded ? 'OCCLUDED' : 'PARTIAL',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        aero_architecture: 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'PARTIAL'
      };
      break;

    case 'rear_3q':
      matrix = {
        headlight_shape: 'NOT_VISIBLE',
        front_intake_grille: 'NOT_VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'VISIBLE',
        side_intake_type: sideOccluded ? 'OCCLUDED' : 'VISIBLE',
        door_architecture: sideOccluded ? 'OCCLUDED' : 'PARTIAL',
        aero_architecture: 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'VISIBLE'
      };
      break;

    case 'rear':
      matrix = {
        headlight_shape: 'NOT_VISIBLE',
        front_intake_grille: 'NOT_VISIBLE',
        roofline_greenhouse: 'VISIBLE',
        proportions: 'PARTIAL',
        side_intake_type: 'NOT_VISIBLE',
        door_architecture: 'NOT_VISIBLE',
        aero_architecture: rearOccluded ? 'OCCLUDED' : 'VISIBLE',
        rear_architecture_and_exhaust: rearOccluded ? 'OCCLUDED' : 'VISIBLE'
      };
      break;

    case 'unknown':
    default:
      matrix = {
        headlight_shape: 'PARTIAL',
        front_intake_grille: 'PARTIAL',
        roofline_greenhouse: 'PARTIAL',
        proportions: 'PARTIAL',
        side_intake_type: 'PARTIAL',
        door_architecture: 'PARTIAL',
        aero_architecture: 'PARTIAL',
        rear_architecture_and_exhaust: 'PARTIAL'
      };
      break;
  }

  return matrix;
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
    confusableWith: ['granturismo', 'gran turismo'],
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
    confusableWith: ['mc20', 'mc 20'],
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
    confusableWith: ['570s', '675lt', '12c'],
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
    confusableWith: ['650s', '675lt'],
    traits: {
      headlight_shape: {
        name: 'teardrop_swept_cluster',
        positiveKeywords: ['teardrop headlight', 'swept cluster', 'elongated teardrop lens', 'integrated daytime blade', 'swept back lens'],
        incompatibleKeywords: ['p1 crescent', 'c-shape black housing', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'three_segment_aero_blade_bumper',
        positiveKeywords: ['three-segment', 'aero blade', 'tripartite front splitter', 'sports series bumper'],
        incompatibleKeywords: ['p1 front bumper', 'large concave oval', 'horizontal strakes']
      },
      side_intake_type: {
        name: 'dihedral_floating_tendon_intake',
        positiveKeywords: ['floating tendon', 'tendon duct', 'door channel', 'no open side scoop', 'smooth door tendon', 'floating door tendon', 'integrated door duct'],
        incompatibleKeywords: ['large open side scoop', 'radiator intake behind door', 'prominent open side scoop']
      },
      roofline_greenhouse: {
        name: 'flying_buttress_c_pillar',
        positiveKeywords: ['flying buttress', 'floating c-pillar', 'floating pillar', 'glass hatch', 'sports series roofline'],
        incompatibleKeywords: ['p11 roofline', 'wraparound visor canopy', 'long hood gt']
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
    confusableWith: ['650s', '570s'],
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

  // ── FERRARI DAYTONA SP3 ──
  {
    vehicleId: 'ferrari-daytona-sp3',
    make: 'Ferrari',
    model: 'Daytona SP3',
    generation: 'Icona',
    proportionsDescription: 'Icona hypercar with wraparound visor canopy, horizontal louvers/strakes, and fender-mounted mirrors',
    confusableWith: ['sf90', 'stradale', 'sp1', 'sp2', 'icona'],
    traits: {
      headlight_shape: {
        name: 'horizontal_eyelid_covers',
        positiveKeywords: ['eyelid', 'eyelid covers', 'partial covers', 'horizontal partial cover', 'slat headlights', 'retractable covers'],
        incompatibleKeywords: ['open c-shape matrix', 'c-clamp headlight', 'vertical slit', 'round bug eye']
      },
      front_intake_grille: {
        name: 'horizontal_strakes_slatted_grille',
        positiveKeywords: ['horizontal strakes', 'horizontal slats', 'strake grille', 'slatted front bumper', 'central grille with horizontal slats'],
        incompatibleKeywords: ['open mesh grille', 'vertical slats', 'kidney grille', 'singleframe']
      },
      side_intake_type: {
        name: 'door_top_sculpted_air_channel',
        positiveKeywords: ['sculpted waist', 'door top intake', 'door air duct', 'butterfly door intake box', 'waist channel'],
        incompatibleKeywords: ['triple fender gills only', 'floating tendon']
      },
      roofline_greenhouse: {
        name: 'wraparound_visor_canopy',
        positiveKeywords: ['wraparound visor', 'visor canopy', 'helmet canopy', 'targa visor', 'hidden a-pillar', 'curved glass windshield'],
        incompatibleKeywords: ['conventional pillars', 'standard coupe greenhouse', 'sedan roofline']
      },
      door_architecture: {
        name: 'butterfly_doors_with_intake_box',
        positiveKeywords: ['butterfly door', 'fender-mounted mirror', 'door tops mirror'],
        incompatibleKeywords: ['conventional door']
      },
      rear_architecture_and_exhaust: {
        name: 'full_width_horizontal_rear_strakes',
        positiveKeywords: ['horizontal rear strakes', 'rear strakes', 'horizontal slats rear', 'twin central high-exit rectangular exhaust', 'central rectangular exhaust'],
        incompatibleKeywords: ['round twin exhaust tips', 'quad outer tips', 'round taillights']
      },
      proportions: {
        name: 'mid_engine_icona_prototype',
        positiveKeywords: ['cab-forward', 'prototype sports car proportions', 'sculpted waist', 'low slung'],
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
    confusableWith: ['daytona', 'sp3', 'daytona sp3'],
    traits: {
      headlight_shape: {
        name: 'slender_c_clamp_matrix',
        positiveKeywords: ['c-shaped', 'c-clamp', 'slender matrix', 'horizontal slotted open headlight', 'slender c headlight'],
        incompatibleKeywords: ['horizontal eyelid covers', 'retractable slat cover', 'round bug eye', 'fried egg', 'teardrop', 'teardrop headlight']
      },
      front_intake_grille: {
        name: 'open_nose_wing_diffuser',
        positiveKeywords: ['open nose wing', 'front diffuser channel', 'low slung slotted intake', 'lower bumper splitter'],
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

  // ── PORSCHE 911 (996) ──
  {
    vehicleId: 'porsche-911-carrera-996',
    make: 'Porsche',
    model: '911 Carrera',
    generation: '996',
    proportionsDescription: 'Rear-engine sports car with distinctive integrated fried-egg teardrop headlights',
    confusableWith: ['997'],
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
        incompatibleKeywords: ['wraparound visor canopy', 'mid-engine cab forward', 'long hood gt']
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
    confusableWith: ['996'],
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
        incompatibleKeywords: ['wraparound visor canopy', 'mid-engine cab forward']
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
    confusableWith: ['jesko', 'regera', 'cc850', 'agera'],
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
    confusableWith: ['m4', 'g82', 'csl', 'm4 csl'],
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
    confusableWith: ['amg gt', 'gt s', 'gt r', 'gt c', 'c190', 'sls amg'],
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
      }
    });
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
    evidenceList: string[];
    candidates: { name: string; score?: number }[];
    fallbackMake?: string;
    fallbackModel?: string;
  }): FineGrainedDiscriminationResult {
    const { visualEvidence, viewpoint, evidenceList, candidates, fallbackMake, fallbackModel } = params;

    // 1. Build unified normalized evidence text
    const evidenceText = [
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
      ...evidenceList
    ].join(' ').toLowerCase();

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
      ...candidates.map((c) => c.name),
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
    // 1) A candidate or fallbackModel query matches one of peer.confusableWith, OR
    // 2) Any already added candidateFingerprint has confusableWith matching peer.model or peer.vehicleId
    if (targetMake) {
      const peers = this.findFingerprintsByMake(targetMake);
      for (const peer of peers) {
        if (seenIds.has(peer.vehicleId)) continue;

        const isConfusableWithQuery = peer.confusableWith?.some((term) =>
          candidateQueries.some((q) => matchesConfusable(q, term))
        );

        const isConfusableWithCandidates = candidateFingerprints.some((cf) =>
          cf.fp.confusableWith?.some((term) =>
            matchesConfusable(peer.model, term) || matchesConfusable(peer.vehicleId, term)
          )
        );

        if (isConfusableWithQuery || isConfusableWithCandidates) {
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
        visibilityMatrix,
        scoredCandidates: [],
        evidenceGrounded: false,
        reason: 'No morphological fingerprints catalogued for target manufacturer.'
      };
    }

    // 4. Score each candidate model against observable evidence
    const scoredCandidates: ScoredCandidateModel[] = candidateFingerprints.map(({ initialScore, fp }) => {
      let score = initialScore;
      const evaluations: TraitEvaluation[] = [];
      const supporting: string[] = [];
      const contradictions: string[] = [];
      const unobservable: string[] = [];

      // Evaluate each morphological category
      for (const [categoryKey, visibility] of Object.entries(visibilityMatrix) as [MorphologicalCategory, TraitVisibilityState][]) {
        const expectedTrait = fp.traits[categoryKey];
        if (!expectedTrait) continue;

        // INVARIANT 1 & 2: Trait is unobservable from this angle
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
        const weight = visibility === 'VISIBLE' ? 1.0 : 0.5;

        // Check for positive keyword match
        const matchesPositive = expectedTrait.positiveKeywords.some((kw) => evidenceText.includes(kw));

        // Check for explicit contradiction
        const matchesContradiction = expectedTrait.incompatibleKeywords.some((kw) => evidenceText.includes(kw));

        if (matchesPositive && !matchesContradiction) {
          // Positive support
          const delta = 0.25 * weight;
          score += delta;
          supporting.push(`Observed ${categoryKey.replace(/_/g, ' ')} matches ${fp.model} signature (${expectedTrait.name})`);
          evaluations.push({
            category: categoryKey,
            visibility,
            expectedTraitName: expectedTrait.name,
            matched: true,
            contradicted: false,
            scoreDelta: delta,
            reason: `Confirmed match with ${expectedTrait.name} (+${delta.toFixed(2)})`
          });
        } else if (matchesContradiction) {
          // Explicit contradiction observed in visible zone
          const delta = -0.35 * weight;
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
          // Feature zone is visible, but no definitive match or contradiction keywords found
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

      const boundedScore = Math.max(0.01, Math.min(0.99, Number(score.toFixed(3))));

      return {
        vehicleId: fp.vehicleId,
        make: fp.make,
        model: fp.model,
        generation: fp.generation,
        displayName: fp.generation ? `${fp.make} ${fp.model} (${fp.generation})` : `${fp.make} ${fp.model}`,
        baseScore: initialScore,
        calibratedScore: boundedScore,
        evaluations,
        supportingEvidence: supporting,
        contradictions,
        unobservableTraits: unobservable
      };
    });

    // 5. Sort candidates descending by calibrated score
    scoredCandidates.sort((a, b) => b.calibratedScore - a.calibratedScore);

    const topCandidate = scoredCandidates[0] || null;
    const runnerUp = scoredCandidates[1] || null;
    const margin = topCandidate && runnerUp
      ? Number((topCandidate.calibratedScore - runnerUp.calibratedScore).toFixed(3))
      : (topCandidate ? topCandidate.calibratedScore : 0);

    // INVARIANT 12: Grounding check — Ensure result is not derived solely from a generic manufacturer prior!
    const evidenceGrounded = Boolean(topCandidate && topCandidate.supportingEvidence.length > 0);
    const needsVerification = Boolean(
      (margin < 0.15 && scoredCandidates.length >= 2) ||
      (topCandidate && topCandidate.contradictions.length > 0)
    );

    let reason = 'Fine-grained model discrimination completed.';
    if (topCandidate && runnerUp) {
      if (margin >= 0.15 && evidenceGrounded) {
        reason = `Selected ${topCandidate.displayName} over ${runnerUp.displayName} based on observable morphological evidence (margin: ${margin.toFixed(2)}).`;
      } else if (margin < 0.15) {
        reason = `Close candidate contest between ${topCandidate.displayName} and ${runnerUp.displayName} (margin: ${margin.toFixed(2)}). Verification recommended.`;
      } else if (!evidenceGrounded) {
        reason = `Distinguishing morphological traits unobservable from ${viewpoint} viewpoint; abstaining from exact variant over-confidence.`;
      }
    }

    return {
      topCandidate,
      runnerUp,
      margin,
      needsVerification,
      visibilityMatrix,
      scoredCandidates,
      evidenceGrounded,
      reason
    };
  }

  private resolveFingerprintForCandidate(candidateName: string): ModelMorphologicalFingerprint | null {
    if (!candidateName) return null;
    const norm = candidateName.toLowerCase().trim();
    if (this.fingerprintCatalog.has(norm)) {
      return this.fingerprintCatalog.get(norm)!;
    }

    for (const [key, fp] of this.fingerprintCatalog.entries()) {
      if (norm === fp.make.toLowerCase()) continue;
      if (norm.includes(key)) {
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
