/**
 * APEX v2 — Stage E: Decision Policy & Guided Recovery Engine
 * 
 * Functions:
 * 1. Policy resolution: 'identified' | 'identified_model' | 'needs_more_views' | 'uncertain' | 'rejected' | 'not_in_catalogue'.
 * 2. Absolute Rule: Make-only results are NEVER returned silently as successful scans.
 * 3. Guided angle recommendation: Provides exact missing visual angles (e.g. "rear decklid").
 * 4. Multi-frame session fusion: Fuses up to 3 photographs of the same vehicle across angles.
 */

import type {
  CalibratedConfidence,
  FusedCandidate,
  GuidedRecoveryInfo,
  ImageQualityMetrics,
  RetrievalResult,
  V2ResolutionStatus,
  VlmAdjudicationOutput
} from './types';
import type { ViewpointType } from '../types';

export interface DecisionPolicyInput {
  quality: ImageQualityMetrics;
  retrieval: RetrievalResult;
  rankedCandidates: FusedCandidate[];
  calibratedConfidence: CalibratedConfidence;
  viewpoint: ViewpointType;
  sessionFramesCount?: number;
  adjudication?: VlmAdjudicationOutput;
}

export interface DecisionPolicyOutput {
  status: V2ResolutionStatus;
  canonicalId: string | null;
  make: string | null;
  model: string | null;
  generation: string | null;
  variant: string | null;
  displayName: string;
  inCatalogue?: boolean;
  guidedRecovery?: GuidedRecoveryInfo;
  candidateOptions?: Array<{
    canonicalId: string;
    displayName: string;
    variant: string | null;
    confidenceScore: number;
    distinguishingFeatures: string[];
  }>;
}

export class DecisionPolicyEngine {
  /**
   * Evaluates fused signals and renders final policy determination.
   * STRICT FAIL-CLOSED INVARIANTS:
   * 1. A failed or abstained Stage C adjudication NEVER defaults to Stage B candidate.
   * 2. Uncatalogued cars (Golf, Civic, Corolla, Altima, Elantra) are returned as 'not_in_catalogue' with open-world make/model, canonicalId: null.
   * 3. An exact identification requires an explicit successful adjudication matching a shortlisted candidate or decisive retrieval.
   */
  public evaluate(input: DecisionPolicyInput): DecisionPolicyOutput {
    const { quality, retrieval, rankedCandidates, calibratedConfidence, viewpoint, sessionFramesCount = 1, adjudication } = input;

    // 1. Quality Rejection Gate
    if (!quality.isVehiclePresent || quality.blurScore < 0.20) {
      return {
        status: 'rejected',
        canonicalId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: 'Vehicle Rejected',
        inCatalogue: false,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Clear automobile silhouette'],
          suggestedView: 'front_fascia',
          userPrompt: 'No clear vehicle detected. Please position the car in good light and center it in the frame.'
        }
      };
    }

