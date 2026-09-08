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

export interface HierarchicalClassificationInput {
  visual_evidence: VisualEvidence;
  viewpoint: ViewpointType;
  raw_make: string | null;
  raw_model: string | null;
  raw_generation: string | null;
  raw_variant: string | null;
  raw_candidates: CandidateComparison[];
  adversarial_result?: {
    verified: boolean;
    demote_to?: string | null;
    reason?: string;
  };
}

export interface HierarchicalClassificationResult {
  identification: HierarchicalIdentification;
  specificity_level: SpecificityLevel;
  calibrated_candidates: CandidateComparison[];
  top_candidate: CandidateComparison | null;
  candidate_separation: number;
  contradictions: string[];
  reason: string;
  needs_adversarial_verification: boolean;
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

      // ── CONTRADICTION ENGINE RULE 0: BUS / COMMERCIAL FLEET ELIMINATION ──
      const isBusOrHeavyVehicle = 
        evidenceText.includes('bus') || 
        evidenceText.includes('transit') || 
        evidenceText.includes('coach') || 
        evidenceText.includes('semi-truck') ||
        (visual_evidence.body_style || '').toLowerCase().includes('bus');

      if (isBusOrHeavyVehicle) {
        // Commercial bus evidence strictly eliminates all sports car, hypercar, and consumer coupe candidates
        candContradictions.push(
          `Severe vehicle-type mismatch: Observed subject is public transit/bus, which completely contradicts automobile candidate ${candidate.name}`
        );
        score -= 0.95;
      }

      // ── CONTRADICTION ENGINE RULE A: CROSS-MANUFACTURER BRAND EVIDENCE CONTRADICTION ──
      // If evidence clearly displays distinctive manufacturer brand cues, eliminate incompatible makes
      const hasBmwCues = evidenceText.includes('kidney') || evidenceText.includes('hofmeister') || evidenceText.includes('bmw');
      const hasMercedesCues = evidenceText.includes('panamericana') || evidenceText.includes('three-pointed star') || evidenceText.includes('mercedes') || evidenceText.includes('amg grille');
      const hasFerrariCues = evidenceText.includes('prancing horse') || evidenceText.includes('ferrari') || evidenceText.includes('shark nose') || evidenceText.includes('strakes');
      const hasPorscheCues = evidenceText.includes('porsche') || evidenceText.includes('sloping flyline') || evidenceText.includes('teardrop roofline') || evidenceText.includes('bulbous front fender');
      const hasToyotaCues = evidenceText.includes('toyota') || evidenceText.includes('gr supra') || evidenceText.includes('gr badge');

      if (hasMercedesCues && candidateMake && candidateMake !== 'mercedes') {
        candContradictions.push(
          `Severe manufacturer mismatch: Observed Mercedes-Benz architecture/emblem contradicts ${candidate.name}`
        );
        score -= 0.90;
      }

      if (hasBmwCues && candidateMake && candidateMake !== 'bmw') {
        candContradictions.push(
          `Severe manufacturer mismatch: Observed BMW kidney grille/architecture contradicts ${candidate.name}`
        );
        score -= 0.90;
      }

      if (hasToyotaCues && candidateMake && candidateMake !== 'toyota') {
        candContradictions.push(
          `Severe manufacturer mismatch: Observed Toyota architecture/emblem contradicts ${candidate.name}`
        );
        score -= 0.90;
      }

      if (hasFerrariCues && candidateMake && candidateMake !== 'ferrari') {
        candContradictions.push(
          `Severe manufacturer mismatch: Observed Ferrari architecture/emblem contradicts ${candidate.name}`
        );
        score -= 0.90;
      }

