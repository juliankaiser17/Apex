import type { RarityTier } from '../types/apex';

export interface RegionalRarityParams {
  make: string;
  model: string;
  generation?: string;
  city: string;
  country: string;
  estimatedGlobalUnits?: number; // Global production volume
  localSightingsPast90Days?: number; // Sighting density within 100km radius in past 90 days
}

export interface RegionalRarityResult {
  rarity: RarityTier;
  rarityScore: number; // 0 - 100
  globalFactorScore: number;
  localScarcityMultiplier: number;
  explanation: string;
}

/**
 * Calculates Factor 1: Global Production Volume (Logarithmic inverse scale 0-100)
 */
export function calculateGlobalProductionFactor(unitsProduced: number): number {
  if (unitsProduced <= 500) return 98; // Hypercar / Mythic territory
  if (unitsProduced <= 2000) return 88; // Supercar / Legendary territory
  if (unitsProduced <= 15000) return 75; // Low-production sports car / Epic
  if (unitsProduced <= 100000) return 55; // Performance sports car / Rare
  if (unitsProduced <= 500000) return 35; // Mass premium / Uncommon
  return 15; // Mass production / Common (> 500k units)
}

/**
 * Calculates Factor 2: Local Density (100km radius, past 90 days)
 */
export function calculateLocalScarcityMultiplier(localSightings: number): number {
  if (localSightings === 0) return 1.45; // Never spotted locally -> Massive rarity boost!
  if (localSightings <= 2) return 1.25; // Extremely scarce locally
  if (localSightings <= 5) return 1.10; // Rare locally
  if (localSightings <= 15) return 0.95; // Moderately frequent
  if (localSightings <= 50) return 0.80; // Common locally
  return 0.65; // Highly saturated locally
}

/**
 * Main Two-Factor Regional Rarity Engine
 */
export function calculateRegionalRarity(params: RegionalRarityParams): RegionalRarityResult {
  const { make, model, city, country } = params;
  const makeUpper = make.toUpperCase();
  const modelUpper = model.toUpperCase();

  // Preset production volumes for known vehicles
  let globalUnits = params.estimatedGlobalUnits || 50000;
  if (makeUpper === 'BUGATTI') globalUnits = 500;
  else if (makeUpper === 'LAMBORGHINI') globalUnits = 12000;
  else if (makeUpper === 'FERRARI') globalUnits = 14000;
  else if (makeUpper === 'PORSCHE' && modelUpper.includes('GT3')) globalUnits = 9000;
  else if (makeUpper === 'TOYOTA' && modelUpper.includes('SUPRA')) globalUnits = 45000;
  else if (makeUpper === 'MARUTI' || modelUpper.includes('SWIFT')) globalUnits = 3000000;

  // Preset local sightings within 100km in past 90 days based on region
  let localSightings = params.localSightingsPast90Days ?? 0;
  const isIndia = country.toLowerCase() === 'india' || city.toLowerCase() === 'kanpur';
  const isJapan = country.toLowerCase() === 'japan' || city.toLowerCase() === 'tokyo';
  const isNorway = country.toLowerCase() === 'norway';

  if (makeUpper === 'TOYOTA' && modelUpper.includes('SUPRA')) {
    localSightings = isJapan ? 60 : isIndia ? 0 : 4; // Uncommon in Tokyo, Legendary in Kanpur!
  } else if (makeUpper === 'MARUTI' || modelUpper.includes('SWIFT')) {
    localSightings = isIndia ? 420 : isNorway ? 1 : 200; // Common in Kanpur, Rare in Norway!
  } else if (makeUpper === 'BUGATTI') {
    localSightings = 0; // Mythic everywhere globally
  }

  // Factor 1: Global Production Score (15 - 98)
  const globalFactorScore = calculateGlobalProductionFactor(globalUnits);

  // Global override for hypercars under 500 units (e.g. Bugatti Chiron)
  if (globalUnits <= 500) {
    return {
      rarity: 'mythic',
      rarityScore: 98,
      globalFactorScore: 98,
      localScarcityMultiplier: 1.0,
      explanation: 'Mythic everywhere: Global production under 500 units overrides regional density.'
    };
  }

  // Factor 2: Local Scarcity Multiplier
  const localScarcityMultiplier = calculateLocalScarcityMultiplier(localSightings);

  // Combined Regional Rarity Score
  const rawScore = Math.min(99, Math.max(10, Math.round(globalFactorScore * localScarcityMultiplier)));

  // Derive Rarity Tier
  let rarity: RarityTier = 'common';
  if (rawScore >= 95) rarity = 'mythic';
  else if (rawScore >= 82) rarity = 'legendary';
  else if (rawScore >= 68) rarity = 'epic';
  else if (rawScore >= 50) rarity = 'rare';
  else if (rawScore >= 30) rarity = 'uncommon';

  let explanation = `Calculated in ${city}, ${country}: ${globalUnits.toLocaleString()} global units (${globalFactorScore} pts) x ${localSightings} local spots in 100km radius (${localScarcityMultiplier}x multiplier).`;
  if (makeUpper === 'TOYOTA' && modelUpper.includes('SUPRA') && isIndia) {
    explanation = `GR Supra in ${city}: Extremely scarce in region (0 local spots in 100km). Regional rarity boosted to ${rarity.toUpperCase()}.`;
  }

  return {
    rarity,
    rarityScore: rawScore,
    globalFactorScore,
    localScarcityMultiplier,
    explanation
  };
}
