/**
 * APEX — Production-Grade Local Rarity Engine v2
 * 
 * Aggregated, confidence-weighted Local Sighting Prevalence Model with Bayesian Dirichlet-Multinomial
 * shrinkage toward global baselines.
 * 
 * CORE PRODUCT DISTINCTIONS:
 * 1. GLOBAL RARITY: Universal baseline uncommonness across Apex's entire vehicle taxonomy.
 * 2. LOCAL SIGHTING RARITY: How uncommon eligible Apex sightings of that vehicle are within
 *    the user's coarse broader area.
 * 3. APEX OBSERVED PREVALENCE vs REAL-WORLD PREVALENCE: The engine exclusively models observed
 *    sightings among eligible, verified Apex users. It does NOT claim to represent a census
 *    of all physical motor vehicles in existence.
 * 
 * Pipeline order:
 * Global Baseline -> Bayesian Smoothing -> Confidence Gating -> Contributor Weighting ->
 * Local/Global Blend -> Rarity Tier -> Bounded Economy XP Modifier
 */

import type { RarityTier } from '../types/apex';

export type LocalConfidenceState = 
  | 'LOCAL_UNKNOWN'
  | 'LOCAL_EMERGING'
  | 'LOCAL_ESTABLISHED'
  | 'LOCAL_HIGH_CONFIDENCE';

export interface GlobalTierSpec {
  score: number;
  prevalencePrior: number;
  tierRank: number; // 0: common to 5: mythic
}

export const GLOBAL_TIER_SPECS: Record<RarityTier, GlobalTierSpec> = {
  common:    { score: 15, prevalencePrior: 0.5000, tierRank: 0 },
  uncommon:  { score: 35, prevalencePrior: 0.2000, tierRank: 1 },
  rare:      { score: 55, prevalencePrior: 0.0600, tierRank: 2 },
  epic:      { score: 75, prevalencePrior: 0.0150, tierRank: 3 },
  legendary: { score: 88, prevalencePrior: 0.0030, tierRank: 4 },
  mythic:    { score: 98, prevalencePrior: 0.0005, tierRank: 5 }
};

// ────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE v2 CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

export const LOCAL_RARITY_CONFIG = {
  MODEL_VERSION: 2,
  BAYESIAN_PRIOR_WEIGHT_ALPHA: 30, // 30 pseudo-observations of the global prior
  MAX_XP_PER_SCAN: 2000,
  MIN_XP_PER_SCAN: 10,
  DEFAULT_HALF_LIFE_DAYS: 90,

  // Confidence Gating Thresholds
  UNKNOWN_OBS_THRESHOLD: 15,
  UNKNOWN_USER_THRESHOLD: 3,
  EMERGING_OBS_THRESHOLD: 50,
  EMERGING_USER_THRESHOLD: 6,
  ESTABLISHED_OBS_THRESHOLD: 200,
  ESTABLISHED_USER_THRESHOLD: 12,

  // Contributor Weighting & Saturation
  MAX_CONTRIBUTOR_MASS_PER_VEHICLE: 3.0, // Maximum cumulative observation mass from one user per vehicle in an area
  
  // Prevalence Ratio Clamping (Prevents log explosion)
  MIN_PREVALENCE_RATIO_CLAMP: 0.02,
  MAX_PREVALENCE_RATIO_CLAMP: 50.0,

  // Economy Bounds
  MIN_XP_MODIFIER: 0.90,
  MAX_XP_MODIFIER: 1.50
} as const;

// Backward-compatible exports
export const MODEL_VERSION = LOCAL_RARITY_CONFIG.MODEL_VERSION;
export const BAYESIAN_PRIOR_WEIGHT_ALPHA = LOCAL_RARITY_CONFIG.BAYESIAN_PRIOR_WEIGHT_ALPHA;
export const MAX_XP_PER_SCAN = LOCAL_RARITY_CONFIG.MAX_XP_PER_SCAN;
export const MIN_XP_PER_SCAN = LOCAL_RARITY_CONFIG.MIN_XP_PER_SCAN;
export const DEFAULT_HALF_LIFE_DAYS = LOCAL_RARITY_CONFIG.DEFAULT_HALF_LIFE_DAYS;

