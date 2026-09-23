/**
 * APEX — Canonical Vehicle Specification Resolution Engine
 * 
 * Deterministically resolves engineering specifications (HP, Torque, 0-100, Top Speed, Weight)
 * from the final canonical vehicle identity against verified vehicle registries.
 * 
 * INVARIANT: Never fabricates generic fake numbers (e.g. 300 hp, 250 km/h) for unknown cars.
 * If a vehicle is not catalogued, specs are marked as unverified/unavailable.
 */

import { APEX_LOCAL_VEHICLE_DATABASE, type NormalizedVehicle } from '../data/vehicleDatabase';
import { CAR_PRESETS } from '../data/carDatabase';
import type { RarityTier } from '../types/apex';

export interface ResolvedVehicleSpecs {
  isVerified: boolean;
  canonicalId: string;
  make: string;
  model: string;
  generation?: string;
  trim?: string;
  bodyStyle: string;
  engine: string;
  horsepower: number | null;
  torqueNm: number | null;
  topSpeedKmH: number | null;
  zeroToHundredSec: number | null;
  kerbWeightKg: number | null;
  productionYears: string;
  originCountry: string;
  rarity: RarityTier;
  interestingFact: string;
  briefHistory?: string;
}

function normalizeKey(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Resolves verified vehicle specifications from the canonical vehicle identity.
 */
export function resolveCanonicalVehicleSpecs(params: {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  trim?: string | null;
  canonicalVehicleId?: string | null;
}): ResolvedVehicleSpecs {
  const normMake = normalizeKey(params.make);
  const normModel = normalizeKey(params.model);
  const normGen = normalizeKey(params.generation);
  const normTrim = normalizeKey(params.trim);
  const canonicalId = (params.canonicalVehicleId || `${params.make || 'unknown'}-${params.model || 'unknown'}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  // 0. Direct match by canonicalVehicleId
  if (params.canonicalVehicleId) {
    const directMatch = APEX_LOCAL_VEHICLE_DATABASE.find((v) => v.id === params.canonicalVehicleId);
    if (directMatch) {
      return {
        isVerified: true,
        canonicalId: directMatch.id,
        make: directMatch.manufacturer,
        model: directMatch.model,
        generation: directMatch.generation,
        trim: directMatch.trim || undefined,
        bodyStyle: directMatch.bodyStyle,
        engine: directMatch.engine,
        horsepower: directMatch.horsepower,
        torqueNm: directMatch.torqueNm,
        topSpeedKmH: directMatch.topSpeedKmH,
        zeroToHundredSec: directMatch.zeroToHundredSec,
        kerbWeightKg: directMatch.curbWeightKg,
        productionYears: directMatch.productionYears,
        originCountry: directMatch.originCountry,
        rarity: directMatch.baselineRarity,
        interestingFact: directMatch.notableFacts,
        briefHistory: `${directMatch.manufacturer} ${directMatch.model} (${directMatch.productionYears})`
      };
    }
  }

  // 1. Search APEX_LOCAL_VEHICLE_DATABASE
  let bestMatch: NormalizedVehicle | null = null;
  let bestScore = 0;

  for (const v of APEX_LOCAL_VEHICLE_DATABASE) {
    const vMake = normalizeKey(v.manufacturer);
    const vModel = normalizeKey(v.model);
    const vGen = normalizeKey(v.generation);
    const vTrim = normalizeKey(v.trim);

    // Make must match or be closely related
    const makeMatches = vMake === normMake || normMake.includes(vMake) || vMake.includes(normMake);
    if (!makeMatches && normMake !== '') continue;

    let score = 0;
    if (vModel === normModel) {
      score += 10;
    } else if (normModel.includes(vModel) || vModel.includes(normModel)) {
      score += 7;
    } else {
      // Check if tokens overlap
      const modelTokens = normModel.split(' ');
      const vTokens = vModel.split(' ');
      const matchCount = modelTokens.filter(t => t.length > 1 && vTokens.includes(t)).length;
      if (matchCount > 0) score += matchCount * 3;
    }

    if (score > 0) {
      if (normGen && vGen && (normGen === vGen || normGen.includes(vGen) || vGen.includes(normGen))) {
        score += 3;
      }
      if (normTrim && vTrim && (normTrim === vTrim || normTrim.includes(vTrim) || vTrim.includes(normTrim))) {
        score += 2;
      }
      if (v.id === canonicalId) {
        score += 15;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = v;
      }
    }
  }

  if (bestMatch && bestScore >= 7) {
    return {
      isVerified: true,
      canonicalId: bestMatch.id,
      make: bestMatch.manufacturer,
      model: bestMatch.model,
      generation: bestMatch.generation,
      trim: bestMatch.trim || undefined,
      bodyStyle: bestMatch.bodyStyle,
      engine: bestMatch.engine,
      horsepower: bestMatch.horsepower,
      torqueNm: bestMatch.torqueNm,
      topSpeedKmH: bestMatch.topSpeedKmH,
      zeroToHundredSec: bestMatch.zeroToHundredSec,
      kerbWeightKg: bestMatch.curbWeightKg,
      productionYears: bestMatch.productionYears,
      originCountry: bestMatch.originCountry,
      rarity: bestMatch.baselineRarity,
      interestingFact: bestMatch.notableFacts,
      briefHistory: `${bestMatch.manufacturer} ${bestMatch.model} (${bestMatch.productionYears})`
    };
  }

  // 2. Search CAR_PRESETS
  for (const p of CAR_PRESETS) {
    const pMake = normalizeKey(p.make);
    const pModel = normalizeKey(p.model);
    if ((pMake === normMake || normMake.includes(pMake)) && (pModel === normModel || normModel.includes(pModel) || pModel.includes(normModel))) {
      return {
        isVerified: true,
        canonicalId: `preset-${p.make.toLowerCase()}-${p.model.toLowerCase()}`.replace(/[^a-z0-9]+/g, '-'),
        make: p.make,
        model: p.model,
        generation: p.generation || undefined,
        trim: p.trim || undefined,
        bodyStyle: p.bodyStyle,
        engine: p.engine,
        horsepower: p.horsepower,
        torqueNm: p.torqueNm,
        topSpeedKmH: p.topSpeedKmH,
        zeroToHundredSec: p.zeroToHundredSec,
        kerbWeightKg: p.kerbWeightKg,
        productionYears: p.releasedYear || p.yearEstimate || 'N/A',
        originCountry: p.originCountry,
        rarity: p.rarity,
        interestingFact: p.interestingFact,
        briefHistory: p.briefHistory
      };
    }
  }

  // 3. Fallback for uncatalogued vehicle: DO NOT FABRICATE SPECS!
  return {
    isVerified: false,
    canonicalId,
    make: params.make || 'Unknown Make',
    model: params.model || 'Unknown Model',
    generation: params.generation || undefined,
    trim: params.trim || undefined,
    bodyStyle: 'Coupe',
    engine: 'Verified Specs Unavailable',
    horsepower: null,
    torqueNm: null,
    topSpeedKmH: null,
    zeroToHundredSec: null,
    kerbWeightKg: null,
    productionYears: 'N/A',
    originCountry: 'Global',
    rarity: 'rare',
    interestingFact: 'Vehicle specifications being indexed in Apex catalog.',
    briefHistory: undefined
  };
}
