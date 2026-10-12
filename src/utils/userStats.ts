/**
 * APEX — Authoritative Unified User Progression & Collection Statistics Engine
 * 
 * Provides a single, deterministic source of truth for:
 * - Total cars spotted
 * - Unique vehicle models
 * - Rarity breakdown (Common, Uncommon, Rare, Epic, Legendary, Mythic)
 * - Garage telemetry (Highest Tier, Peak Top Speed, Combined Horsepower, Market Valuation)
 * - Badges unlocked & progression
 * 
 * Synchronizes across Profile, Settings, Garage, and Social views.
 */

import type { CarCard, Badge, UserProfile, RarityTier } from '../types/apex';
import { resolveCanonicalVehicleSpecs } from './vehicleSpecs';

export interface AuthoritativeStats {
  totalCarsSpotted: number;
  uniqueFindsCount: number;
  commonCount: number;
  uncommonCount: number;
  rareCount: number;
  epicCount: number;
  legendaryCount: number;
  mythicCount: number;
  highestTier: RarityTier | 'none';
  highestTierLabel: string;
  topSpeedKmH: number;
  topSpeedLabel: string;
  totalHorsepower: number;
  totalHorsepowerLabel: string;
  badgesUnlockedCount: number;
  totalBadgesCount: number;
  garageValuationUsd: number;
  citiesExploredCount: number;
}

const RARITY_WEIGHT: Record<RarityTier, number> = {
  mythic: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1
};

const RARITY_LABELS: Record<RarityTier, string> = {
  mythic: 'Mythic',
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common'
};

/**
 * Normalizes rarity string to canonical RarityTier
 */
export function normalizeRarityTier(rawRarity?: string | null): RarityTier {
  if (!rawRarity) return 'common';
  const clean = rawRarity.trim().toLowerCase();
  if (clean === 'mythic') return 'mythic';
  if (clean === 'legendary') return 'legendary';
  if (clean === 'epic') return 'epic';
  if (clean === 'rare') return 'rare';
  if (clean === 'uncommon') return 'uncommon';
  return 'common';
}

/**
 * Computes authoritative collection and account progression statistics.
 * 
 * @param garage The array of CarCard items currently owned by the user.
 * @param badges The full badge collection or unlocked badges.
 * @param user The user profile state.
 */
export function computeAuthoritativeStats(
  garage: CarCard[] = [],
  badges: Badge[] = [],
  user?: Partial<UserProfile>
): AuthoritativeStats {
  const safeGarage = Array.isArray(garage) ? garage : [];
  const safeBadges = Array.isArray(badges) ? badges : [];

  let commonCount = 0;
  let uncommonCount = 0;
  let rareCount = 0;
  let epicCount = 0;
  let legendaryCount = 0;
  let mythicCount = 0;

  const uniqueModelKeys = new Set<string>();
  const uniqueCities = new Set<string>();

  let peakSpeed = 0;
  let combinedHp = 0;
  let totalValuation = 0;
  let highestWeight = 0;
  let highestTierFound: RarityTier | 'none' = 'none';

  for (let i = 0; i < safeGarage.length; i++) {
    const card = safeGarage[i];
    if (!card) continue;

    // 1. Rarity accounting
    const tier = normalizeRarityTier(card.rarity);
    if (tier === 'mythic') mythicCount++;
    else if (tier === 'legendary') legendaryCount++;
    else if (tier === 'epic') epicCount++;
    else if (tier === 'rare') rareCount++;
    else if (tier === 'uncommon') uncommonCount++;
    else commonCount++;

    const weight = RARITY_WEIGHT[tier] || 1;
    if (weight > highestWeight) {
      highestWeight = weight;
      highestTierFound = tier;
    }

    // 2. Unique vehicle model key
    const makeNorm = (card.make || '').trim().toLowerCase();
    const modelNorm = (card.model || '').trim().toLowerCase();
    if (makeNorm && modelNorm) {
      uniqueModelKeys.add(`${makeNorm}::${modelNorm}`);
    } else if (card.id) {
      uniqueModelKeys.add(card.id);
    }

    // 3. City exploration
    const cityNorm = (card.city || '').trim().toLowerCase();
    if (cityNorm && cityNorm !== 'global' && cityNorm !== 'local area' && cityNorm !== 'your city') {
      uniqueCities.add(cityNorm);
    }

    // 4. Valuation
    const val = (card.marketValueHighUsd && card.marketValueHighUsd > 0)
      ? card.marketValueHighUsd
      : (card.marketValueLowUsd && card.marketValueLowUsd > 0)
      ? card.marketValueLowUsd
      : 35000;
    totalValuation += val;

    // 5. Specs: Horsepower & Top Speed with canonical lookup fallback
    let cardHp = typeof card.horsepower === 'number' && card.horsepower > 0 ? card.horsepower : 0;
    let cardSpeed = typeof card.topSpeedKmH === 'number' && card.topSpeedKmH > 0 ? card.topSpeedKmH : 0;

    // If card metadata is missing or zero, resolve verified canonical specs
    if (cardHp === 0 || cardSpeed === 0) {
      try {
        const canonicalSpecs = resolveCanonicalVehicleSpecs({
          make: card.make,
          model: card.model,
          generation: card.generation,
          trim: card.trim,
          canonicalVehicleId: (card as any).canonicalVehicleId
        });
        if (cardHp === 0 && canonicalSpecs.horsepower) {
          cardHp = canonicalSpecs.horsepower;
        }
        if (cardSpeed === 0 && canonicalSpecs.topSpeedKmH) {
          cardSpeed = canonicalSpecs.topSpeedKmH;
        }
      } catch {
        // Safe fallback without throwing
      }
    }

    combinedHp += cardHp;
    if (cardSpeed > peakSpeed) {
      peakSpeed = cardSpeed;
    }
  }

  // Authoritative total spots: max of garage length and user.totalSpots
  const totalCarsSpotted = Math.max(safeGarage.length, user?.totalSpots || 0);

  // If garage is empty, peakSpeed and combinedHp are 0
  const topSpeedLabel = peakSpeed > 0 ? `${peakSpeed} km/h` : '—';
  const totalHorsepowerLabel = combinedHp > 0 ? `${combinedHp.toLocaleString()} hp` : '0 hp';
  const highestTierLabel = highestTierFound !== 'none' ? RARITY_LABELS[highestTierFound] : '—';

  // Badges accounting
  const badgesUnlockedCount = safeBadges.filter(b => b.isUnlocked).length;
  const totalBadgesCount = safeBadges.length;

  return {
    totalCarsSpotted,
    uniqueFindsCount: uniqueModelKeys.size,
    commonCount,
    uncommonCount,
    rareCount,
    epicCount,
    legendaryCount,
    mythicCount,
    highestTier: highestTierFound,
    highestTierLabel,
    topSpeedKmH: peakSpeed,
    topSpeedLabel,
    totalHorsepower: combinedHp,
    totalHorsepowerLabel,
    badgesUnlockedCount,
    totalBadgesCount,
    garageValuationUsd: totalValuation,
    citiesExploredCount: uniqueCities.size
  };
}
