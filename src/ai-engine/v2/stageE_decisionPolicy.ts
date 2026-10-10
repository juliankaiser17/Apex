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
   * Evaluates fused signals and renders final policy determination
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
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: ['Clear automobile silhouette'],
          suggestedView: 'front_fascia',
          userPrompt: 'No clear vehicle detected. Please position the car in good light and center it in the frame.'
        }
      };
    }

    // 2. Open-Set Out of Catalogue Gate
    if (retrieval.isOpenSetAnomaly) {
      return {
        status: 'not_in_catalogue',
        canonicalId: null,
        make: null,
        model: null,
        generation: null,
        variant: null,
        displayName: 'Uncatalogued Vehicle Spotted',
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

    // ── HARD FAIL-CLOSED ADJUDICATION GATE ──
    // Invariant: If Stage C adjudication was attempted and failed (timeout, 429 quota exhaustion,
    // HTTP 5xx, missing credentials, malformed JSON, unlisted candidate ID) or resulted in valid abstention,
    // the pipeline MUST NEVER return status 'identified'.
    // Retrieval similarity alone CANNOT promote a vehicle to a confident exact variant identification.
    if (adjudication) {
      if (adjudication.outcome === 'provider_failure' || adjudication.outcome === 'invalid_response') {
        const failureReason = adjudication.failureReason || adjudication.error || 'Provider execution failure';
        return {
          status: 'uncertain',
          canonicalId: null,
          make: top ? top.candidate.make : null,
          model: top ? top.candidate.model : null,
          generation: null,
          variant: null,
          displayName: top ? `${top.candidate.make} ${top.candidate.model} (Verification Unavailable)` : 'Uncertain Identification',
          candidateOptions,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: ['Visual adjudication verification'],
            suggestedView: 'front_fascia',
            userPrompt: `Visual verification could not be completed (${failureReason}). Please ensure clear lighting and take another photo.`
          }
        };
      }

      if (adjudication.outcome === 'valid_abstention') {
        return {
          status: 'uncertain',
          canonicalId: null,
          make: top ? top.candidate.make : null,
          model: top ? top.candidate.model : null,
          generation: null,
          variant: null,
          displayName: top ? `${top.candidate.make} ${top.candidate.model} (Unconfirmed)` : 'Uncertain Identification',
          candidateOptions,
          guidedRecovery: {
            currentAngle: viewpoint,
            missingCues: top?.candidate?.distinguishingFeatures?.slice(0, 2) || ['Distinctive vehicle features'],
            suggestedView: 'rear',
            userPrompt: 'Observable visual cues do not decisively match candidate variants. Please capture an additional angle.'
          }
        };
      }
    }

    // 3. Close Variant Deadlock -> 'needs_more_views'
    const isVariantAmbiguity = second &&
      (top.candidate.make === second.candidate.make) &&
      (top.candidate.model === second.candidate.model) &&
      (top.candidate.variant !== second.candidate.variant) &&
      (top.fusedScore - second.fusedScore < 0.08) &&
      (sessionFramesCount < 3);

    if (isVariantAmbiguity) {
      // Determine what angle would resolve the ambiguity
      let suggestedAngle: GuidedRecoveryInfo['suggestedView'] = 'rear';
      let promptText = `We recognize this ${top.candidate.make} ${top.candidate.model}! To confirm if it's a ${top.candidate.variant || 'Coupe'} or ${second.candidate.variant || 'Spider'}, capture the rear engine cover or roofline.`;

      if (viewpoint === 'rear') {
        suggestedAngle = 'roofline_side';
        promptText = `To confirm whether this ${top.candidate.make} ${top.candidate.model} is a ${top.candidate.variant} or ${second.candidate.variant}, capture the side roofline or front aero.`;
      }

      return {
        status: 'needs_more_views',
        canonicalId: top.candidate.canonicalId,
        make: top.candidate.make,
        model: top.candidate.model,
        generation: top.candidate.generation,
        variant: null,
        displayName: `${top.candidate.make} ${top.candidate.model}`,
        guidedRecovery: {
          currentAngle: viewpoint,
          missingCues: top.candidate.distinguishingFeatures.slice(0, 2),
          suggestedView: suggestedAngle,
          userPrompt: promptText
        },
        candidateOptions
      };
    }

    // 4. Variant-Level Confirmation
    // Invariant: Only permitted if adjudication explicitly succeeded, OR if retrieval was decisive in skipped mode.
    // In NO circumstance can a failed, abstained, or non-decisive adjudication enter 'identified'.
    const canPromoteToIdentified = (
      (adjudication && adjudication.outcome === 'successful_identification') ||
      (!adjudication && retrieval.isDecisive) ||
      (adjudication && adjudication.outcome === 'skipped_adjudication' && retrieval.isDecisive)
    );

    if (canPromoteToIdentified && calibratedConfidence.variant >= 0.70 && top.fusedScore >= 0.70) {
      return {
        status: 'identified',
        canonicalId: top.candidate.canonicalId,
        make: top.candidate.make,
        model: top.candidate.model,
        generation: top.candidate.generation,
        variant: top.candidate.variant,
        displayName: top.candidate.displayName,
        candidateOptions
      };
    }

    // 5. Model-Level Confirmation with Candidate Picker
    // INVARIANT: Never return silent make-only. Present identified_model with candidate options!
    return {
      status: 'identified_model',
      canonicalId: top.candidate.canonicalId,
      make: top.candidate.make,
      model: top.candidate.model,
      generation: top.candidate.generation,
      variant: null,
      displayName: `${top.candidate.make} ${top.candidate.model}`,
      candidateOptions,
      guidedRecovery: {
        currentAngle: viewpoint,
        missingCues: ['Variant trim badge or aero package verification'],
        suggestedView: 'rear',
        userPrompt: `Identified as ${top.candidate.make} ${top.candidate.model}. Select the exact variant below or take a photo of the rear badge.`
      }
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
