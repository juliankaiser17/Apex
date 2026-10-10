/**
 * APEX AI Identification — v2 Architecture Types & Data Contracts
 */

import type { ViewpointType } from '../types';
import type { BodyStyle, RarityTier } from '../../types/apex';

export type V2ResolutionStatus =
  | 'identified'
  | 'identified_model'
  | 'needs_more_views'
  | 'uncertain'
  | 'rejected'
  | 'not_in_catalogue';

export interface ImageQualityMetrics {
  isVehiclePresent: boolean;
  blurScore: number; // 0.0 (very blurry) to 1.0 (sharp)
  brightnessScore: number; // 0.0 (pitch black) to 1.0 (well exposed)
  occlusionScore: number; // 0.0 (completely occluded) to 1.0 (unobstructed)
  estimatedViewpoint: ViewpointType;
  cropBox?: { x: number; y: number; width: number; height: number };
  licensePlateDetected: boolean;
  faceDetected: boolean;
  rejectionReason?: string;
}

export interface GalleryCandidate {
  canonicalId: string;
  make: string;
  model: string;
  generation: string;
  variant: string | null;
  displayName: string;
  similarityScore: number; // 0.0 to 1.0
  viewpointAlignment: number; // 0.0 to 1.0
  distinguishingFeatures: string[];
  referenceThumbnail?: string;
}

export interface RetrievalResult {
  topCandidates: GalleryCandidate[];
  isDecisive: boolean; // True if margin between #1 and #2 >= threshold
  bestDistance: number;
  isOpenSetAnomaly: boolean; // True if best distance exceeds open-set threshold
  marginToSecond: number;
}

export type AdjudicationOutcome =
  | 'successful_identification'
  | 'valid_abstention'
  | 'provider_failure'
  | 'invalid_response'
  | 'skipped_adjudication';

export interface VlmAdjudicationOutput {
  outcome: AdjudicationOutcome;
  chosenCandidateId: string | 'none';
  decidingCues: string[];
  legibleBadgeText: string | null;
  rawConfidence: number;
  vlmCallsMade: number;
  tokensConsumed?: number;
  latencyMs: number;
  providerUsed?: string;
  modelUsed?: string;
  isFallback?: boolean;
  error?: string;
  failureReason?: string;
}

export interface CalibratedConfidence {
  make: number;
  model: number;
  generation: number;
  variant: number;
  overall: number;
}

export interface GuidedRecoveryInfo {
  currentAngle: ViewpointType;
  missingCues: string[];
  suggestedView: 'rear' | 'roofline_side' | 'front_fascia' | 'badge_closeup';
  userPrompt: string;
}

export interface VerifiedVehicleSpecs {
  horsepower: number;
  torqueNm: number;
  topSpeedKmH: number;
  zeroToHundredSec: number;
  kerbWeightKg: number;
  engine: string;
  displacementCc?: number;
  aspiration?: string;
  drivetrain?: string;
  transmission?: string;
  productionYears: string;
  originCountry: string;
  bodyStyle: BodyStyle;
  baselineRarity: RarityTier;
  marketValueEstimate?: number;
  sources: string[];
  verifiedDate: string;
  verifier: string;
}

export interface V2IdentificationResult {
  status: V2ResolutionStatus;
  canonicalVehicleId: string | null;
  make: string | null;
  model: string | null;
  generation: string | null;
  variant: string | null;
  displayName: string;
  calibratedConfidence: CalibratedConfidence;
  verifiedSpecs: VerifiedVehicleSpecs | null;
  guidedRecovery?: GuidedRecoveryInfo;
  candidateOptions?: Array<{
    canonicalId: string;
    displayName: string;
    variant: string | null;
    confidenceScore: number;
    distinguishingFeatures: string[];
  }>;
  retrievalStage: RetrievalResult;
  adjudicationStage?: VlmAdjudicationOutput;
  qualityStage: ImageQualityMetrics;
  sessionFrameCount: number;
  totalLatencyMs: number;
  estimatedCostUsd: number;
  vlmCallsCount: number;
  traceId: string;
}
