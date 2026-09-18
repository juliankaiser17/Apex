/**
 * APEX — Production-Grade AI Vehicle Identification Platform
 * Core Engine & Scalability Types
 */

import type { BodyStyle, RarityTier } from '../types/apex';

export type ScanPriority = 'HIGH' | 'NORMAL' | 'LOW';

export type ScanJobStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'needs_review' 
  | 'abstained' 
  | 'uncertain'
  | 'failed' 
  | 'dead_letter';

// ─── CANONICAL PRODUCTION RESULT CONTRACT ───
export type IdentificationStatus = 'identified' | 'probable' | 'uncertain' | 'rejected' | 'provider_unavailable';

export type VisionPipelineStatus =
  | 'VISION_IDENTIFIED'
  | 'VISION_PROBABLE'
  | 'VISION_UNCERTAIN'
  | 'VISION_REJECTED'
  | 'VISION_PROVIDER_UNAVAILABLE';

export type CanonicalRegistryStatus = 'REGISTERED' | 'VERIFIED_UNREGISTERED' | 'UNVERIFIED';

export type ContradictionScope =
  | 'GLOBAL_OBSERVATION_CONTRADICTION'
  | 'CANDIDATE_SPECIFIC_CONTRADICTION'
  | 'CANDIDATE_VARIANT_CONTRADICTION';

export interface ScopedContradiction {
  scope: ContradictionScope;
  targetCandidate?: string;
  description: string;
  confidence: number;
}

export interface CandidateAssessment {
  candidate: string;
  supportingEvidence: string[];
  contradictions: string[];
  candidateScore: number;
}

export interface EvidenceProvenance {
  visual_evidence: string[];
  text_evidence: string[];
  registry_metadata: string[];
  candidate_retrieval: string[];
  deterministic_validation: string[];
}

export interface OpenCanonicalIdentity {
  canonicalId: string;
  make: string;
  modelFamily: string;
  generation?: string | null;
  variant?: string | null;
  registryStatus: CanonicalRegistryStatus;
  source: 'gemini' | 'registry' | 'offline_model' | 'ensemble';
  specs?: Record<string, any>;
}

export type ViewpointType =
  | 'front'
  | 'rear'
  | 'side'
  | 'front_3q'
  | 'rear_3q'
  | 'interior'
  | 'partial'
  | 'multiple_vehicles'
  | 'unknown';

export interface VisualEvidence {
  body_style: string | null;
  grille: string | null;
  headlights: string | null;
  taillights: string | null;
  hood: string | null;
  roofline: string | null;
  windows: string | null;
  wheels: string | null;
  exhaust: string | null;
  aero: string | null;
  badges: string | null;
  text: string | null;
  body_proportions: string | null;
  distinctive_details: string[] | null;
}

export interface HierarchicalIdentification {
  make: string | null;
  model_family: string | null;
  generation: string | null;
  variant: string | null;
}

export interface HierarchicalConfidence {
  make_score: number;
  model_score: number;
  generation_score: number;
  variant_score: number;
  overall_score: number;
}

export interface CandidateComparison {
  name: string;
  score: number;
  supporting_evidence: string[];
  contradictions: string[];
  unobservable_features?: string[];
}

export interface VisionEvidence {
  provider: string;
  model: string;
  raw_identity: string;
  make: string | null;
  model_family: string | null;
  generation: string | null;
  variant: string | null;
  confidence: number;
  visual_evidence: VisualEvidence;
  textual_evidence: string[];
  viewpoint: ViewpointType;
  image_quality: {
    usable: boolean;
    score: number;
    issues: string[];
  };
  candidate_hypotheses: CandidateComparison[];
  timestamp: number;
}

export type ImmutableUpstreamEvidence = Readonly<VisionEvidence>;

export type SpecificityLevel = 'make' | 'model_family' | 'generation' | 'variant';

export interface CanonicalScanResult {
  status: IdentificationStatus;
  vehicle_present: boolean;
  image_quality: {
    usable: boolean;
    score: number;
    issues: string[];
  };
  viewpoint: ViewpointType;
  visual_evidence: VisualEvidence;
  identification: HierarchicalIdentification;
  confidence: HierarchicalConfidence;
  candidates: CandidateComparison[];
  contradictions: string[];
  specificity_level: SpecificityLevel;
  reason: string;
  needs_retake: boolean;
  needs_review?: boolean;
  upstream_evidence?: ImmutableUpstreamEvidence;
  provenance?: EvidenceProvenance;
  canonical_identity?: OpenCanonicalIdentity;
  specs?: {
    color?: string;
    rarity?: RarityTier;
    year_estimate?: string;
    engine?: string;
    horsepower?: number;
    torque_nm?: number;
    top_speed_kmh?: number;
    zero_to_hundred_seconds?: number;
    kerb_weight_kg?: number;
    production_years?: string;
    origin_country?: string;
    body_style?: BodyStyle;
    historical_information?: string;
    interesting_facts?: string;
    market_value_low_usd?: number;
    market_value_high_usd?: number;
  };
  privacy_redactions?: Array<{ type: 'plate' | 'face'; box_2d: [number, number, number, number] }>;
  scan_id?: string;
  trace_id?: string;
  processing_ms?: number;
}

