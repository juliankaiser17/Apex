import type {
  ApexConfidenceScore,
  CandidateVehicle,
  HierarchicalConfidence,
  IdentificationStatus,
  ModelIdentificationOutput,
  ScanQualityMetrics,
  SpecificityLevel
} from '../types';
import type { ValidationReport } from './deterministicValidator';

export interface ConfidenceEvaluationInput {
  modelOutput: ModelIdentificationOutput;
  validationReport: ValidationReport;
  qualityMetrics: ScanQualityMetrics;
  topCandidates: CandidateVehicle[];
  frameAgreementRatio?: number;
}

export interface CalibratedConfidenceResult {
  status: IdentificationStatus;
  confidence: HierarchicalConfidence;
  legacy_score: ApexConfidenceScore;
  reason: string;
  needs_retake: boolean;
}

export class ConfidenceEngine {
  // Calibrated weights for multi-signal probability estimation
  private readonly weightVisualSimilarity = 0.25;
  private readonly weightModelAgreement = 0.25;
  private readonly weightCandidateMargin = 0.20;
  private readonly weightFrameAgreement = 0.15;
  private readonly weightDatabaseConsistency = 0.15;

  // Thresholds
  private readonly confidentThreshold = 0.72; // Decisive identification
  private readonly abstentionThreshold = 0.48; // Below this, Apex explicitly abstains

