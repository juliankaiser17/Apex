/**
 * APEX — Production Hierarchical Vehicle Classifier & Contradiction Engine
 * 
 * Enforces hierarchical specificity: Make -> Model Family -> Generation -> Variant.
 * Eliminates catastrophic false positives (e.g. BMW M4 -> Ferrari Daytona SP3) via
 * strict architectural contradiction penalties, viewpoint visibility constraints,
 * and calibrated candidate separation.
 */

import type {
  CandidateComparison,
  HierarchicalIdentification,
  SpecificityLevel,
  ViewpointType,
  VisualEvidence
} from '../types';
import { fineGrainedModelDiscriminator } from './fineGrainedModelDiscriminator';
import { canonicalVehicleRegistry } from '../canonical/canonicalVehicleRegistry';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../../data/vehicleDatabase';

export interface HierarchicalClassificationInput {
  visual_evidence: VisualEvidence;
  viewpoint: ViewpointType;
  raw_make: string | null;
  raw_model: string | null;
  raw_generation: string | null;
  raw_variant: string | null;
  raw_candidates: CandidateComparison[];
  raw_confidence?: number;
  adversarial_result?: {
    verified: boolean;
    demote_to?: string | null;
    reason?: string;
  };
}

export interface HierarchicalClassificationResult {
  identification: HierarchicalIdentification;
  specificity_level: SpecificityLevel;
  specificity_level_numeric?: number;
  calibrated_candidates: CandidateComparison[];
  top_candidate: CandidateComparison | null;
  candidate_separation: number;
  contradictions: string[];
  reason: string;
  needs_adversarial_verification: boolean;
  needs_neutral_verification?: boolean;
  raw_conflict?: boolean;
  discriminator_identity?: string;
  canonical_vehicle_id?: string;
  canonical_display_name?: string;
  evidence_grounded?: boolean;
}

// Known architectural signatures for contradiction enforcement
export const ARCHITECTURAL_SIGNATURES: Record<
  string,
  {
    typical_body_styles: string[];
    proportions: string[];
    signature_grilles: string[];
    disallowed_features: string[];
  }
> = {
  bmw: {
    typical_body_styles: ['coupe', 'sedan', 'suv', 'wagon', 'convertible', 'hatchback'],
    proportions: ['front-engine', 'long-hood', 'short-deck', 'hofmeister'],
    signature_grilles: ['kidney', 'twin kidney', 'vertical kidney', 'horizontal kidney'],
    disallowed_features: ['wedge hypercar', 'mid-engine rear strakes', 'rear engine flat-six']
  },
  ferrari: {
    typical_body_styles: ['supercar', 'hypercar', 'coupe', 'convertible'],
    proportions: ['mid-engine', 'cab-forward', 'low-slung', 'wedge'],
    signature_grilles: ['shark nose', 'prancing horse', 'center intake', 'horizontal slats'],
    disallowed_features: ['twin kidney grille', 'tall vertical kidney', 'hofmeister kink', 'tall sedan', 'upright boxy suv']
  },
  porsche: {
    typical_body_styles: ['coupe', 'convertible', 'sedan', 'suv', 'wagon'],
    proportions: ['rear-engine', 'sloping flyline', 'bulbous front fenders', 'teardrop'],
    signature_grilles: ['lower bumper air intakes', 'no upper grille', 'tripartite intake'],
    disallowed_features: ['twin kidney grille', 'massive vertical grille', 'wedge angular doors']
  },
  lamborghini: {
    typical_body_styles: ['supercar', 'hypercar', 'suv'],
    proportions: ['extreme wedge', 'cab-forward', 'hexagonal', 'y-shape', 'angular'],
    signature_grilles: ['hexagonal lower intakes', 'sharp angular splitter'],
    disallowed_features: ['twin kidney grille', 'classic upright chrome grille', 'curved classic oval']
  },
  audi: {
    typical_body_styles: ['sedan', 'coupe', 'wagon', 'suv', 'sportback'],
    proportions: ['front-engine', 'quattro blisters', 'sleek modern'],
    signature_grilles: ['singleframe', 'hexagonal singleframe', 'honeycomb singleframe'],
    disallowed_features: ['twin kidney grille', 'rear-engine teardrop']
  },
  mercedes: {
    typical_body_styles: ['sedan', 'coupe', 'suv', 'wagon', 'convertible'],
    proportions: ['front-engine', 'prestige long-dash-to-axle'],
    signature_grilles: ['panamericana', 'slatted grille with star', 'diamond grille'],
    disallowed_features: ['twin kidney grille', 'extreme cab-forward wedge']
  },
  nissan: {
    typical_body_styles: ['coupe', 'sedan', 'suv', 'sports car'],
    proportions: ['front-engine', 'muscular haunches', 'quad circular taillights', 'coupe silhouette'],
    signature_grilles: ['v-motion', 'rectangular intercooler opening', 'gt-r dual tier grille'],
    disallowed_features: ['twin kidney grille', 'panamericana grille', 'mid-engine wedge', 'rear-engine flyline']
  },
  honda: {
    typical_body_styles: ['hatchback', 'sedan', 'coupe', 'sports car'],
    proportions: ['front-engine', 'compact front-wheel-drive/all-wheel-drive', 'fastback coupe'],
    signature_grilles: ['slim horizontal bar', 'h-emblem grille', 'mesh intake with red r badge'],
    disallowed_features: ['twin kidney grille', 'side strakes', 'rear-engine flat-six', 'active longtail airbrake']
  },
  toyota: {
    typical_body_styles: ['coupe', 'sedan', 'suv', 'hatchback'],
    proportions: ['front-engine', 'long-hood short-deck', 'double bubble roof', 'rear ducktail spoiler'],
    signature_grilles: ['tripartite lower mesh', 'prominent central nose cone', 'gr trapezoidal grille'],
    disallowed_features: ['twin kidney grille', 'quad round taillights', 'vertical swept-back headlights', 'extreme cab-forward wedge']
  },
  mclaren: {
    typical_body_styles: ['supercar', 'hypercar', 'coupe', 'spider', 'convertible'],
    proportions: ['mid-engine', 'cab-forward', 'tear-drop cockpit', 'dihedral doors'],
    signature_grilles: ['p1 crescent intakes', 'deep eye-socket intakes', 'high center dual exhaust exits'],
    disallowed_features: ['twin kidney grille', 'tall sedan', 'box-like upright grille', 'three-pointed star', 'quad round taillights']
  },
  maserati: {
    typical_body_styles: ['supercar', 'coupe', 'convertible', 'sedan', 'suv'],
    proportions: ['front-engine grand tourer or mid-engine monocoque', 'flowing organic curves', 'side fender triple portholes'],
    signature_grilles: ['concave oval grille with vertical slats and trident', 'wide low-mounted trident intake'],
    disallowed_features: ['twin kidney grille', 'extreme angular wedge', 'active longtail airbrake']
  },
  koenigsegg: {
    typical_body_styles: ['hypercar', 'megacar'],
    proportions: ['mid-engine', 'wraparound fighter-jet canopy', 'dihedral synchro-helix doors'],
    signature_grilles: ['wide low front oval intake'],
    disallowed_features: ['tall sedan', 'twin kidney grille']
  },
  aston_martin: {
    typical_body_styles: ['coupe', 'convertible'],
    proportions: ['front-engine', 'long-hood', 'short-deck', 'grand tourer proportions'],
    signature_grilles: ['traditional aston inverted trapezoid grille', 'horizontal mesh grille', 'carbon front splitter'],
    disallowed_features: ['twin kidney grille', 'panamericana grille', 'mid-engine wedge', 'rear-engine flat-six']
  },
  rolls_royce: {
    typical_body_styles: ['sedan', 'coupe', 'convertible', 'suv'],
    proportions: ['front-engine', 'monolithic formal upright greenhouse', 'coach doors'],
    signature_grilles: ['pantheon grille', 'upright polished chrome vertical slats', 'spirit of ecstasy'],
    disallowed_features: ['twin kidney grille', 'mid-engine wedge', 'active rear airbrake', 'carbon front splitter']
  },
  bentley: {
    typical_body_styles: ['coupe', 'convertible', 'sedan', 'suv'],
    proportions: ['front-engine', 'muscular rear haunches', 'grand tourer silhouette'],
    signature_grilles: ['large rectangular matrix mesh grille', 'dual twin round headlights'],
    disallowed_features: ['twin kidney grille', 'vertical slit headlights', 'extreme cab-forward wedge']
  }
};