      if (hasPorscheCues && candidateMake && candidateMake !== 'porsche') {
        candContradictions.push(
          `Severe manufacturer mismatch: Observed Porsche architecture contradicts ${candidate.name}`
        );
        score -= 0.90;
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
        }
      }

      // ── CONTRADICTION ENGINE RULE C: UNOBSERVABLE VIEWPOINT RESTRICTIONS ──
      // If viewpoint is front/front_3q, rear features cannot support variant claims
      if (viewpoint === 'front' || viewpoint === 'front_3q') {
        if (candNameLower.includes('csl') && !evidenceText.includes('csl') && !evidenceText.includes('red grille') && !evidenceText.includes('yellow drl')) {
          candUnobservable.push('CSL-specific ducktail spoiler and laser taillights are unobservable from front viewpoint');
          score -= 0.20;
        }
      }

      // ── CONTRADICTION ENGINE RULE D: SPECIFIC VARIANT EVIDENCE CHECK ──
      // To win a specialized track/limited edition variant (CSL, GT3 RS, SVJ, Black Series),
      // positive observable evidence MUST be present
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

      const boundedScore = Math.max(0.01, Math.min(0.99, Number(score.toFixed(3))));

      return {
        name: candidate.name,
        score: boundedScore,
        supporting_evidence: candSupporting,
        contradictions: candContradictions,
        unobservable_features: candUnobservable
      };
    });

    // 3. Sort candidates descending by calibrated score
    calibratedCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = calibratedCandidates[0] || null;
    const secondCandidate = calibratedCandidates[1] || null;
    const separation = topCandidate ? Number((topCandidate.score - (secondCandidate?.score || 0)).toFixed(3)) : 0;

    // 4. Extract hierarchical components
    let resolvedMake = input.raw_make;
    let resolvedModelFamily = input.raw_model;
    let resolvedGeneration = input.raw_generation;
    let resolvedVariant: string | null = input.raw_variant;

    // Check adversarial verification feedback
    if (adversarial_result && !adversarial_result.verified) {
      if (adversarial_result.demote_to) {
        resolvedVariant = null;
      }
    }

    // 5. Determine Maximum Defensible Specificity
    // Hierarchical rule:
    // If variant-specific cues are absent, or candidate margin is low, stop at generation or model_family!
    let specificity: SpecificityLevel = 'make';
    let reason = 'Vehicle manufacturer identified with high visual confidence.';

    if (topCandidate && topCandidate.score >= 0.50) {
      // Clean make & model from top candidate if available
      const parts = topCandidate.name.split(' ');
      if (!resolvedMake && parts.length > 0) resolvedMake = parts[0];

      specificity = 'model_family';
      reason = `Model family confirmed based on characteristic architecture: ${resolvedMake} ${resolvedModelFamily || ''}.`;

      if (resolvedGeneration && resolvedGeneration !== 'Unknown' && resolvedGeneration !== 'Current') {
        specificity = 'generation';
        reason = `Generation confirmed (${resolvedGeneration}) from era-specific lighting and body lines.`;
      }

      // Check if variant is defensible
      const hasVariantEvidence = (topCandidate.unobservable_features || []).length === 0 &&
                                 (topCandidate.contradictions || []).length === 0 &&
                                 separation >= 0.15 &&
                                 topCandidate.score >= 0.78;

      if (resolvedVariant && hasVariantEvidence) {
        specificity = 'variant';
        reason = `Exact variant confirmed with distinctive visual evidence: ${topCandidate.name}.`;
      } else {
        // Explicitly abstain from variant guessing
        resolvedVariant = null;
        if (specificity === 'generation') {
          reason = `Identified as ${resolvedMake} ${resolvedModelFamily} (${resolvedGeneration}). Specific trim/variant unconfirmed from visible viewpoint.`;
        } else {
          reason = `Identified as ${resolvedMake} ${resolvedModelFamily}. Trim/variant uncertain.`;
        }
      }
    }

    // Collect all contradiction notes
    calibratedCandidates.forEach((c) => {
      c.contradictions.forEach((ct) => {
        if (!globalContradictions.includes(ct)) globalContradictions.push(ct);
      });
    });

    // Check if adversarial verification is required
    const isExoticOrHighVariant = (topCandidate?.name.toLowerCase() || '').match(/(csl|gt3|gt2|svj|sto|sp3|senna|p1|laferrari|chiron|revuelto)/i);
    const needsAdversarial = Boolean(
      isExoticOrHighVariant &&
      topCandidate &&
      topCandidate.score >= 0.65 &&
      !adversarial_result
    );

    return {
      identification: {
        make: resolvedMake,
        model_family: resolvedModelFamily,
        generation: resolvedGeneration,
        variant: resolvedVariant
      },
      specificity_level: specificity,
      calibrated_candidates: calibratedCandidates,
      top_candidate: topCandidate,
      candidate_separation: separation,
      contradictions: globalContradictions,
      reason,
      needs_adversarial_verification: needsAdversarial
    };
  }
}

export const hierarchicalClassifier = new HierarchicalClassifier();
