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
  discriminator_identity?: string;
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
      // Check structured vehicle_classification first if present
      const structuredClass = (visual_evidence as any)?.vehicle_classification;
      const isStructuredBus = structuredClass === 'commercial_bus' || structuredClass === 'commercial_truck';

      // Fallback word-boundary checks on evidence text (prevents 'rhombus' matching 'bus', 'coachline' matching 'coach')
      const isWordBoundaryBus = 
        /\bbus(es)?\b/i.test(evidenceText) || 
        /\b(public\s+transit|transit\s+bus|metro\s+bus|city\s+bus)\b/i.test(evidenceText) || 
        /\bcoach(?!built|line)\b/i.test(evidenceText) || 
        /\b(semi-truck|heavy\s+truck|lorry)\b/i.test(evidenceText) ||
        /\bbus\b/i.test((visual_evidence.body_style || '').toLowerCase());

      const isBusOrHeavyVehicle = isStructuredBus || isWordBoundaryBus;

      if (isBusOrHeavyVehicle) {
        // Commercial bus evidence strictly eliminates all sports car, hypercar, and consumer coupe candidates
        candContradictions.push(
          `Severe vehicle-type mismatch: Observed subject is public transit/bus, which completely contradicts automobile candidate ${candidate.name}`
        );
        if (!globalContradictions.includes('Observed subject is public transit/heavy vehicle, not a consumer automobile.')) {
          globalContradictions.push('Observed subject is public transit/heavy vehicle, not a consumer automobile.');
        }
        score -= 0.95;
      }

      // ── CONTRADICTION ENGINE RULE 0B: COMMERCIAL TAXI / LIVERY CONTRADICTION ──
      const isStructuredTaxi = structuredClass === 'taxi_livery';
      const isWordBoundaryTaxi = /\b(taxi|urban\s+taxi|crown\s+comfort|cab\s+livery)\b/i.test(evidenceText);
      const isTaxiLivery = isStructuredTaxi || isWordBoundaryTaxi;
      const isExoticSupercar = candNameLower.includes('hurac') || candNameLower.includes('lamborghini') || candNameLower.includes('ferrari') || candNameLower.includes('mclaren') || candNameLower.includes('chiron') || candNameLower.includes('bugatti');
      if (isTaxiLivery && isExoticSupercar) {
        candContradictions.push(
          `Severe vehicle-type mismatch: Observed subject has commercial taxi livery/architecture, which contradicts exotic sports car candidate ${candidate.name}`
        );
        if (!globalContradictions.includes('Observed subject displays commercial taxi livery/features.')) {
          globalContradictions.push('Observed subject displays commercial taxi livery/features.');
        }
        score -= 0.95;
      }

      // ── CONTRADICTION ENGINE RULE A: CROSS-MANUFACTURER BRAND EVIDENCE CONTRADICTION ──
      // If evidence clearly displays distinctive manufacturer brand cues, eliminate incompatible makes
      const hasBmwCues = /\b(kidney|hofmeister|bmw)\b/i.test(evidenceText);
      const hasMercedesCues = /\b(panamericana|three-pointed\s+star|mercedes|amg\s+grille)\b/i.test(evidenceText);
      const hasFerrariCues = /\b(prancing\s+horse|ferrari|shark\s+nose|side\s+strakes|testarossa)\b/i.test(evidenceText);
      const hasPorscheCues = /\b(porsche|sloping\s+flyline|teardrop\s+roofline|bulbous\s+front\s+fender)\b/i.test(evidenceText);
      const hasToyotaCues = (/\b(toyota|gr\s+supra|gr\s+badge)\b/i.test(evidenceText)) || isTaxiLivery;

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
        // McLaren P11 platform (650S vs 675LT) - rear active Longtail airbrake unobservable
        if (candNameLower.includes('675lt')) {
          const hasFrontLtProof = evidenceText.includes('675lt') || evidenceText.includes('front fender louver') || evidenceText.includes('carbon endplate');
          if (!hasFrontLtProof) {
            candUnobservable.push('675LT active rear Longtail airbrake and dual top-exit titanium exhausts are unobservable from front viewpoint');
            score -= 0.25;
          }
        }
        // Porsche 911 GT3 / GT3 RS - rear wing unobservable from front without nostril ducts
        if (candNameLower.includes('gt3')) {
          const hasFrontGt3Proof = evidenceText.includes('gt3') || evidenceText.includes('drs') || evidenceText.includes('hood nostril') || evidenceText.includes('fender vent');
          if (!hasFrontGt3Proof) {
            candUnobservable.push('GT3 high-mounted rear wing is unobservable from front viewpoint and front fascia lacks GT3 air extractor');
            score -= 0.25;
          }
        }
      }

      // If viewpoint is rear or rear_3q, check rear architecture
      if (viewpoint === 'rear' || viewpoint === 'rear_3q') {
        // Huracán STO requires prominent roof air scoop/snorkel and giant swan-neck rear wing
        if (candNameLower.includes('sto') && !evidenceText.includes('sto') && !evidenceText.includes('swan-neck') && !evidenceText.includes('snorkel')) {
          candContradictions.push('Huracán STO requires prominent roof air scoop/snorkel and giant swan-neck wing, absent from observed rear');
          score -= 0.60;
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

      // ── CONTRADICTION ENGINE RULE E: FERRARI MODEL-FAMILY DISAMBIGUATION ──
      // Distinctive Icona / Prototype design language (horizontal strakes, headlight eyelids, wraparound visor)
      const hasDaytonaIconaCues = 
        /\b(horizontal\s+strakes?|strakes?|horizontal\s+slats?|eyelids?|partial\s+covers?|wraparound\s+visor|visor\s+canopy|fender-mounted\s+mirrors?|door\s+tops?\s+mirrors?|icona)\b/i.test(evidenceText);

      if (hasDaytonaIconaCues) {
        if (candNameLower.includes('daytona') || candNameLower.includes('sp3')) {
          candSupporting.push('Observed horizontal strakes, headlight eyelids, and wraparound visor canopy uniquely match Ferrari Daytona SP3 Icona design');
          score += 0.20;
        } else if (candidateMake === 'ferrari' && (candNameLower.includes('sf90') || candNameLower.includes('296') || candNameLower.includes('f8') || candNameLower.includes('roma') || candNameLower.includes('portofino') || candNameLower.includes('488'))) {
          candContradictions.push(`Observed horizontal strakes, headlight eyelids, and wraparound canopy contradict ${candidate.name} architecture`);
          score -= 0.40;
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

    // 2b. Generalized Fine-Grained Model Discrimination (Reusable Morphological Traits + Visibility Matrix)
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
      candidates: calibratedCandidates.map((c) => ({ name: c.name, score: c.score })),
      fallbackMake: input.raw_make || undefined,
      fallbackModel: input.raw_model || undefined
    });

    if (fgResult.scoredCandidates.length > 0) {
      for (const fgCand of fgResult.scoredCandidates) {
        const existingIdx = calibratedCandidates.findIndex(
          (c) =>
            c.name.toLowerCase() === fgCand.displayName.toLowerCase() ||
            c.name.toLowerCase() === `${fgCand.make} ${fgCand.model}`.toLowerCase() ||
            c.name.toLowerCase().includes(fgCand.model.toLowerCase())
        );

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
            unobservable_features: fgCand.unobservableTraits
          });
        }
      }
    }

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
      // Invariant: Adversarial verification verifies, never arbitrarily substitutes.
      // Variant is reduced to null (base model) upon contradiction or lack of verified aero/badging proof.
      resolvedVariant = null;
      if (adversarial_result.demote_to && resolvedMake) {
        const demoteLower = adversarial_result.demote_to.toLowerCase();
        const makeLower = resolvedMake.toLowerCase();
        // Strict Cross-Brand Demotion Prohibition:
        // A runner-up or adversarial candidate from a DIFFERENT manufacturer MUST NEVER replace the winner.
        if (!demoteLower.includes(makeLower)) {
          // Discard cross-brand demote_to; preserve verified make & model family, drop variant.
        }
      }
    }

    // ── CONTRADICTION DEADLOCK RESOLUTION ──
    // If all candidates suffer severe manufacturer/type contradictions, or top candidate is contradicted by observable brand cues:
    const allHaveSevereMismatch = calibratedCandidates.length > 0 && calibratedCandidates.every((c) =>
      c.contradictions.some((ct) => ct.includes('Severe manufacturer mismatch') || ct.includes('Severe vehicle-type mismatch'))
    );
    const topHasSevereMismatch = Boolean(
      topCandidate && topCandidate.contradictions.some((ct) =>
        ct.includes('Severe manufacturer mismatch') || ct.includes('Severe vehicle-type mismatch')
      )
    );

    let specificity: SpecificityLevel = 'make';
    let reason = 'Vehicle manufacturer identified with high visual confidence.';

    if (allHaveSevereMismatch || (topHasSevereMismatch && (topCandidate?.score || 0) < 0.50)) {
      resolvedMake = null;
      resolvedModelFamily = null;
      resolvedGeneration = null;
      resolvedVariant = null;
      specificity = 'make';
      reason = 'Severe architectural contradiction detected: observed visual cues directly contradict proposed candidates.';
    } else if (topCandidate && topCandidate.score >= 0.50) {
      // 1. Maintain or set resolvedMake
      if (!resolvedMake) {
        const parts = topCandidate.name.split(' ');
        if (parts.length > 0) resolvedMake = parts[0];
      }

      // 2. Derive resolvedModelFamily from topCandidate if candidate belongs to the same manufacturer
      const candLower = topCandidate.name.toLowerCase();
      const currentMakeLower = (resolvedMake || '').toLowerCase();
      const currentModelLower = (resolvedModelFamily || '').toLowerCase();

      // Only re-derive model family if current model family is empty or contradicted/different from winning candidate
      const modelAlreadyMatches = Boolean(currentModelLower && candLower.includes(currentModelLower));

      if (!modelAlreadyMatches) {
        if (resolvedMake && candLower.startsWith(currentMakeLower + ' ')) {
          resolvedModelFamily = topCandidate.name
            .slice(resolvedMake.length + 1)
            .replace(/\s*\([^)]*\)/g, '')
            .trim();
        } else if (resolvedMake === 'Mercedes-Benz' && candLower.startsWith('mercedes-amg ')) {
          // Handle Mercedes-AMG sub-brand while keeping canonical make intact
          resolvedModelFamily = topCandidate.name
            .slice('mercedes-amg '.length)
            .replace(/\s*\([^)]*\)/g, '')
            .trim();
        } else if (!resolvedModelFamily) {
          const parts = topCandidate.name.split(' ');
          if (parts.length > 1) {
            resolvedModelFamily = parts.slice(1).join(' ').replace(/\s*\([^)]*\)/g, '').trim();
          }
        }
      }

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

      // P11 McLaren Specificity Rule: From front view without rear airbrake, cap at generation P11
      const isMcLarenP11 = topCandidate.name.toLowerCase().includes('650s') || topCandidate.name.toLowerCase().includes('675lt');
      const isFrontView = viewpoint === 'front' || viewpoint === 'front_3q';

      if (isMcLarenP11 && isFrontView) {
        resolvedVariant = null;
        specificity = 'generation';
        if (!resolvedGeneration || resolvedGeneration === 'Current') resolvedGeneration = 'P11';
        reason = `Identified as McLaren Super Series (${resolvedGeneration}). Specific trim (650S vs 675LT) unconfirmed without observable rear Longtail airbrake and exhaust.`;
      } else if (resolvedVariant && hasVariantEvidence) {
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

    // ── SCOPED CONTRADICTION ENGINE: ISOLATE WINNER FROM RUNNER-UP CONTRADICTIONS ──
    // Winner candidate is ONLY penalized by its OWN contradictions and scene-level global contradictions.
    // Runner-up rejection notes (why runner-up was NOT selected) MUST NEVER leak into the winner's score or active contradictions.
    const activeContradictions: string[] = [...globalContradictions];
    if (topCandidate && topCandidate.contradictions) {
      topCandidate.contradictions.forEach((ct) => {
        if (!activeContradictions.includes(ct)) activeContradictions.push(ct);
      });
    }

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
      contradictions: activeContradictions,
      reason,
      needs_adversarial_verification: needsAdversarial,
      discriminator_identity: (() => {
        if (fgResult.topCandidate) {
          const fgModel = fgResult.topCandidate.model.toLowerCase();
          const topLower = (topCandidate?.name || '').toLowerCase();
          if (topLower.includes(fgModel) || fgResult.topCandidate.displayName.toLowerCase().includes(topLower)) {
            return fgResult.topCandidate.displayName;
          }
        }
        return topCandidate?.name || undefined;
      })(),
      evidence_grounded: fgResult.scoredCandidates.length > 0 ? fgResult.evidenceGrounded : Boolean(topCandidate && (topCandidate.supporting_evidence?.length || 0) > 0)
    };
  }
}

export const hierarchicalClassifier = new HierarchicalClassifier();
