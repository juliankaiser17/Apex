/**
 * APEX — Vehicle Market Valuation & Price Grounding Engine
 * 
 * Guarantees realistic, defensible market valuation ranges ($Low – $High USD).
 * Eliminates deceptive fallbacks where consumer vehicles were assigned $240k–$310k supercar valuations.
 */

import { CAR_PRESETS } from '../data/carDatabase';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../data/vehicleDatabase';
import type { RarityTier } from '../types/apex';

export interface MarketValuationResult {
  lowUsd: number;
  highUsd: number;
  formattedRange: string;
  isEstimate: boolean;
  confidence: 'verified_catalog' | 'model_grounded' | 'rarity_grounded';
}

// Grounded price baselines by rarity tier when exact catalog pricing is unavailable
const RARITY_TIER_BASELINES: Record<RarityTier, { low: number; high: number }> = {
  common: { low: 18000, high: 28000 },
  uncommon: { low: 30000, high: 55000 },
  rare: { low: 60000, high: 110000 },
  epic: { low: 130000, high: 260000 },
  legendary: { low: 300000, high: 650000 },
  mythic: { low: 1500000, high: 3800000 }
};

export function getEstimatedMarketValue(params: {
  make?: string | null;
  model?: string | null;
  rarity?: RarityTier;
  marketValueLowUsd?: number | null;
  marketValueHighUsd?: number | null;
}): MarketValuationResult {
  const { make, model, rarity = 'common', marketValueLowUsd, marketValueHighUsd } = params;

  // 1. If explicit positive values already exist on the card and are non-zero
  if (marketValueLowUsd && marketValueHighUsd && marketValueLowUsd > 0 && marketValueHighUsd > 0) {
    const low = Math.round(marketValueLowUsd);
    const high = Math.max(low, Math.round(marketValueHighUsd));
    return {
      lowUsd: low,
      highUsd: high,
      formattedRange: formatPriceRange(low, high),
      isEstimate: true,
      confidence: 'model_grounded'
    };
  }

  const normMake = (make || '').toLowerCase().trim();
  const normModel = (model || '').toLowerCase().trim();

  // 2. Check CAR_PRESETS for exact match
  if (normMake && normModel) {
    const presetMatch = CAR_PRESETS.find((p) => {
      const pMake = p.make.toLowerCase();
      const pModel = p.model.toLowerCase();
      return (
        (pMake.includes(normMake) || normMake.includes(pMake)) &&
        (pModel.includes(normModel) || normModel.includes(pModel))
      );
    });

    if (presetMatch && presetMatch.marketValueLowUsd > 0 && presetMatch.marketValueHighUsd > 0) {
      return {
        lowUsd: presetMatch.marketValueLowUsd,
        highUsd: presetMatch.marketValueHighUsd,
        formattedRange: formatPriceRange(presetMatch.marketValueLowUsd, presetMatch.marketValueHighUsd),
        isEstimate: true,
        confidence: 'verified_catalog'
      };
    }
  }

  // 3. Check APEX_LOCAL_VEHICLE_DATABASE baseline rarity & specs
  if (normMake && normModel) {
    const dbMatch = APEX_LOCAL_VEHICLE_DATABASE.find((v) => {
      const vMake = v.manufacturer.toLowerCase();
      const vModel = v.model.toLowerCase();
      return (
        (vMake.includes(normMake) || normMake.includes(vMake)) &&
        (vModel.includes(normModel) || normModel.includes(vModel))
      );
    });

    if (dbMatch) {
      const baseline = RARITY_TIER_BASELINES[dbMatch.baselineRarity] || RARITY_TIER_BASELINES.common;
      return {
        lowUsd: baseline.low,
        highUsd: baseline.high,
        formattedRange: formatPriceRange(baseline.low, baseline.high),
        isEstimate: true,
        confidence: 'verified_catalog'
      };
    }
  }

  // 4. Ground by rarity tier
  const tierBaseline = RARITY_TIER_BASELINES[rarity] || RARITY_TIER_BASELINES.common;
  return {
    lowUsd: tierBaseline.low,
    highUsd: tierBaseline.high,
    formattedRange: formatPriceRange(tierBaseline.low, tierBaseline.high),
    isEstimate: true,
    confidence: 'rarity_grounded'
  };
}

export function formatPriceRange(low: number, high: number): string {
  const formatK = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    return `$${Math.round(val / 1000)}k`;
  };

  return `${formatK(low)} – ${formatK(high)}`;
}