export interface ScanQualityMetrics {
  isUsable: boolean;
  blurScore: number; // 0 (very blurry) - 1.0 (crystal sharp)
  luminanceScore: number; // 0 (pitch black) - 1.0 (well exposed)
  contrastScore: number; // 0 (flat) - 1.0 (good contrast)
  aspectRatio: number;
  vehicleBoundingEstimated: boolean;
  rejectionReason?: string;
  issues?: string[];
  viewpoint?: ViewpointType;
  authenticity?: 'real_photograph' | 'screen_photograph' | 'screenshot' | 'ai_generated' | 'manipulated' | 'uncertain';
}

export interface CandidateVehicle {
  vehicleId: string;
  make: string;
  model: string;
  generation: string;
  trim?: string;
  bodyStyle: BodyStyle;
  yearStart: number;
  yearEnd?: number;
  visualSimilarityScore: number; // 0.0 - 1.0
  distinguishingFeatures: string[];
  referenceImageUrl?: string;
}

export interface AftermarketModification {
  partName: string;
  brand?: string | null;
  description: string;
  confidence: number;
}

export interface ModelIdentificationOutput {
  vehicleId: string | null;
  make: string | null;
  model: string | null;
  generation: string | null;
  trim: string | null;
  yearEstimate: string;
  color: string;
  rarity: RarityTier;
  engine: string;
  horsepower: number;
  torqueNm: number;
  topSpeedKmH: number;
  zeroToHundredSec: number;
  kerbWeightKg: number;
  productionYears: string;
  originCountry: string;
  bodyStyle: BodyStyle;
  historicalInformation: string;
  interestingFacts: string;
  aftermarketPartsDetected: AftermarketModification[];
  modelConfidence: number; // 0.0 - 1.0
  evidence: string[];
  alternatives: Array<{ vehicleId: string; score: number; reason: string }>;
  needsReview: boolean;
  abstentionReason?: string;
  marketValueLowUsd?: number;
  marketValueHighUsd?: number;
  privacyRedactions?: Array<{ type: 'plate' | 'face'; box2d: [number, number, number, number] }>;
}

export interface ApexConfidenceScore {
  totalScore: number; // 0.0 - 1.0 (Authoritative Apex confidence)
  isConfident: boolean;
  shouldAbstain: boolean;
  abstentionReason?: string;
  breakdown: {
    visualSimilarityWeight: number;
    modelAgreementWeight: number;
    candidateMarginWeight: number;
    frameAgreementWeight: number;
    databaseConsistencyWeight: number;
    qualityPenalty: number;
  };
}

export interface IdentificationResult {
  scanId: string;
  idempotencyKey: string;
  userId: string;
  status: ScanJobStatus;
  canonicalVehicleId?: string;
  make: string | null;
  model: string | null;
  generation: string | null;
  trim?: string | null;
  yearEstimate: string;
  color: string;
  rarity: RarityTier;
  engine: string;
  horsepower: number;
  torqueNm: number;
  topSpeedKmH: number;
  zeroToHundredSec: number;
  kerbWeightKg: number;
  productionYears: string;
  originCountry: string;
  bodyStyle: BodyStyle;
  historicalInformation: string;
  interestingFacts: string;
  aftermarketPartsDetected: AftermarketModification[];
  confidence: ApexConfidenceScore;
  quality: ScanQualityMetrics;
  topCandidates: CandidateVehicle[];
  processedAt: string;
  processingDurationMs: number;
  modelVersion: string;
  promptVersion: string;
  pipelineVersion: string;
  cached: boolean;
  traceId: string;
  canonicalResult?: CanonicalScanResult;
}

export interface ScanJob {
  id: string;
  idempotencyKey: string;
  userId: string;
  clientIp?: string;
  priority: ScanPriority;
  status: ScanJobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  imageDataUrl: string;
  imageHash: string;
  multiFrames?: string[];
  fileName?: string;
  result?: IdentificationResult;
  error?: string;
  lastErrorType?: '429' | '5xx' | 'TIMEOUT' | 'QUALITY' | 'SCHEMA' | 'INTERNAL';
  traceId: string;
  pipelineVersion: string;
  disableFallback?: boolean;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderCapacityConfig {
  providerName: string;
  primaryModel: string;
  secondaryModel?: string;
  rpmLimit: number;
  tpmLimit: number;
  maxConcurrency: number;
  timeoutMs: number;
  costPerScanUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  enabled: boolean;
}

export interface TelemetryMetrics {
  activeWorkers: number;
  queueDepth: {
    high: number;
    normal: number;
    low: number;
    total: number;
  };
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  requestsPerSecond: number;
  totalScansProcessed: number;
  successfulScans: number;
  abstainedScans: number;
  failedScans: number;
  deadLetterCount: number;
  cacheHitCount: number;
  cacheHitRatio: number;
  rateLimitErrorsCount: number;
  serverErrorsCount: number;
  circuitBreakerStatus: CircuitBreakerState;
  currentAiConcurrency: number;
  estimatedCostTodayUsd: number;
  topAccuracyEstimate: number;
}