  /**
   * Computes hierarchical multi-tier confidence scores and assigns explicit status
   * (IDENTIFIED, PROBABLE, UNCERTAIN, REJECTED).
   */
  public computeHierarchicalConfidence(params: {
    image_quality_score: number;
    evidence_strength: number;
    candidate_separation: number;
    contradiction_count?: number;
    top_candidate_contradictions?: string[];
    global_contradictions?: string[];
    top_candidate_score: number;
    specificity_level: SpecificityLevel;
    has_vehicle: boolean;
  }): CalibratedConfidenceResult {
    const {
      image_quality_score,
      evidence_strength,
      candidate_separation,
      top_candidate_score,
      specificity_level,
      has_vehicle
    } = params;

    // Calculate effective contradiction count strictly from winner's contradictions + global contradictions
    const activeContradictionsCount = params.top_candidate_contradictions !== undefined
      ? (params.top_candidate_contradictions.length + (params.global_contradictions?.length || 0))
      : (params.contradiction_count || 0);

    // Reject immediately if no vehicle or unusable image
    if (!has_vehicle || image_quality_score < 0.30) {
      return {
        status: 'rejected',
        confidence: {
          make_score: 0.1,
          model_score: 0.05,
          generation_score: 0.02,
          variant_score: 0.01,
          overall_score: 0.05
        },
        legacy_score: {
          totalScore: 0.05,
          isConfident: false,
          shouldAbstain: true,
          abstentionReason: 'Image quality or framing insufficient to detect a motor vehicle.',
          breakdown: {
            visualSimilarityWeight: 0,
            modelAgreementWeight: 0,
            candidateMarginWeight: 0,
            frameAgreementWeight: 0,
            databaseConsistencyWeight: 0,
            qualityPenalty: 0.95
          }
        },
        reason: 'Image quality is too low or no motor vehicle was detected in the frame.',
        needs_retake: true
      };
    }

    // Base score components
    const qualityFactor = Math.min(1.0, Math.max(0.2, image_quality_score));
    const evidenceFactor = Math.min(1.0, Math.max(0.2, evidence_strength));
    const separationFactor = Math.min(1.0, Math.max(0, candidate_separation * 2.5));
    // Scoped contradiction penalty: ONLY penalizes for winner's contradictions or scene-level contradictions
    const contradictionPenalty = Math.min(0.8, activeContradictionsCount * 0.25);

    // Tier 1: Make Confidence
    const rawMakeScore =
      0.40 * qualityFactor +
      0.35 * top_candidate_score +
      0.25 * evidenceFactor -
      contradictionPenalty * 0.5;
    const make_score = Math.max(0.1, Math.min(0.99, Number(rawMakeScore.toFixed(3))));

    // Tier 2: Model Family Confidence
    const rawModelScore =
      0.30 * make_score +
      0.30 * top_candidate_score +
      0.25 * separationFactor +
      0.15 * qualityFactor -
      contradictionPenalty;
    const model_score = Math.max(0.05, Math.min(0.98, Number(rawModelScore.toFixed(3))));

    // Tier 3: Generation Confidence
    const rawGenScore =
      model_score * 0.85 - (specificity_level === 'make' || specificity_level === 'model_family' ? 0.25 : 0);
    const generation_score = Math.max(0.05, Math.min(0.95, Number(rawGenScore.toFixed(3))));

    // Tier 4: Variant Confidence
    const rawVariantScore =
      specificity_level === 'variant'
        ? Math.min(0.95, model_score * 0.85 + separationFactor * 0.2)
        : Math.min(0.45, model_score * 0.40);
    const variant_score = Math.max(0.01, Math.min(0.95, Number(rawVariantScore.toFixed(3))));

    // Overall composite confidence
    const overall_score = Number(
      (
        make_score * 0.35 +
        model_score * 0.35 +
        generation_score * 0.15 +
        variant_score * 0.15
      ).toFixed(3)
    );

    // Map to explicit state
    // IDENTIFIED: High make & model confidence with strong separation
    // PROBABLE: Good make & model confidence with moderate ambiguity
    // UNCERTAIN: Insufficient evidence for exact trim or narrow candidate gap
    // REJECTED: Low confidence / unidentifiable
    let status: IdentificationStatus = 'uncertain';
    let reason = 'Vehicle identified with moderate confidence; variant unverified.';
    let needs_retake = false;

    if (overall_score >= 0.78 && candidate_separation >= 0.15 && activeContradictionsCount === 0) {
      status = 'identified';
      reason = 'Definitive identification with distinctive aerodynamic and styling features.';
      needs_retake = false;
    } else if (overall_score >= 0.60 && make_score >= 0.75) {
      status = 'probable';
      reason = 'Likely identification supported by visible vehicle architecture.';
      needs_retake = false;
    } else if (overall_score >= 0.40) {
      status = 'uncertain';
      reason = 'Model family likely, but specific variant uncertain. Capture another angle for exact trim verification.';
      needs_retake = false; // UNCERTAIN != ERROR: It is a successful partial identification
    } else {
      status = 'rejected';
      reason = 'Visual features insufficient to determine vehicle make and model.';
      needs_retake = true;
    }

    const legacy_score: ApexConfidenceScore = {
      totalScore: overall_score,
      isConfident: status === 'identified' || status === 'probable',
      shouldAbstain: status === 'rejected',
      abstentionReason: status === 'rejected' ? reason : undefined,
      breakdown: {
        visualSimilarityWeight: Number((top_candidate_score * 0.25).toFixed(3)),
        modelAgreementWeight: Number((model_score * 0.25).toFixed(3)),
        candidateMarginWeight: Number((separationFactor * 0.20).toFixed(3)),
        frameAgreementWeight: 0.15,
        databaseConsistencyWeight: 0.15,
        qualityPenalty: Number(contradictionPenalty.toFixed(3))
      }
    };

    return {
      status,
      confidence: {
        make_score,
        model_score,
        generation_score,
        variant_score,
        overall_score
      },
      legacy_score,
      reason,
      needs_retake
    };
  }