export class HierarchicalClassifier {
  /**
   * Evaluates evidence against candidates, applies contradiction penalties,
   * determines candidate separation, and bounds specificity.
   */
  public classify(input: HierarchicalClassificationInput): HierarchicalClassificationResult {
    const { visual_evidence, viewpoint, raw_candidates, adversarial_result } = input;
    const globalContradictions: string[] = [];

    // 1. Normalize visual evidence for rapid cross-examination
    const evidenceText = [
      visual_evidence.body_style || '',
      visual_evidence.grille || '',
      visual_evidence.headlights || '',
      visual_evidence.taillights || '',
      visual_evidence.hood || '',
      visual_evidence.roofline || '',
      visual_evidence.windows || '',
      visual_evidence.wheels || '',
      visual_evidence.exhaust || '',
      visual_evidence.aero || '',
      visual_evidence.badges || '',
      visual_evidence.body_proportions || '',
      ...(visual_evidence.distinctive_details || [])
    ].join(' ').toLowerCase();

    // 1b. AMENDMENT 1: Corroborated Visual Manufacturer Evidence Detection
    // Raw make alone is NOT authoritative. Hard lock requires corroborated visual evidence
    // or high independent manufacturer confidence (>= 0.70).
    const brandVisualEvidence: Record<string, boolean> = {
      nissan: /\b(nissan|skyline|gt-?r|gtr|nismo|v-?spec|r32|r33|r34|r35|twin\s+round\s+tail|quad\s+round\s+tail|circular\s+tail)\b/i.test(evidenceText),
      honda: /\b(honda|integra|type-?r|vtec|dc2|dc5|nsx|civic|s2000)\b/i.test(evidenceText),
      toyota: /\b(toyota|supra|gr\s+supra|gazoo|2jz|a90|a80)\b/i.test(evidenceText),
      mclaren: /\b(mclaren|650s|675lt|720s|p11|p14|senna|p1|dihedral\s+doors?|longtail\s+airbrake)\b/i.test(evidenceText),
      maserati: /\b(maserati|trident|mc20|grancabrio|granturismo|nettuno|triple\s+portholes?)\b/i.test(evidenceText),
      porsche: /\b(porsche|911|carrera|boxster|cayman|718|gt3|gt2|sloping\s+flyline|teardrop\s+roofline|bulbous\s+front\s+fenders?|rear-engine)\b/i.test(evidenceText),
      ferrari: /\b(ferrari|prancing\s+horse|458|488|f8|sf90|daytona\s+sp3|icona|mustache\s+aero)\b/i.test(evidenceText),
      lamborghini: /\b(lamborghini|hurac[aá]n|gallardo|aventador|revuelto|bull\s+emblem|y-shaped\s+drl|hexagonal\s+intakes?)\b/i.test(evidenceText),
      bmw: /\b(kidney|hofmeister|bmw|m3|m4|m5|m8)\b/i.test(evidenceText),
      mercedes: /\b(panamericana|three-pointed\s+star|mercedes(?:-benz)?|amg\s+grille|maybach|vertical\s+chrome\s+(?:pinstripe\s+)?grille|s-class|s\s*class)\b/i.test(evidenceText),
      audi: /\b(singleframe|quattro|audi)\b/i.test(evidenceText),
      aston_martin: /\b(aston\s+martin|dbs|db9|db7|db11|db12|vantage|vanquish|valkyrie|swan\s+doors?|aeroblade|curlicue)\b/i.test(evidenceText),
      rolls_royce: /\b(rolls[- ]royce|phantom|ghost|cullinan|wraith|spirit\s+of\s+ecstasy|pantheon)\b/i.test(evidenceText),
      bentley: /\b(bentley|continental\s+gt|flying\s+spur|bentayga|flying\s+b|matrix\s+grille)\b/i.test(evidenceText)
    };

    const normalizeBrandKey = (make: string): string => {
      const m = (make || '').toLowerCase().trim();
      if (m.includes('mercedes')) return 'mercedes';
      if (m.includes('aston')) return 'aston_martin';
      if (m.includes('rolls')) return 'rolls_royce';
      if (m.includes('bentley')) return 'bentley';
      return m;
    };

    const visuallyCorroboratedMakes = Object.entries(brandVisualEvidence)
      .filter(([_, hasCues]) => hasCues)
      .map(([make]) => make);

    const rawMakeNorm = normalizeBrandKey(input.raw_make || '');

    // Permit manufacturer locking only for manufacturers this engine actually models.
    const KNOWN_MANUFACTURERS = new Set(Object.keys(brandVisualEvidence));

    // Determine if manufacturer is locked
    let lockedManufacturer: string | null = null;
    if (visuallyCorroboratedMakes.length === 1) {
      // Direct corroborated visual evidence overrides or confirms raw_make
      lockedManufacturer = visuallyCorroboratedMakes[0];
    } else if (visuallyCorroboratedMakes.length > 1) {
      if (visuallyCorroboratedMakes.includes(rawMakeNorm)) {
        lockedManufacturer = rawMakeNorm;
      } else {
        // Visual cues for multiple brands without raw_make match: keep candidate set open
        lockedManufacturer = null;
      }
    } else {
      // Fall back to normalized raw provider make if recognized
      if (rawMakeNorm && KNOWN_MANUFACTURERS.has(rawMakeNorm)) {
        lockedManufacturer = rawMakeNorm;
      }
    }

    // ── SERVICE / LIVERY SCENE DETECTION (hoisted: also governs candidate generation) ──
    // A commercial service vehicle (taxi, hire car, transit) is a fundamentally different class
    // from a privately owned passenger/sports car. Detecting it here lets the engine abstain
    // instead of confidently naming an unrelated car whose generic tokens happened to match.
    const sceneStructuredClass = (visual_evidence as any)?.vehicle_classification;
    const isServiceLiveryScene = sceneStructuredClass === 'taxi_livery'
      || /\b(taxi|urban\s+taxi|crown\s+comfort|cab\s+livery|for\s+hire|medallion|roof\s+sign|taxi\s+(roof\s+)?light|public\s+transit|transit\s+bus|shuttle|tram)\b/i.test(evidenceText);

    // A candidate may only survive a commercial-livery scene if it is itself a documented
    // service/livery vehicle record.
    const isDocumentedServiceVehicle = (nameLower: string): boolean =>
      /\b(taxi|crown\s+comfort|comfort|transit|shuttle|bus|van|hire|ambulance|police|limousine)\b/i.test(nameLower);

    // 2. Score and calibrate each candidate using the Contradiction Engine
    const calibratedCandidates: CandidateComparison[] = raw_candidates.map((candidate) => {
      let score = Math.max(0.1, Math.min(0.99, candidate.score || 0.5));
      const candNameLower = candidate.name.toLowerCase();
      const candSupporting: string[] = [...(candidate.supporting_evidence || [])];
      const candContradictions: string[] = [...(candidate.contradictions || [])];
      const candUnobservable: string[] = [...(candidate.unobservable_features || [])];

      // Detect candidate manufacturer
      let candidateMake = '';
      if (candNameLower.includes('bmw')) candidateMake = 'bmw';
      else if (candNameLower.includes('ferrari')) candidateMake = 'ferrari';
      else if (candNameLower.includes('porsche')) candidateMake = 'porsche';
      else if (candNameLower.includes('lamborghini')) candidateMake = 'lamborghini';
      else if (candNameLower.includes('audi')) candidateMake = 'audi';
      else if (candNameLower.includes('mercedes') || candNameLower.includes('amg')) candidateMake = 'mercedes';
      else if (candNameLower.includes('toyota')) candidateMake = 'toyota';
      else if (candNameLower.includes('mclaren')) candidateMake = 'mclaren';
      else if (candNameLower.includes('ford')) candidateMake = 'ford';
      else if (candNameLower.includes('honda')) candidateMake = 'honda';
      else if (candNameLower.includes('nissan')) candidateMake = 'nissan';
      else if (candNameLower.includes('maserati')) candidateMake = 'maserati';
      else if (candNameLower.includes('koenigsegg')) candidateMake = 'koenigsegg';
      else if (candNameLower.includes('aston')) candidateMake = 'aston_martin';
      else if (candNameLower.includes('rolls')) candidateMake = 'rolls_royce';
      else if (candNameLower.includes('bentley')) candidateMake = 'bentley';

      // ── CONTRADICTION ENGINE RULE 0: BUS / COMMERCIAL FLEET ELIMINATION ──
      const structuredClass = (visual_evidence as any)?.vehicle_classification;
      const isStructuredBus = structuredClass === 'commercial_bus' || structuredClass === 'commercial_truck';
      const isWordBoundaryBus = 
        /\bbus(es)?\b/i.test(evidenceText) || 
        /\b(public\s+transit|transit\s+bus|metro\s+bus|city\s+bus)\b/i.test(evidenceText) || 
        /\bcoach(?!built|line)\b/i.test(evidenceText) || 
        /\b(semi-truck|heavy\s+truck|lorry)\b/i.test(evidenceText) ||
        /\bbus\b/i.test((visual_evidence.body_style || '').toLowerCase());

      const isBusOrHeavyVehicle = isStructuredBus || isWordBoundaryBus;
      if (isBusOrHeavyVehicle) {
        candContradictions.push(
          `Severe vehicle-type mismatch: Observed subject is public transit/bus, which completely contradicts automobile candidate ${candidate.name}`
        );
        if (!globalContradictions.includes('Observed subject is public transit/heavy vehicle, not a consumer automobile.')) {
          globalContradictions.push('Observed subject is public transit/heavy vehicle, not a consumer automobile.');
        }
        return {
          name: candidate.name,
          score: 0.0,
          supporting_evidence: candSupporting,
          contradictions: candContradictions,
          unobservable_features: candUnobservable,
          invalid: true
        };
      }

      // ── CONTRADICTION ENGINE RULE 0B: COMMERCIAL SERVICE / LIVERY CONTRADICTION ──
      // Only a documented service/livery vehicle may be returned for a service/livery subject.
      const isExoticSupercar = candNameLower.includes('hurac') || candNameLower.includes('lamborghini') || candNameLower.includes('ferrari') || candNameLower.includes('mclaren') || candNameLower.includes('chiron') || candNameLower.includes('bugatti');
      if (isServiceLiveryScene && !isDocumentedServiceVehicle(candNameLower)) {
        candContradictions.push(
          isExoticSupercar
            ? `Severe vehicle-type mismatch: Observed subject has commercial taxi livery/architecture, which contradicts exotic sports car candidate ${candidate.name}`
            : `Severe vehicle-type mismatch: Observed subject is a commercial service/livery vehicle, which contradicts private passenger car candidate ${candidate.name}`
        );
        // The scene-level summary is only recorded when an exotic candidate had to be rejected;
        // for a legitimate service-vehicle winner it would otherwise leak into the winner's
        // user-facing contradictions.
        if (isExoticSupercar && !globalContradictions.includes('Observed subject displays commercial taxi livery/features.')) {
          globalContradictions.push('Observed subject displays commercial taxi livery/features.');
        }
        return {
          name: candidate.name,
          score: 0.0,
          supporting_evidence: candSupporting,
          contradictions: candContradictions,
          unobservable_features: candUnobservable,
          invalid: true
        };
      }

      // ── AMENDMENT 2: HARD MANUFACTURER MISMATCH EXCLUSION STATE ──
      // If manufacturer is corroborated, any candidate with a contradictory make is excluded from model ranking
      if (lockedManufacturer && candidateMake && candidateMake !== lockedManufacturer) {
        candContradictions.push(
          `Hard manufacturer mismatch: Candidate brand ${candidateMake} contradicts corroborated manufacturer ${lockedManufacturer}`
        );
        return {
          name: candidate.name,
          score: 0.0,
          supporting_evidence: candSupporting,
          contradictions: candContradictions,
          unobservable_features: candUnobservable,
          invalid: true
        };
      }

      // ── CONTRADICTION ENGINE RULE B: BODY STYLE CONTRADICTION ──
      const observedBody = (visual_evidence.body_style || '').toLowerCase();
      if (observedBody) {
        if (observedBody.includes('coupe') && candNameLower.includes('suv')) {
          candContradictions.push(`Body style mismatch: Observed coupe vs candidate SUV`);
          score -= 0.60;
        } else if (observedBody.includes('suv') && (candNameLower.includes('coupe') || candNameLower.includes('gt3'))) {
          candContradictions.push(`Body style mismatch: Observed SUV vs candidate sports coupe`);
          score -= 0.60;
        } else if (observedBody.includes('sedan') && candNameLower.includes('spyder')) {
          candContradictions.push(`Body style mismatch: Observed sedan vs candidate open-top spyder`);
          score -= 0.60;
        } else if ((observedBody.includes('convertible') || observedBody.includes('spider') || observedBody.includes('cabriolet') || observedBody.includes('roadster')) &&
                   !/\b(spider|spyder|cabriolet|convertible|roadster|targa|speedster)\b/i.test(candNameLower)) {
          const hasOpenTopPeer = raw_candidates.some(c => /\b(spider|spyder|cabriolet|convertible|roadster|targa|speedster)\b/i.test(c.name.toLowerCase()));
          if (hasOpenTopPeer) {
            candContradictions.push(`Body style mismatch: Observed convertible/open-top architecture vs candidate fixed coupe`);
            score -= 0.60;
          }
        }
      }

      // ── CONTRADICTION ENGINE RULE C: UNOBSERVABLE VIEWPOINT RESTRICTIONS ──
      if (viewpoint === 'front' || viewpoint === 'front_3q') {
        if (candNameLower.includes('csl') && !evidenceText.includes('csl') && !evidenceText.includes('red grille') && !evidenceText.includes('yellow drl')) {
          candUnobservable.push('CSL-specific ducktail spoiler and laser taillights are unobservable from front viewpoint');
          score -= 0.20;
        }
        if (candNameLower.includes('gt3')) {
          const hasFrontGt3Proof = evidenceText.includes('gt3') || evidenceText.includes('drs') || evidenceText.includes('hood nostril') || evidenceText.includes('fender vent');
          if (!hasFrontGt3Proof) {
            candUnobservable.push('GT3 high-mounted rear wing is unobservable from front viewpoint and front fascia lacks GT3 air extractor');
            score -= 0.25;
          }
        }
      }

      if (viewpoint === 'rear' || viewpoint === 'rear_3q') {
        if (candNameLower.includes('sto') && !evidenceText.includes('sto') && !evidenceText.includes('swan-neck') && !evidenceText.includes('snorkel')) {
          candContradictions.push('Huracán STO requires prominent roof air scoop/snorkel and giant swan-neck wing, absent from observed rear');
          score -= 0.60;
        }
      }

      // ── CONTRADICTION ENGINE RULE D: SPECIFIC VARIANT EVIDENCE CHECK ──
      const isUltraVariant = candNameLower.includes('csl') || 
                             candNameLower.includes('gt3 rs') || 
                             candNameLower.includes('svj') || 
                             candNameLower.includes('sto') ||
                             candNameLower.includes('black series');

      if (isUltraVariant) {
        const hasSpecificVariantCue = 
          evidenceText.includes('csl') ||
          evidenceText.includes('weissach') ||
          evidenceText.includes('svj') ||
          evidenceText.includes('drs') ||
          evidenceText.includes('yellow drl') ||
          evidenceText.includes('red contour') ||
          evidenceText.includes('carbon ducktail');

        if (!hasSpecificVariantCue) {
          candUnobservable.push(`Mandatory distinguishing aero/trim features for ${candidate.name} are not confirmed in visible evidence`);
          score -= 0.25;
        }
      }

      // ── CONTRADICTION ENGINE RULE E: FERRARI MODEL-FAMILY DISAMBIGUATION ──
      const hasNegativeStrakes = /\b(?:without|no|lacks?|devoid\s+of)\s+(?:horizontal\s+)?strakes?\b/i.test(evidenceText);
      // NOTE: a bare "strakes"/"eyelids" mention is a GENERIC body feature (e.g. engine-cover
      // louvers) and must not act as model-specific Daytona evidence. Only the qualified
      // architectural phrases count.
      const hasDaytonaIconaCues = !hasNegativeStrakes &&
        /\b(horizontal\s+strakes?|horizontal\s+slats?|headlight\s+eyelids?|eyelid\s+covers?|partial\s+covers?|wraparound\s+visor|visor\s+canopy|fender-mounted\s+mirrors?|door\s+tops?\s+mirrors?|icona)\b/i.test(evidenceText);

      const hasSf90Cues = /\b(sf90|shut-?off\s+gurney|c-shaped\s+(?:horizontal\s+)?(?:matrix\s+)?(?:led\s+)?headlights?|matrix\s+led|hybrid\s+supercar)\b/i.test(evidenceText) || hasNegativeStrakes;

      if (hasDaytonaIconaCues) {
        if (candNameLower.includes('daytona') || candNameLower.includes('sp3')) {
          candSupporting.push('Observed horizontal strakes, headlight eyelids, and wraparound visor canopy uniquely match Ferrari Daytona SP3 Icona design');
          score += 0.25;
        } else if (candidateMake === 'ferrari' && (candNameLower.includes('sf90') || candNameLower.includes('296') || candNameLower.includes('f8') || candNameLower.includes('roma') || candNameLower.includes('portofino') || candNameLower.includes('488') || candNameLower.includes('458'))) {
          candContradictions.push(`Observed horizontal strakes, headlight eyelids, and wraparound canopy contradict ${candidate.name} architecture`);
          score -= 0.45;
        }
      }

      if (hasSf90Cues) {
        if (candNameLower.includes('sf90')) {
          candSupporting.push('Observed C-shaped matrix LED headlights or shut-off Gurney match Ferrari SF90 Stradale architecture');
          score += 0.25;
        } else if (candNameLower.includes('daytona') || candNameLower.includes('sp3')) {
          candContradictions.push('Observed C-shaped matrix LED headlights, lack of horizontal strakes, or shut-off Gurney contradict Ferrari Daytona SP3');
          score -= 0.50;
        }
      }

      const has458Cues = 
        /\b(triple\s+(?:central\s+)?exhaust|three\s+(?:central\s+)?exhaust|mustache\s+aero|deformable\s+winglets|vertical\s+swept-?back\s+headlights?|flying\s+buttress(?:es)?)\b/i.test(evidenceText);

      if (has458Cues) {
        if (candNameLower.includes('458')) {
          candSupporting.push('Observed vertical swept-back headlights, deformable mustache aero, or triple central exhaust match Ferrari 458 architecture');
          score += 0.25;
        } else if (candidateMake === 'ferrari' && (candNameLower.includes('daytona') || candNameLower.includes('sp3'))) {
          candContradictions.push(`Observed vertical swept-back headlights or triple central exhaust contradict Ferrari Daytona SP3 horizontal strake architecture`);
          score -= 0.50;
        }
      }

      // ── CONTRADICTION ENGINE RULE F: MCLAREN 650S vs 675LT vs 720S DISAMBIGUATION ──
      const has720sCues = /\b(eye-?socket|deep-?set\s+(?:head)?lights?|double-?skinned|p14)\b/i.test(evidenceText);
      // A bare "strakes" mention (e.g. an engine-cover louver) must never corroborate McLaren P11.
      const hasP11CrescentCues = /\b(crescent|p1-?(?:style|inspired)|c-shape(?:d)?|side\s+(?:radiator\s+)?(?:intake|scoop)|p11)\b/i.test(evidenceText);
      const has675ltCues = /\b(675lt|active\s+longtail|longtail\s+airbrake|longtail|dual\s+high-?exit|titanium\s+circular\s+exhaust|circular\s+titanium|front\s+fender\s+louvers?|carbon\s+endplates?|extended\s+carbon)\b/i.test(evidenceText);

      if (hasP11CrescentCues) {
        if (candNameLower.includes('650s') || (candNameLower.includes('675lt') && !has720sCues)) {
          candSupporting.push('Observed P1-style crescent headlights and side intake scoops match McLaren P11 architecture');
          score += 0.25;
        } else if (candNameLower.includes('720s') || candNameLower.includes('p14')) {
          candContradictions.push('Observed P1-style crescent headlights and side intake scoops contradict McLaren 720S eye-socket architecture');
          score -= 0.50;
        }
      }
      if (has720sCues) {
        if (candNameLower.includes('720s') || candNameLower.includes('p14')) {
          candSupporting.push('Observed eye-socket headlights and double-skinned aero doors match McLaren 720S architecture');
          score += 0.25;
        } else if (candNameLower.includes('650s') || candNameLower.includes('675lt')) {
          candContradictions.push('Observed eye-socket headlights and smooth double-skinned doors contradict McLaren P11 architecture');
          score -= 0.50;
        }
      }
      if (has675ltCues) {
        if (candNameLower.includes('675lt')) {
          candSupporting.push('Observed active Longtail airbrake, high-exit titanium exhausts, or carbon aero match 675LT');
          score += 0.25;
        } else if (candNameLower.includes('650s') || candNameLower.includes('720s')) {
          candContradictions.push(`Observed active Longtail airbrake or circular titanium exhausts contradict ${candidate.name} architecture`);
          score -= 0.50;
        }
      }

      // ── CONTRADICTION ENGINE RULE G: LAMBORGHINI HURACÁN vs GALLARDO DISAMBIGUATION ──
      const hasHuracanCues = /\b(hexagonal\s+intakes?|y-shaped\s+drl|angled\s+slatted|hurac[aá]n|lp610)\b/i.test(evidenceText);
      const hasGallardoCues = /\b(rectangular\s+front\s+intakes?|vertical\s+rectangular\s+headlights?|flat\s+horizontal\s+taillights?|gallardo)\b/i.test(evidenceText);

      if (hasHuracanCues) {
        if (candNameLower.includes('hurac') || candNameLower.includes('huracan')) {
          candSupporting.push('Observed hexagonal lower intakes and Y-shaped DRLs match Lamborghini Huracán architecture');
          score += 0.25;
        } else if (candNameLower.includes('gallardo')) {
          candContradictions.push('Observed hexagonal lower intakes and Y-shaped DRLs contradict Gallardo rectangular intake architecture');
          score -= 0.50;
        }
      }
      if (hasGallardoCues) {
        if (candNameLower.includes('gallardo')) {
          candSupporting.push('Observed rectangular front intakes and vertical headlights match Lamborghini Gallardo architecture');
          score += 0.25;
        } else if (candNameLower.includes('hurac') || candNameLower.includes('huracan')) {
          candContradictions.push('Observed rectangular front intakes and vertical headlights contradict Huracán hexagonal architecture');
          score -= 0.50;
        }
      }

      // ── CONTRADICTION ENGINE RULE H: MASERATI MC20 vs GRANCABRIO / GRANTURISMO ──
      const hasMc20Cues = /\b(butterfly\s+doors?|mid-engine\s+monocoque|nettuno|rear\s+engine\s+trident\s+vents?)\b/i.test(evidenceText);
      const hasGtCabrioCues = /\b(front-engine|long\s+hood|soft\s+top|fabric\s+roof|oval\s+concave\s+slatted\s+grille|triple\s+portholes?)\b/i.test(evidenceText);

      if (hasGtCabrioCues) {
        if (candNameLower.includes('grancabrio') || candNameLower.includes('granturismo')) {
          candSupporting.push('Observed front-engine GT proportions, oval slatted grille, or soft top match GranTurismo/GranCabrio architecture');
          score += 0.25;
        } else if (candNameLower.includes('mc20')) {
          candContradictions.push('Observed front-engine GT proportions, oval slatted grille, or soft top contradict MC20 mid-engine monocoque architecture');
          score -= 0.50;
        }
      }
      if (hasMc20Cues) {
        if (candNameLower.includes('mc20')) {
          candSupporting.push('Observed mid-engine monocoque and butterfly doors match Maserati MC20 architecture');
          score += 0.25;
        } else if (candNameLower.includes('grancabrio') || candNameLower.includes('granturismo')) {
          candContradictions.push('Observed mid-engine monocoque and butterfly doors contradict front-engine GranTurismo/GranCabrio architecture');
          score -= 0.50;
        }
      }

      // ── CONTRADICTION ENGINE RULE I: PORSCHE 911 CABRIOLET vs 718 BOXSTER ──
      const has911Cues = /\b(rear-engine|sloping\s+flyline|911\s+oval|carrera)\b/i.test(evidenceText);
      const has718BoxsterCues = /\b(mid-engine\s+side\s+(?:air\s+)?intakes?|horizontal\s+front\s+led|roadster\s+proportions?|718\s+boxster)\b/i.test(evidenceText);

      if (has911Cues && candNameLower.includes('boxster')) {
        candContradictions.push('Observed rear-engine sloping flyline and 911 oval headlights contradict 718 mid-engine roadster architecture');
        score -= 0.50;
      }
      if (has718BoxsterCues && candNameLower.includes('911')) {
        candContradictions.push('Observed mid-engine side air intakes contradict 911 rear-engine architecture');
        score -= 0.50;
      }

      // ── CONTRADICTION ENGINE RULE J: NISSAN SKYLINE GT-R vs HONDA INTEGRA ──
      const hasSkylineGtrCues = /\b(quad\s+round\s+tail|twin\s+round\s+tail|circular\s+tail|skyline|gt-?r|r34|r32|r33)\b/i.test(evidenceText);
      if (hasSkylineGtrCues && candidateMake === 'honda') {
        candContradictions.push('Hard manufacturer mismatch: Observed Nissan Skyline GT-R quad round taillights and architecture contradict Honda Integra');
        return {
          name: candidate.name,
          score: 0.0,
          supporting_evidence: candSupporting,
          contradictions: candContradictions,
          unobservable_features: candUnobservable,
          invalid: true
        };
      }

      const boundedScore = Math.max(0.01, Math.min(0.99, Number(score.toFixed(3))));

      return {
        name: candidate.name,
        score: boundedScore,
        supporting_evidence: candSupporting,
        contradictions: candContradictions,
        unobservable_features: candUnobservable,
        invalid: false
      };
    });

    // 2b. Generalized Fine-Grained Model Discrimination
    const fgResult = fineGrainedModelDiscriminator.discriminate({
      visualEvidence: visual_evidence,
      viewpoint,
      evidenceList: [
        ...(visual_evidence.distinctive_details || []),
        visual_evidence.headlights || '',
        visual_evidence.grille || '',
        visual_evidence.roofline || '',
        visual_evidence.aero || '',
        visual_evidence.exhaust || ''
      ].filter(Boolean),
      candidates: calibratedCandidates.filter((c) => !c.invalid).map((c) => ({ name: c.name, score: c.score })),
      fallbackMake: (lockedManufacturer === 'mercedes' ? 'Mercedes-Benz' : lockedManufacturer === 'aston_martin' ? 'Aston Martin' : lockedManufacturer === 'rolls_royce' ? 'Rolls-Royce' : lockedManufacturer) || input.raw_make || undefined,
      fallbackModel: input.raw_model || undefined
    });

    if (fgResult.scoredCandidates.length > 0) {
      for (const fgCand of fgResult.scoredCandidates) {
        const fgMakeNorm = normalizeBrandKey(fgCand.make);
        if (lockedManufacturer && fgMakeNorm !== lockedManufacturer) {
          continue; // Exclude candidates outside locked manufacturer
        }

        // A commercial service/livery subject must never be resolved to a private passenger car
        // that the discriminator fabricated by peer expansion — such a candidate carries no
        // supporting observation of its own, and naming it would be a confident guess.
        if (isServiceLiveryScene && !isDocumentedServiceVehicle(fgCand.displayName.toLowerCase())) {
          continue;
        }
        const existingIdx = calibratedCandidates.findIndex((c) => {
          const cNameLower = c.name.toLowerCase();
          const fgDisplayLower = fgCand.displayName.toLowerCase();
          const fgMakeModel = `${fgCand.make} ${fgCand.model}`.toLowerCase();
          const fgModelLower = fgCand.model.toLowerCase();

          if (cNameLower === fgDisplayLower || cNameLower === fgMakeModel) {
            return true;
          }

          // Strict body style gating: A convertible/spider must never match a fixed-roof coupe candidate!
          const isCSpider = /\b(spider|spyder|cabriolet|convertible|targa|roadster)\b/i.test(cNameLower);
          const isFgSpider = /\b(spider|spyder|cabriolet|convertible|targa|roadster)\b/i.test(fgDisplayLower) || /\b(spider|spyder|cabriolet|convertible|targa|roadster)\b/i.test(fgModelLower);
          if (isCSpider !== isFgSpider) {
            return false;
          }

          const cleanC = cNameLower.replace(/\s*\([^)]*\)/g, '').trim();
          const cleanFg = fgDisplayLower.replace(/\s*\([^)]*\)/g, '').trim();
          if (cleanC === cleanFg || cleanC === fgMakeModel || cleanC === fgModelLower) {
            return true;
          }

          return cNameLower.includes(fgModelLower);
        });

        if (existingIdx >= 0) {
          const existing = calibratedCandidates[existingIdx];
          existing.score = fgCand.calibratedScore;
          if (!existing.supporting_evidence) existing.supporting_evidence = [];
          if (!existing.contradictions) existing.contradictions = [];
          if (!existing.unobservable_features) existing.unobservable_features = [];
          fgCand.supportingEvidence.forEach((s) => {
            if (!existing.supporting_evidence.includes(s)) existing.supporting_evidence.push(s);
          });
          fgCand.contradictions.forEach((c) => {
            if (!existing.contradictions.includes(c)) existing.contradictions.push(c);
          });
          fgCand.unobservableTraits.forEach((u) => {
            if (!existing.unobservable_features!.includes(u)) existing.unobservable_features!.push(u);
          });
        } else {
          calibratedCandidates.push({
            name: fgCand.displayName,
            score: fgCand.calibratedScore,
            supporting_evidence: fgCand.supportingEvidence,
            contradictions: fgCand.contradictions,
            unobservable_features: fgCand.unobservableTraits,
            invalid: false
          });
        }
      }
    }

    // ── RAW-PROVIDER HYPOTHESIS DISCIPLINE (ARCHITECTURAL INVARIANT) ──
    // The raw provider identity is a HYPOTHESIS, never an authority:
    //     RAW PROVIDER        -> hypothesis only
    //     DISCRIMINATOR       -> final model decision
    //     WINNER -> registry -> verified specs -> API -> card
    // A candidate the discriminator could not evaluate at all (no morphological fingerprint)
    // carries no observable model-specific evidence, so it MUST NOT outrank a winner the
    // discriminator did establish from evidence. Without this, a confident raw guess that has no
    // fingerprint silently overwrites an evidence-grounded winner downstream.
    const evidenceScopeMake = lockedManufacturer || input.raw_make || undefined;

    const isEvidenceCoveredCandidate = (candidateName: string): boolean => {
      const canon = canonicalVehicleRegistry.lookupByTextOrAlias(candidateName, evidenceScopeMake);
      if (!canon) return false;
      if (fgResult.scoredCandidates.some((c) => c.vehicleId === canon.vehicleId)) return true;
      return Boolean(fineGrainedModelDiscriminator.getFingerprint(canon.vehicleId));
    };

    const fgWinner = fgResult.topCandidate;
    const fgHasGroundedWinner = Boolean(
      fgWinner &&
      fgWinner.specificEvidenceCount > 0 &&
      fgWinner.specificEvidenceCount - fgWinner.contradictionCount > 0
    );
    const rawHypothesisDemoted = new Set<string>();

    if (fgHasGroundedWinner && fgWinner) {
      const ceiling = Math.max(0.05, Number((fgWinner.calibratedScore - 0.05).toFixed(3)));
      for (const cand of calibratedCandidates) {
        if (cand.invalid) continue;
        if (isEvidenceCoveredCandidate(cand.name)) continue;
        // Demoted to an unevaluated hypothesis: it can no longer win on provider confidence alone.
        cand.score = Math.min(cand.score, ceiling);
        rawHypothesisDemoted.add(cand.name);
      }
    }

    // 3. Extract initial resolved make
    let resolvedMake = lockedManufacturer
      ? (lockedManufacturer === 'mercedes' ? 'Mercedes-Benz'
        : lockedManufacturer === 'bmw' ? 'BMW'
        : lockedManufacturer === 'aston_martin' ? 'Aston Martin'
        : lockedManufacturer === 'rolls_royce' ? 'Rolls-Royce'
        : lockedManufacturer === 'bentley' ? 'Bentley'
        : lockedManufacturer.charAt(0).toUpperCase() + lockedManufacturer.slice(1))
      : input.raw_make;

    // INVARIANT 2: CANDIDATE COMPLETENESS GATE
    // A model cannot become final unless:
    // - canonical registry entry exists
    // - database entry exists
    // - morphological fingerprint exists
    // - manufacturer namespace matches
    // INVARIANT 3: NO-REGISTRY FALLTHROUGH
    // If the raw provider returns a model absent from the registry/fingerprints,
    // prioritize registered evidence-grounded models rather than unverified candidates.
    const isCompleteCandidate = (cand: CandidateComparison): boolean => {
      const canon = canonicalVehicleRegistry.lookupByTextOrAlias(cand.name, resolvedMake || undefined);
      if (!canon) return false;
      if (resolvedMake && canon.make.toLowerCase() !== resolvedMake.toLowerCase()) return false;
      const fp = fineGrainedModelDiscriminator.getFingerprint(canon.vehicleId) ||
                 fineGrainedModelDiscriminator.getFingerprint(canon.displayName || cand.name);
      if (!fp) return false;
      const inDb = APEX_LOCAL_VEHICLE_DATABASE.some((v) => v.id === canon.vehicleId);
      return inDb;
    };

    const completeCandidates = calibratedCandidates.filter((c) => !c.invalid && isCompleteCandidate(c));
    const incompleteCandidates = calibratedCandidates.filter((c) => !c.invalid && !isCompleteCandidate(c));

    completeCandidates.sort((a, b) => b.score - a.score);
    incompleteCandidates.sort((a, b) => b.score - a.score);

    // Prioritize candidates passing the completeness gate
    // A complete candidate with severe contradictions (score < 0.50) cannot override an uncontradicted viable candidate
    const viableCompleteCandidates = completeCandidates.filter(
      (c) => c.score >= 0.50 && !c.contradictions.some((ct) => ct.includes('Severe') || ct.includes('contradicts'))
    );
    let validCandidates = viableCompleteCandidates.length > 0
      ? viableCompleteCandidates
      : (completeCandidates.length > 0 ? completeCandidates : incompleteCandidates);
    const invalidCandidates = calibratedCandidates.filter((c) => c.invalid);

    // ABSTENTION IDENTITY DISCIPLINE:
    // When NO candidate carries model-specific evidence and the top of the ranking is a full
    // tie (all peers at the neutral baseline), the ranking cannot establish an exact model.
    // The presented identity must then come from the raw provider hypothesis — which at least
    // reflects what the VLM actually observed — and never from array order among
    // indistinguishable peers. This is a hypothesis fallback, not a validated exact-model
    // result: the variant tier stays refused and the result remains at family specificity.
    // When NO candidate carries model-specific evidence and the top of the ranking is a tie,
    // the system preserves honest uncertainty at model family/generation level rather than
    // resolving by raw-provider bias or unshifting unregistered hypotheses.

    calibratedCandidates.length = 0;
    calibratedCandidates.push(...validCandidates, ...completeCandidates.filter(c => !validCandidates.includes(c)), ...incompleteCandidates.filter(c => !validCandidates.includes(c)), ...invalidCandidates);

    const topCandidate = validCandidates[0] || null;
    const secondCandidate = validCandidates[1] || null;
    const separation = topCandidate ? Number((topCandidate.score - (secondCandidate?.score || 0)).toFixed(3)) : 0;

    // EVIDENCE-FLOOR GATE:
    // Exact-model resolution is only defensible when at least one candidate carries observable
    // MODEL-SPECIFIC support. If every candidate is indistinguishable (identical neutral baseline,
    // no specific evidence, no contradictions), the engine must not present a confident exact
    // model. It still returns exactly one canonical identity (the best-supported hypothesis) but it
    // refuses the variant tier and requests verification.
    const anyModelSpecificEvidence = fgResult.scoredCandidates.length > 0
      ? fgResult.scoredCandidates.some((c) => c.specificEvidenceCount > 0)
      : validCandidates.some((c) => (c.supporting_evidence?.length ?? 0) > 0);

    // 4. Extract hierarchical components
    let resolvedModelFamily = input.raw_model;
    let resolvedGeneration = input.raw_generation;
    let resolvedVariant: string | null = input.raw_variant;
    let canonicalRecord: any = null;

    // Check adversarial verification feedback
    if (adversarial_result && !adversarial_result.verified) {
      resolvedVariant = null;
      if (adversarial_result.demote_to && resolvedMake) {
        const demoteLower = adversarial_result.demote_to.toLowerCase();
        const makeLower = resolvedMake.toLowerCase();
        if (!demoteLower.includes(makeLower)) {
          // Strict Cross-Brand Demotion Prohibition (Amendment 9)
        }
      }
    }

    // Contradiction Deadlock Resolution
    const allHaveSevereMismatch = validCandidates.length === 0 || calibratedCandidates.every((c) =>
      c.contradictions.some((ct) => ct.includes('Severe manufacturer mismatch') || ct.includes('Hard manufacturer mismatch') || ct.includes('Severe vehicle-type mismatch'))
    );
    const topHasSevereMismatch = Boolean(
      topCandidate && topCandidate.contradictions.some((ct) =>
        ct.includes('Severe manufacturer mismatch') || ct.includes('Hard manufacturer mismatch') || ct.includes('Severe vehicle-type mismatch')
      )
    );

    let specificity: SpecificityLevel = 'make';
    let numericSpecificity = 0;
    let reason = 'Vehicle manufacturer identified with high visual confidence.';

    if (allHaveSevereMismatch || (topHasSevereMismatch && (topCandidate?.score || 0) < 0.50)) {
      resolvedMake = null;
      resolvedModelFamily = null;
      resolvedGeneration = null;
      resolvedVariant = null;
      specificity = 'make';
      numericSpecificity = 0;
      reason = 'Severe architectural contradiction detected: observed visual cues directly contradict proposed candidates.';
    } else if (topCandidate && topCandidate.score >= 0.50) {
      // ── AMENDMENT 3: MONOTONIC SPECIFICITY & CANONICAL REGISTRY LOOKUP ──
      // Look up canonical record for the winning candidate to prevent specificity collapse
      const canonMatch = canonicalVehicleRegistry.lookupByTextOrAlias(topCandidate.name, resolvedMake || undefined);
      if (canonMatch) {
        canonicalRecord = canonMatch;
        resolvedMake = canonMatch.make;
        resolvedModelFamily = canonMatch.model;
        if (!resolvedGeneration && canonMatch.generation) {
          resolvedGeneration = canonMatch.generation;
        }
        // INVARIANT: Variant/package requires direct evidence; do NOT backfill absent trims from canonical database
        if (canonMatch.trim && (topCandidate.name.toLowerCase().includes(canonMatch.trim.toLowerCase()) || (resolvedVariant && resolvedVariant.toLowerCase() === canonMatch.trim.toLowerCase()))) {
          resolvedVariant = canonMatch.trim;
        } else if (!topCandidate.name.toLowerCase().includes(String(resolvedVariant || '').toLowerCase())) {
          resolvedVariant = resolvedVariant || null;
        }
        numericSpecificity = canonMatch.specificityLevel ?? (resolvedVariant ? 4 : resolvedGeneration ? 2 : 1);
      } else {
        const parts = topCandidate.name.split(' ');
        if (!resolvedMake && parts.length > 0) resolvedMake = parts[0];
        const makePrefix = (resolvedMake || '').toLowerCase();
        if (topCandidate.name.toLowerCase().startsWith(makePrefix + ' ')) {
          resolvedModelFamily = topCandidate.name.slice(resolvedMake!.length + 1).trim();
        } else if (parts.length > 1) {
          resolvedModelFamily = parts.slice(1).join(' ').trim();
        }
        if (resolvedModelFamily) {
          const genParenMatch = resolvedModelFamily.match(/^(.+?)\s*\(([^)]+)\)$/);
          if (genParenMatch) {
            resolvedModelFamily = genParenMatch[1].trim();
            if (!resolvedGeneration) {
              resolvedGeneration = genParenMatch[2].trim();
            }
          }
          if (input.raw_model && resolvedModelFamily.toLowerCase().startsWith(input.raw_model.toLowerCase())) {
            const remainder = resolvedModelFamily.slice(input.raw_model.length).trim();
            resolvedModelFamily = input.raw_model;
            if (remainder && !resolvedVariant) {
              resolvedVariant = remainder;
            }
          } else if (resolvedVariant && resolvedModelFamily.toLowerCase().endsWith(' ' + resolvedVariant.toLowerCase())) {
            resolvedModelFamily = resolvedModelFamily.slice(0, -(resolvedVariant.length + 1)).trim();
          }
        }
        numericSpecificity = resolvedVariant ? 4 : resolvedGeneration ? 2 : 1;
      }

      // Tracks whether an earlier gate already wrote a case-specific reason into the ladder
      // input; the honesty guard below must not overwrite those more-specific messages.
      let reasonCustomizedByGate = false;

      // AMENDMENT 5: MULTI-VIEW CONSISTENCY FOR MCLAREN 675LT
      // Only cap at generation if front view lacks distinguishing front proof
      const isMcLaren675 = topCandidate.name.toLowerCase().includes('675lt');
      const isFrontView = viewpoint === 'front' || viewpoint === 'front_3q';
      const hasFront675Proof = evidenceText.includes('front fender louver') || evidenceText.includes('carbon endplate') || evidenceText.includes('675lt');
      if (isMcLaren675 && isFrontView && !hasFront675Proof) {
        resolvedVariant = null;
        if (!resolvedGeneration || resolvedGeneration === 'Current') resolvedGeneration = 'P11';
        numericSpecificity = 2;
        reason = `Identified as McLaren Super Series (${resolvedGeneration}). Specific trim (650S vs 675LT) unconfirmed without observable rear Longtail airbrake or front louvers.`;
        reasonCustomizedByGate = true;
      }

      // Invariant: A high-performance or track variant (e.g. GT3 RS, CSL, SVJ, STO) CANNOT be asserted without grounded evidence!
      const isHighVariant = Boolean(
        (resolvedVariant && /(csl|gt3\s*rs|gt2\s*rs|svj|sto|pista|weissach)/i.test(resolvedVariant)) ||
        (topCandidate?.name && /(csl|gt3\s*rs|gt2\s*rs|svj|sto|pista)/i.test(topCandidate.name)) ||
        (resolvedModelFamily && /(csl|gt3\s*rs|gt2\s*rs|svj|sto|pista)/i.test(resolvedModelFamily))
      );
      if (isHighVariant && !fgResult.evidenceGrounded) {
        resolvedVariant = null;
        if (resolvedModelFamily && /(gt3\s*rs|gt2\s*rs)/i.test(resolvedModelFamily)) {
          resolvedModelFamily = '911';
        }
        numericSpecificity = resolvedGeneration ? 2 : 1;
        reason = `Identified as ${resolvedMake} ${resolvedModelFamily}. Track/high-performance variant unconfirmed without observable aerodynamic proof.`;
        reasonCustomizedByGate = true;
      }

      if (numericSpecificity >= 4 && resolvedVariant && !anyModelSpecificEvidence) {
        // No candidate showed model-specific evidence: the exact model is indistinguishable.
        resolvedVariant = null;
        if (numericSpecificity > 2) numericSpecificity = 2;
        specificity = resolvedGeneration ? 'generation' : 'model_family';
        reason = `Model family is the highest defensible specificity: no model-specific evidence was observable to separate ${resolvedMake} candidates from this angle.`;
      } else if (numericSpecificity >= 4 && resolvedVariant) {
        specificity = 'variant';
        reason = `Exact variant confirmed with distinctive visual evidence: ${resolvedMake} ${resolvedModelFamily} ${resolvedVariant || ''}.`;
      } else if (numericSpecificity >= 2) {
        if (!anyModelSpecificEvidence && !reasonCustomizedByGate) {
          // HONESTY GUARD: no candidate separated on evidence, so no candidate's registry record
          // can claim its generation. The identity is a hypothesis fallback at family level —
          // never "Generation confirmed" inherited from an arbitrary tie-winner's record.
          // (Reasons already customized by earlier gates — e.g. the 675LT front-view ambiguity
          // message — are more specific and are preserved.)
          specificity = 'model_family';
          reason = `Model family is the highest defensible specificity: no model-specific evidence was observable to separate ${resolvedMake} candidates from this angle.`;
        } else {
          specificity = 'generation';
          reason = `Generation confirmed (${resolvedGeneration || ''}) for ${resolvedMake} ${resolvedModelFamily}.`;
        }
      } else {
        specificity = 'model_family';
        reason = `Model family confirmed: ${resolvedMake} ${resolvedModelFamily}.`;
      }
    } else {
      resolvedVariant = null;
      specificity = 'make';
      numericSpecificity = 0;
      reason = `Candidate confidence low (${topCandidate ? topCandidate.score.toFixed(2) : 0}); identified at manufacturer level only. Specific model and trim unconfirmed.`;
    }

    if (specificity !== 'variant') {
      resolvedVariant = null;
    }

    // ── SCOPED CONTRADICTION ENGINE: ISOLATE WINNER FROM RUNNER-UP CONTRADICTIONS ──
    const activeContradictions: string[] = [...globalContradictions];
    if (topCandidate && topCandidate.contradictions) {
      topCandidate.contradictions.forEach((ct) => {
        if (!activeContradictions.includes(ct)) activeContradictions.push(ct);
      });
    } else if (allHaveSevereMismatch) {
      // In a deadlock where all candidates were disqualified, include candidates' disqualifying contradictions
      calibratedCandidates.forEach((cand) => {
        cand.contradictions?.forEach((ct) => {
          if (!activeContradictions.includes(ct)) activeContradictions.push(ct);
        });
      });
    }

    const isExoticOrHighVariant = (topCandidate?.name.toLowerCase() || '').match(/(csl|gt3|gt2|svj|sto|sp3|senna|p1|laferrari|chiron|revuelto)/i);
    const needsAdversarial = Boolean(
      isExoticOrHighVariant &&
      topCandidate &&
      topCandidate.score >= 0.65 &&
      !adversarial_result
    );

    const finalVehicleId = canonicalRecord?.vehicleId || (topCandidate && canonicalVehicleRegistry.lookupByTextOrAlias(topCandidate.name, resolvedMake || undefined)?.vehicleId);
    const finalDisplayName = canonicalRecord?.displayName || (canonicalRecord ? `${canonicalRecord.make} ${canonicalRecord.model}` : (topCandidate?.name || `${resolvedMake} ${resolvedModelFamily}`));

    return {
      identification: {
        make: resolvedMake,
        model_family: resolvedModelFamily,
        generation: resolvedGeneration,
        variant: resolvedVariant
      },
      specificity_level: specificity,
      specificity_level_numeric: numericSpecificity,
      calibrated_candidates: calibratedCandidates,
      top_candidate: topCandidate,
      candidate_separation: separation,
      contradictions: activeContradictions,
      reason,
      needs_adversarial_verification: needsAdversarial,
      needs_neutral_verification: Boolean(
        fgResult.needsVerification ||
        fgResult.rawConflict ||
        !anyModelSpecificEvidence ||
        separation < 0.15
      ),
      raw_conflict: fgResult.rawConflict,
      canonical_vehicle_id: finalVehicleId,
      canonical_display_name: finalDisplayName,
      discriminator_identity: (() => {
        if (canonicalRecord) return canonicalRecord.displayName;
        if (fgResult.topCandidate) return fgResult.topCandidate.displayName;
        return topCandidate?.name || undefined;
      })(),
      // A raw-provider hypothesis that the discriminator could not evaluate is never a validated
      // exact-model result, even if it wins because no evidence-grounded winner existed.
      evidence_grounded: (fgResult.scoredCandidates.length > 0 ? fgResult.evidenceGrounded : Boolean(topCandidate && (topCandidate.supporting_evidence?.length || 0) > 0))
        && anyModelSpecificEvidence
        && !(topCandidate && rawHypothesisDemoted.has(topCandidate.name))
    };
  }
}

export const hierarchicalClassifier = new HierarchicalClassifier();