export interface LocalRarityInput {
  canonicalVehicleId: string;
  globalRarity: RarityTier;
  globalRarityScore?: number;
  localObservationMass: number; // C_{v, B}: weighted observations of this car in bucket
  bucketTotalMass: number;      // N_B: total weighted observations in bucket
  uniqueContributors: number;   // K_{v, B}: distinct users spotting this vehicle in bucket
  bucketUniqueContributors?: number; // K_B: total distinct contributors in bucket
  activeDays?: number;
  geographyBucketId?: string;
  coarseAreaName?: string;
}

/**
 * Structured internal debugging instrument for staff engineers & telemetry auditing.
 */
export interface RarityExplanationDebug {
  canonicalVehicleId: string;
  coarseAreaName: string;
  geographyBucketId?: string;
  globalRarityTier: RarityTier;
  globalRarityScore: number;
  globalPrevalencePrior: number;
  localObservationMass: number;
  bucketTotalMass: number;
  uniqueContributors: number;
  bucketTotalContributors: number;
  confidenceState: LocalConfidenceState;
  confidenceWeight: number;
  localSightingPrevalence: number;
  prevalenceRatio: number;
  rawLocalScore: number;
  blendedScore: number;
  localRarityTier: RarityTier;
  localXpModifier: number;
  localBonusXp: number;
  modelVersion: number;
  priorWeightAlpha: number;
  decisionReason: string;
  calculatedAt: string;
}

export interface LocalRarityCalculationResult {
  localRarityTier: RarityTier;
  localRarityScore: number; // Clamped [10, 98]
  globalRarityTier: RarityTier;
  globalRarityScore: number;
  confidenceState: LocalConfidenceState;
  confidenceWeight: number; // 0.0 to 1.0
  localPrevalence: number;  // P_{local}
  globalPrevalencePrior: number; // P_{global}
  prevalenceRatio: number;  // R = P_{local} / P_{global}
  localXpModifier: number;  // Bounded [0.90, 1.50]
  explanation: string;
  coarseAreaName: string;
  modelVersion: number;
  debug?: RarityExplanationDebug;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. DETERMINISTIC PRIVACY-PRESERVING GEOHASH-5 ENCODER
// ────────────────────────────────────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes latitude & longitude into a standard 5-character Geohash.
 * Cell dimensions vary with latitude (~4.9km tall, width ~4.9km * cos(lat), yielding ~12km² to ~25km²).
 * Completely deterministic, zero network requests, zero precision leakage.
 */
export function encodeCoarseGeohash(lat: number, lng: number, precision: number = 5): string {
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return 'global';
  }

  let latMin = -90.0;
  let latMax = 90.0;
  let lngMin = -180.0;
  let lngMax = 180.0;