  public computeConfidence(input: ConfidenceEvaluationInput): ApexConfidenceScore {
    const { modelOutput, validationReport, qualityMetrics, topCandidates, frameAgreementRatio = 1.0 } = input;

    // Explicit abstention if vision provider was unavailable or vehicle is unknown
    if (modelOutput.abstentionReason === 'vision_provider_unavailable' || modelOutput.make === 'Unknown Make' || !validationReport.isValid) {
      return {
        totalScore: 0.0,
        isConfident: false,
        shouldAbstain: true,
        abstentionReason: modelOutput.abstentionReason || 'vision_provider_unavailable',
        breakdown: {
          visualSimilarityWeight: 0,
          modelAgreementWeight: 0,
          candidateMarginWeight: 0,
          frameAgreementWeight: 0,
          databaseConsistencyWeight: 0,
          qualityPenalty: 1.0
        }
      };
    }

    // 1. Visual Similarity Signal (Top candidate similarity)
    const topScore = topCandidates[0]?.visualSimilarityScore || 0.6;
    const secondScore = topCandidates[1]?.visualSimilarityScore || 0.3;
    const visualSignal = topScore;

    // 2. Model Agreement Signal
    const modelSignal = Math.max(0, Math.min(1.0, modelOutput.modelConfidence || 0.85));

    // 3. Candidate Margin Gap Signal
    const marginGap = Math.max(0, Math.min(1.0, (topScore - secondScore) * 2.0));

    // 4. Multi-Frame Agreement Signal
    const frameSignal = Math.max(0, Math.min(1.0, frameAgreementRatio));

    // 5. Database Consistency Signal: Registered or verified-unregistered vehicles get full consistency signal
    const isVerifiedUnregistered = Boolean((validationReport as any).isVerifiedUnregistered || (validationReport as any).canonicalIdentity?.registryStatus === 'VERIFIED_UNREGISTERED');
    const dbSignal = (validationReport.canonicalRecord || isVerifiedUnregistered) ? 1.0 : 0.6;

    // 6. Quality Penalties
    let qualityPenalty = 0;
    if (qualityMetrics.blurScore < 0.6) qualityPenalty += 0.15;
    if (qualityMetrics.luminanceScore < 0.5 || qualityMetrics.luminanceScore > 0.95) qualityPenalty += 0.10;
    const hasUnregisteredOnlyWarning = validationReport.validationWarnings.length === 1 &&
      validationReport.validationWarnings[0].includes('not registered in canonical database');
    if (validationReport.validationWarnings.length > 0 && !hasUnregisteredOnlyWarning) {
      qualityPenalty += 0.10;
    }

    // Compute Weighted Score
    const rawScore =
      this.weightVisualSimilarity * visualSignal +
      this.weightModelAgreement * modelSignal +
      this.weightCandidateMargin * marginGap +
      this.weightFrameAgreement * frameSignal +
      this.weightDatabaseConsistency * dbSignal -
      qualityPenalty;

    const totalScore = Math.max(0.01, Math.min(0.99, Number(rawScore.toFixed(3))));

    const isConfident = totalScore >= this.confidentThreshold;
    const shouldAbstain = totalScore < this.abstentionThreshold;

    let abstentionReason: string | undefined;
    if (shouldAbstain) {
      if (qualityMetrics.blurScore < 0.6) {
        abstentionReason = "Couldn't identify this car confidently due to motion blur. Try capturing when stationary.";
      } else if (marginGap < 0.15) {
        abstentionReason = "Couldn't distinguish between close vehicle trims. Try photographing the front badge or rear badge.";
      } else {
        abstentionReason = "Couldn't identify this car confidently. Try capturing from a front 3/4 angle.";
      }
    }

    return {
      totalScore,
      isConfident,
      shouldAbstain,
      abstentionReason,
      breakdown: {
        visualSimilarityWeight: Number((this.weightVisualSimilarity * visualSignal).toFixed(3)),
        modelAgreementWeight: Number((this.weightModelAgreement * modelSignal).toFixed(3)),
        candidateMarginWeight: Number((this.weightCandidateMargin * marginGap).toFixed(3)),
        frameAgreementWeight: Number((this.weightFrameAgreement * frameSignal).toFixed(3)),
        databaseConsistencyWeight: Number((this.weightDatabaseConsistency * dbSignal).toFixed(3)),
        qualityPenalty: Number(qualityPenalty.toFixed(3))
      }
    };
  }
}

export const confidenceEngine = new ConfidenceEngine();