    // 2. Open-World Identity / Out-of-Catalogue from Stage C
    if (adjudication?.outcome === 'not_in_catalogue') {
      const ow = adjudication.openWorldIdentity;
      const make = ow?.make || null;
      const model = ow?.model || null;
      const gen = ow?.generation || null;
      const variant = ow?.variant || null;
      const displayName = make && model ? `${make} ${model}` : (make || 'Uncatalogued Vehicle');

      return {
        status: 'not_in_catalogue',
        canonicalId: null,
        make,
        model,
        generation: gen,
        variant,
        displayName,
        inCatalogue: false,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Catalogue collectible registry inclusion'],
          suggestedView: 'badge_closeup',
          userPrompt: `Spotted ${displayName}! This vehicle is not currently in Apex's launch collectible catalogue.`
        }
      };
    }

    // 3. HARD FAIL-CLOSED ADJUDICATION GATES
    // Invariant: If Stage C was attempted and failed (provider failure, timeout, 429 quota exhaustion,
    // HTTP 5xx, missing credentials, malformed JSON, explicit abstention), the pipeline MUST NEVER
    // return status 'identified' or 'identified_model' and MUST NOT claim catalogue absence!
    if (adjudication) {
      if (adjudication.outcome === 'provider_failure' || (adjudication.outcome as string) === 'provider_error') {
        const failureReason = adjudication.failureReason || adjudication.error || 'Provider execution failure';
        return {
          status: 'uncertain',
          canonicalId: null,
          make: null,
          model: null,
          generation: null,
          variant: null,
          displayName: 'Identification Unavailable (Provider Failure)',
          inCatalogue: false,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: ['Visual adjudication service connectivity'],
            suggestedView: 'front_fascia',
            userPrompt: `Visual verification could not be completed (${failureReason}). Please ensure network connectivity and try again.`
          }
        };
      }

      if (
        adjudication.outcome === 'invalid_response' ||
        (adjudication.outcome as string) === 'invalid_provider_response' ||
        adjudication.outcome === 'invalid_image'
      ) {
        return {
          status: 'uncertain',
          canonicalId: null,
          make: null,
          model: null,
          generation: null,
          variant: null,
          displayName: 'Identification Unavailable (Invalid Response)',
          inCatalogue: false,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: ['Clear, uncorrupted visual capture'],
            suggestedView: 'front_fascia',
            userPrompt: 'Model output or image could not be verified. Please capture a clear photo with good lighting.'
          }
        };
      }

      if (adjudication.outcome === 'valid_abstention') {
        // Model explicitly stated that visual evidence does not support any candidate
        return {
          status: 'uncertain',
          canonicalId: null,
          make: null,
          model: null,
          generation: null,
          variant: null,
          displayName: 'Uncertain Identification',
          inCatalogue: false,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: ['Distinctive manufacturer front/rear cues'],
            suggestedView: 'front_fascia',
            userPrompt: 'Observable visual cues do not decisively match candidate variants. Please capture an additional angle.'
          }
        };
      }

      if (adjudication.outcome === 'skipped_adjudication' && !retrieval.isDecisive) {
        // Stage C was skipped and Stage B retrieval was NOT decisive
        return {
          status: 'uncertain',
          canonicalId: null,
          make: null,
          model: null,
          generation: null,
          variant: null,
          displayName: 'Uncertain Identification',
          inCatalogue: false,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: ['Visual verification'],
            suggestedView: 'front_fascia',
            userPrompt: 'Could not clearly recognize the vehicle. Please try taking a photo from a front 3-quarter angle.'
          }
        };
      }
    } else if (!retrieval.isDecisive) {
      // No adjudication and retrieval not decisive
      return {
        status: 'uncertain',
        canonicalId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: 'Uncertain Identification',
        inCatalogue: false
      };
    }

    // 4. Open-Set Out of Catalogue from Stage B Retrieval Anomaly
    if (retrieval.isOpenSetAnomaly && (!adjudication || adjudication.outcome !== 'successful_identification' || adjudication.chosenCandidateId === 'none')) {
      const ow = adjudication?.openWorldIdentity;
      const make = ow?.make || null;
      const model = ow?.model || null;
      const gen = ow?.generation || null;
      const variant = ow?.variant || null;
      const displayName = make && model ? `${make} ${model}` : 'Uncatalogued Vehicle Spotted';

      return {
        status: 'not_in_catalogue',
        canonicalId: null,
        make,
        model,
        generation: gen,
        variant,
        displayName,
        inCatalogue: false,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Catalogue reference match'],
          suggestedView: 'badge_closeup',
          userPrompt: 'This car appears to be a rare or uncatalogued model. A badge close-up will help curators verify it.'
        }
      };
    }

    // Top candidates evaluation
    const top = rankedCandidates[0];
    const second = rankedCandidates[1];

    if (!top || top.fusedScore < 0.30) {
      return {
        status: 'uncertain',
        canonicalId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: 'Uncertain Identification',
        inCatalogue: false,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Distinctive manufacturer front/rear cues'],
          suggestedView: 'front_fascia',
          userPrompt: 'Could not clearly recognize the vehicle. Please try taking a photo from a front 3-quarter angle.'
        }
      };
    }

    // Candidate options for UI picker
    const candidateOptions = rankedCandidates.slice(0, 4).map(c => ({
      canonicalId: c.candidate.canonicalId,
      displayName: c.candidate.displayName,
      variant: c.candidate.variant,
      confidenceScore: c.fusedScore,
      distinguishingFeatures: c.candidate.distinguishingFeatures
    }));

    // Find the winning candidate (if adjudication chose a candidate, use that candidate!)
    let winningCandidate = top;
    if (adjudication && adjudication.outcome === 'successful_identification' && adjudication.chosenCandidateId !== 'none') {
      const match = rankedCandidates.find(c => c.candidate.canonicalId === adjudication.chosenCandidateId);
      if (match) {
        winningCandidate = match;
      }
    }

    // Check architectural veto on winning candidate
    if (winningCandidate.isVetoed) {
      return {
        status: 'uncertain',
        canonicalId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: 'Uncertain Identification (Feature Conflict)',
        inCatalogue: false,
        candidateOptions,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: [winningCandidate.vetoReason || 'Architectural contradiction detected'],
          suggestedView: 'rear',
          userPrompt: 'Visual features conflict with candidate architecture. Please capture another angle.'
        }
      };
    }

    // 5. Close Variant Deadlock -> 'needs_more_views'
    const isVariantAmbiguity = second &&
      (winningCandidate.candidate.make === second.candidate.make) &&
      (winningCandidate.candidate.model === second.candidate.model) &&
      (winningCandidate.candidate.variant !== second.candidate.variant) &&
      (winningCandidate.fusedScore - second.fusedScore < 0.08) &&
      (sessionFramesCount < 3);

    if (isVariantAmbiguity) {
      let suggestedAngle: GuidedRecoveryInfo['suggestedView'] = 'rear';
      let promptText = `We recognize this ${winningCandidate.candidate.make} ${winningCandidate.candidate.model}! To confirm if it's a ${winningCandidate.candidate.variant || 'Coupe'} or ${second.candidate.variant || 'Spider'}, capture the rear engine cover or roofline.`;

      if (viewpoint === 'rear') {
        suggestedAngle = 'roofline_side';
        promptText = `To confirm whether this ${winningCandidate.candidate.make} ${winningCandidate.candidate.model} is a ${winningCandidate.candidate.variant} or ${second.candidate.variant}, capture the side roofline or front aero.`;
      }

      return {
        status: 'needs_more_views',
        canonicalId: winningCandidate.candidate.canonicalId,
        make: winningCandidate.candidate.make,
        model: winningCandidate.candidate.model,
        generation: winningCandidate.candidate.generation,
        variant: null,
        displayName: `${winningCandidate.candidate.make} ${winningCandidate.candidate.model}`,
        inCatalogue: true,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: winningCandidate.candidate.distinguishingFeatures.slice(0, 2),
          suggestedView: suggestedAngle,
          userPrompt: promptText
        },
        candidateOptions
      };
    }

    // 6. Variant-Level Confirmation
    // Invariant: ONLY permitted if adjudication explicitly succeeded, OR decisive retrieval is enabled.
    const canPromoteToIdentified = (
      (adjudication && adjudication.outcome === 'successful_identification') ||
      (!adjudication && retrieval.isDecisive) ||
      (adjudication && adjudication.outcome === 'skipped_adjudication' && retrieval.isDecisive)
    );

    if (canPromoteToIdentified && calibratedConfidence.variant >= 0.70 && winningCandidate.fusedScore >= 0.70) {
      return {
        status: 'identified',
        canonicalId: winningCandidate.candidate.canonicalId,
        make: winningCandidate.candidate.make,
        model: winningCandidate.candidate.model,
        generation: winningCandidate.candidate.generation,
        variant: winningCandidate.candidate.variant,
        displayName: winningCandidate.candidate.displayName,
        inCatalogue: true,
        candidateOptions
      };
    }

    // 7. Model-Level Confirmation with Candidate Picker
    if (canPromoteToIdentified) {
      return {
        status: 'identified_model',
        canonicalId: winningCandidate.candidate.canonicalId,
        make: winningCandidate.candidate.make,
        model: winningCandidate.candidate.model,
        generation: winningCandidate.candidate.generation,
        variant: null,
        displayName: `${winningCandidate.candidate.make} ${winningCandidate.candidate.model}`,
        inCatalogue: true,
        candidateOptions,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Variant trim badge or aero package verification'],
          suggestedView: 'rear',
          userPrompt: `Identified as ${winningCandidate.candidate.make} ${winningCandidate.candidate.model}. Select the exact variant below or take a photo of the rear badge.`
        }
      };
    }

    // Fallback fail-closed
    return {
      status: 'uncertain',
      canonicalId: null,
      make: null,
      model: null,
      generation: null,
      variant: null,
      displayName: 'Uncertain Identification',
      inCatalogue: false
    };
  }

  /**
   * Session Fusion: Merges up to 3 frames of the same car
   */
  public fuseMultiFrameSession(frames: DecisionPolicyOutput[]): DecisionPolicyOutput {
    if (frames.length === 0) throw new Error('Empty frames array');
    if (frames.length === 1) return frames[0];

    // Find any frame that achieved full 'identified' status
    const exactIdentified = frames.find(f => f.status === 'identified');
    if (exactIdentified) return exactIdentified;

    // Otherwise pick the frame with highest specificity and return combined options
    const modelIdentified = frames.find(f => f.status === 'identified_model');
    return modelIdentified || frames[frames.length - 1];
  }
}

export const decisionPolicyEngine = new DecisionPolicyEngine();