  let isEven = true;
  let bit = 0;
  let ch = 0;
  let geohash = '';

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Derives a human-friendly coarse area label (e.g. "Tokyo Broader Area", "Kanpur Broader Area")
 * without ever revealing specific streets, neighborhoods, exact user coordinates, or tiny cells.
 */
export function getCoarseAreaName(city?: string, country?: string, geohash?: string): string {
  const cleanCity = city?.trim();
  const cleanCountry = country?.trim();

  if (cleanCity && cleanCity.toLowerCase() !== 'your city' && cleanCity.toLowerCase() !== 'local area') {
    return `${cleanCity} Broader Area`;
  }
  if (cleanCountry && cleanCountry.toLowerCase() !== 'global') {
    return `${cleanCountry} Region`;
  }
  if (geohash && geohash !== 'global') {
    return `Area ${geohash.toUpperCase()}`;
  }
  return 'Your Broader Area';
}

// ────────────────────────────────────────────────────────────────────────────
// 2. CONTRIBUTOR-WEIGHTING & SATURATION PROTECTION
// ────────────────────────────────────────────────────────────────────────────

export interface ContributorWeightResult {
  weight: number;
  isFirstContributorSighting: boolean;
  cumulativeMassAfter: number;
}

/**
 * Calculates contributor-diminishing weight for a sighting submission.
 * - Sublinear scaling: weight = 1 / sqrt(k) where k is the user's k-th spot of this vehicle model in this area.
 * - Exact image replay receives 0.0 weight.
 * - Capped at MAX_CONTRIBUTOR_MASS_PER_VEHICLE cumulative mass from any single user.
 * - Only k=1 establishes new contributor diversity.
 */
export function calculateContributorDiminishingWeight(
  userPriorSightingsOfModelInBucket: number,
  userPriorMassOfModelInBucket: number,
  isExactImageDuplicate: boolean = false
): ContributorWeightResult {
  if (isExactImageDuplicate) {
    return {
      weight: 0.0,
      isFirstContributorSighting: false,
      cumulativeMassAfter: userPriorMassOfModelInBucket
    };
  }

  const k = Math.max(0, userPriorSightingsOfModelInBucket) + 1;
  const isFirstContributorSighting = k === 1;

  // Sublinear diminishing return factor
  const rawDiminishingWeight = 1.0 / Math.sqrt(k);

  // Remaining budget under cumulative single-user cap
  const remainingBudget = Math.max(
    0.0,
    LOCAL_RARITY_CONFIG.MAX_CONTRIBUTOR_MASS_PER_VEHICLE - userPriorMassOfModelInBucket
  );

  const grantedWeight = Math.max(0.0, Math.min(rawDiminishingWeight, remainingBudget));
  const roundedWeight = Number(grantedWeight.toFixed(4));
  const newCumulativeMass = Number((userPriorMassOfModelInBucket + roundedWeight).toFixed(4));

  return {
    weight: roundedWeight,
    isFirstContributorSighting,
    cumulativeMassAfter: newCumulativeMass
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. BAYESIAN PREVALENCE & SHRINKAGE MODEL
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates smoothed local sighting prevalence using Dirichlet-Multinomial conjugate prior.
 * P_{local} = (C_{v, B} + alpha * P_{global}) / (N_B + alpha)
 * 
 * Mathematical Invariants:
 * - As N_B -> 0, P_{local} -> P_{global} (zero false rarity under zero data)
 * - As N_B -> infinity, P_{local} -> C_{v, B} / N_B (empirical prevalence dominates)
 * - Always strictly in (0, 1), guaranteed non-NaN and finite.
 */
export function calculateSmoothedPrevalence(
  localCount: number,
  bucketTotalMass: number,
  globalPrior: number,
  alpha: number = LOCAL_RARITY_CONFIG.BAYESIAN_PRIOR_WEIGHT_ALPHA
): number {
  const safeLocalCount = Math.max(0, localCount);
  const safeTotalMass = Math.max(0, bucketTotalMass);
  const safeGlobalPrior = Math.max(0.0001, Math.min(0.9999, globalPrior));
  const safeAlpha = Math.max(1, alpha);

  const numerator = safeLocalCount + (safeAlpha * safeGlobalPrior);
  const denominator = safeTotalMass + safeAlpha;

  return numerator / denominator;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. CONFIDENCE STATE & GATING
// ────────────────────────────────────────────────────────────────────────────

/**
 * Determines statistical confidence tier and blending weight (0.0 to 1.0)
 * based on sample mass and contributor diversity.
 * 
 * Strict Gating Invariant:
 * N < 15 OR K < 3 -> LOCAL_UNKNOWN (confidence weight = 0.0, 100% global prior fallback)
 */
export function determineConfidenceState(
  bucketTotalMass: number,
  uniqueContributors: number,
  bucketContributors?: number
): { confidenceState: LocalConfidenceState; confidenceWeight: number } {
  const totalObs = Math.max(0, bucketTotalMass);
  const totalUsers = Math.max(0, bucketContributors ?? uniqueContributors);

  // Tier 1: Sparse data -> 0% local weight, fallback entirely to global
  if (totalObs < LOCAL_RARITY_CONFIG.UNKNOWN_OBS_THRESHOLD || totalUsers < LOCAL_RARITY_CONFIG.UNKNOWN_USER_THRESHOLD) {
    return {
      confidenceState: 'LOCAL_UNKNOWN',
      confidenceWeight: 0.0
    };
  }

  // Tier 2: Emerging data -> Light local influence (15% to 35%)
  if (totalObs < LOCAL_RARITY_CONFIG.EMERGING_OBS_THRESHOLD || totalUsers < LOCAL_RARITY_CONFIG.EMERGING_USER_THRESHOLD) {
    const obsProgress = (totalObs - LOCAL_RARITY_CONFIG.UNKNOWN_OBS_THRESHOLD) / 
      (LOCAL_RARITY_CONFIG.EMERGING_OBS_THRESHOLD - LOCAL_RARITY_CONFIG.UNKNOWN_OBS_THRESHOLD);
    const userProgress = Math.min(1.0, totalUsers / LOCAL_RARITY_CONFIG.EMERGING_USER_THRESHOLD);
    const weight = 0.15 + (0.20 * obsProgress * userProgress);
    return {
      confidenceState: 'LOCAL_EMERGING',
      confidenceWeight: Number(Math.max(0.0, Math.min(0.35, weight)).toFixed(3))
    };
  }

  // Tier 3: Established local data -> Meaningful local influence (40% to 70%)
  if (totalObs < LOCAL_RARITY_CONFIG.ESTABLISHED_OBS_THRESHOLD || totalUsers < LOCAL_RARITY_CONFIG.ESTABLISHED_USER_THRESHOLD) {
    const obsProgress = (totalObs - LOCAL_RARITY_CONFIG.EMERGING_OBS_THRESHOLD) / 
      (LOCAL_RARITY_CONFIG.ESTABLISHED_OBS_THRESHOLD - LOCAL_RARITY_CONFIG.EMERGING_OBS_THRESHOLD);
    const userProgress = Math.min(1.0, totalUsers / LOCAL_RARITY_CONFIG.ESTABLISHED_USER_THRESHOLD);
    const weight = 0.40 + (0.30 * obsProgress * userProgress);
    return {
      confidenceState: 'LOCAL_ESTABLISHED',
      confidenceWeight: Number(Math.max(0.0, Math.min(0.70, weight)).toFixed(3))
    };
  }

  // Tier 4: High confidence -> Full authoritative local rarity
  return {
    confidenceState: 'LOCAL_HIGH_CONFIDENCE',
    confidenceWeight: 1.0
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SCARCITY SCORE & TIER DERIVATION
// ────────────────────────────────────────────────────────────────────────────

export function getTierFromScore(score: number): RarityTier {
  if (score >= 95) return 'mythic';
  if (score >= 82) return 'legendary';
  if (score >= 68) return 'epic';
  if (score >= 50) return 'rare';
  if (score >= 30) return 'uncommon';
  return 'common';
}

// ────────────────────────────────────────────────────────────────────────────
// 6. BOUNDED LOCAL XP MODIFIER
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates bounded XP modifier (0.90x to 1.50x) based on local rarity tier elevation
 * and statistical confidence weight.
 */
export function calculateLocalXpModifier(
  localTier: RarityTier,
  globalTier: RarityTier,
  confidenceWeight: number
): number {
  const localRank = GLOBAL_TIER_SPECS[localTier]?.tierRank ?? 0;
  const globalRank = GLOBAL_TIER_SPECS[globalTier]?.tierRank ?? 0;
  const delta = localRank - globalRank;

  if (confidenceWeight <= 0.0 || delta === 0) {
    return 1.0;
  }

  if (delta > 0) {
    // Car is rarer among local sightings -> positive bonus (capped at +50% at high confidence)
    const rawBonus = delta * 0.15;
    const weightedBonus = rawBonus * confidenceWeight;
    const modifier = 1.0 + Math.min(0.50, weightedBonus);
    return Number(modifier.toFixed(3));
  } else {
    // Car is more common among local sightings -> modest negative moderation (down to 0.90x floor)
    const rawReduction = Math.abs(delta) * 0.05;
    const weightedReduction = rawReduction * confidenceWeight;
    const modifier = Math.max(LOCAL_RARITY_CONFIG.MIN_XP_MODIFIER, 1.0 - weightedReduction);
    return Number(modifier.toFixed(3));
  }
}

/**
 * Applies bounded XP with upper/lower caps.
 */
export function calculateFinalAwardedXp(
  baseXp: number, 
  localModifier: number, 
  cap: number = LOCAL_RARITY_CONFIG.MAX_XP_PER_SCAN
): number {
  const rawXp = Math.round(baseXp * localModifier);
  return Math.min(cap, Math.max(LOCAL_RARITY_CONFIG.MIN_XP_PER_SCAN, rawXp));
}

// ────────────────────────────────────────────────────────────────────────────
// 7. TEMPORAL DECAY HELPER
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculates exponentially decayed observation weight based on age in days.
 * weight = originalWeight * 2^(-ageDays / halfLifeDays)
 */
export function calculateDecayedWeight(
  originalWeight: number,
  ageDays: number,
  halfLifeDays: number = LOCAL_RARITY_CONFIG.DEFAULT_HALF_LIFE_DAYS
): number {
  if (ageDays <= 0) return originalWeight;
  const decayFactor = Math.pow(2, -ageDays / halfLifeDays);
  return Number((originalWeight * decayFactor).toFixed(4));
}

// ────────────────────────────────────────────────────────────────────────────
// 8. PRIMARY LOCAL RARITY ENGINE v2
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computes complete local sighting prevalence and rarity analysis.
 */
export function calculateLocalRarity(input: LocalRarityInput): LocalRarityCalculationResult {
  const {
    canonicalVehicleId,
    globalRarity,
    localObservationMass,
    bucketTotalMass,
    uniqueContributors,
    bucketUniqueContributors,
    coarseAreaName = 'Your Broader Area',
    geographyBucketId
  } = input;

  const globalSpec = GLOBAL_TIER_SPECS[globalRarity] || GLOBAL_TIER_SPECS.rare;
  const globalScore = input.globalRarityScore ?? globalSpec.score;
  const globalPrior = globalSpec.prevalencePrior;

  // 1. Bayesian Dirichlet-Multinomial Smoothing
  const localPrevalence = calculateSmoothedPrevalence(
    localObservationMass,
    bucketTotalMass,
    globalPrior,
    LOCAL_RARITY_CONFIG.BAYESIAN_PRIOR_WEIGHT_ALPHA
  );

  // 2. Confidence State & Weight
  const { confidenceState, confidenceWeight } = determineConfidenceState(
    bucketTotalMass,
    uniqueContributors,
    bucketUniqueContributors
  );

  // 3. Prevalence Ratio & Raw Local Scarcity Score
  const rawRatio = localPrevalence / globalPrior;
  const clampedRatio = Math.max(
    LOCAL_RARITY_CONFIG.MIN_PREVALENCE_RATIO_CLAMP,
    Math.min(LOCAL_RARITY_CONFIG.MAX_PREVALENCE_RATIO_CLAMP, rawRatio)
  );
  const prevalenceRatio = Number(clampedRatio.toFixed(4));

  // Logarithmic Scarcity Adjustment: -25 * log2(R)
  const logRatio = Math.log2(clampedRatio);
  const rawLocalScore = Math.max(10, Math.min(98, Math.round(globalScore - (25 * logRatio))));

  // 4. Local/Global Blend based on Confidence Weight
  const blendedScore = Math.max(10, Math.min(98, Math.round(
    ((1 - confidenceWeight) * globalScore) + (confidenceWeight * rawLocalScore)
  )));

  // 5. Final Derived Local Rarity Tier
  const localRarityTier = getTierFromScore(blendedScore);

  // 6. Bounded XP Modifier
  const localXpModifier = calculateLocalXpModifier(localRarityTier, globalRarity, confidenceWeight);

  // 7. Human-readable explanation with strict sparse-data privacy
  let explanation: string;
  let decisionReason: string;

  if (confidenceState === 'LOCAL_UNKNOWN') {
    // Privacy Safeguard: In sparse areas, return generalized text without exposing exact spotter counts
    explanation = `Not enough local sighting data in your broader area yet. Universal rarity applies.`;
    decisionReason = `Insufficient local sighting evidence (N=${bucketTotalMass.toFixed(1)}, K=${uniqueContributors}). 100% global baseline preserved.`;
  } else if (confidenceState === 'LOCAL_EMERGING') {
    explanation = `Emerging sighting pattern in ${coarseAreaName}: ${localObservationMass.toFixed(0)} sightings verified across ${uniqueContributors} spotters.`;
    decisionReason = `Emerging local pattern (${confidenceWeight.toFixed(2)} blend weight).`;
  } else if (confidenceState === 'LOCAL_ESTABLISHED') {
    explanation = `Established sighting pattern in ${coarseAreaName}: ${localRarityTier.toUpperCase()} based on regional sighting frequency.`;
    decisionReason = `Established local pattern (${confidenceWeight.toFixed(2)} blend weight).`;
  } else {
    explanation = `High-confidence regional pattern in ${coarseAreaName}: ${localRarityTier.toUpperCase()} based on extensive sighting history.`;
    decisionReason = `Authoritative high-confidence regional pattern (1.00 local weight).`;
  }

  // 8. Structured Forensic Debug Object
  const debug: RarityExplanationDebug = {
    canonicalVehicleId,
    coarseAreaName,
    geographyBucketId,
    globalRarityTier: globalRarity,
    globalRarityScore: globalScore,
    globalPrevalencePrior: globalPrior,
    localObservationMass,
    bucketTotalMass,
    uniqueContributors,
    bucketTotalContributors: bucketUniqueContributors ?? uniqueContributors,
    confidenceState,
    confidenceWeight,
    localSightingPrevalence: Number(localPrevalence.toFixed(6)),
    prevalenceRatio,
    rawLocalScore,
    blendedScore,
    localRarityTier,
    localXpModifier,
    localBonusXp: Math.max(0, Math.round((localXpModifier - 1.0) * globalScore * 10)),
    modelVersion: LOCAL_RARITY_CONFIG.MODEL_VERSION,
    priorWeightAlpha: LOCAL_RARITY_CONFIG.BAYESIAN_PRIOR_WEIGHT_ALPHA,
    decisionReason,
    calculatedAt: new Date().toISOString()
  };

  return {
    localRarityTier,
    localRarityScore: blendedScore,
    globalRarityTier: globalRarity,
    globalRarityScore: globalScore,
    confidenceState,
    confidenceWeight,
    localPrevalence: Number(localPrevalence.toFixed(6)),
    globalPrevalencePrior: globalPrior,
    prevalenceRatio,
    localXpModifier,
    explanation,
    coarseAreaName,
    modelVersion: LOCAL_RARITY_CONFIG.MODEL_VERSION,
    debug
  };
}

export { LocalRarityCache, localRarityCache } from './localRarityCache';
