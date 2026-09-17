/**
 * APEX — Deterministic Vehicle Validator
 * Validates AI proposals against the Canonical Knowledge Graph.
 * Rejects impossible make/model/generation/year/trim combinations.
 */

import type { ModelIdentificationOutput, OpenCanonicalIdentity } from '../types';
import { canonicalVehicleRegistry, type CanonicalVehicleRecord } from '../canonical/canonicalVehicleRegistry';

export interface ValidationReport {
  isValid: boolean;
  canonicalRecord: CanonicalVehicleRecord | null;
  canonicalIdentity?: OpenCanonicalIdentity;
  isVerifiedUnregistered?: boolean;
  resolvedMake: string;
  resolvedModel: string;
  resolvedGeneration: string;
  resolvedTrim?: string;
  resolvedYear: string;
  resolvedRarity: any;
  resolvedEngine: string;
  resolvedHorsepower: number;
  resolvedTorqueNm: number;
  resolvedTopSpeed: number;
  resolvedZeroToHundred: number;
  resolvedKerbWeight: number;
  resolvedProductionYears: string;
  resolvedOriginCountry: string;
  resolvedBodyStyle: any;
  validationWarnings: string[];
  requiresHumanReview: boolean;
}

export class DeterministicValidator {
  public validate(output: ModelIdentificationOutput): ValidationReport {
    // 0. Explicit abstention check: if vision provider was unavailable or make is unknown, never fabricate
    if (
      output.abstentionReason === 'vision_provider_unavailable' ||
      output.make === 'Unknown Make' ||
      (output.make && output.make.toLowerCase().includes('unknown'))
    ) {
      return {
        isValid: false,
        canonicalRecord: null,
        resolvedMake: 'Unknown Make',
        resolvedModel: 'Unknown Model',
        resolvedGeneration: 'Unknown',
        resolvedTrim: undefined,
        resolvedYear: 'Unknown',
        resolvedRarity: 'common',
        resolvedEngine: 'Unknown',
        resolvedHorsepower: 0,
        resolvedTorqueNm: 0,
        resolvedTopSpeed: 0,
        resolvedZeroToHundred: 0,
        resolvedKerbWeight: 0,
        resolvedProductionYears: 'Unknown',
        resolvedOriginCountry: 'Unknown',
        resolvedBodyStyle: 'Unknown',
        validationWarnings: ['Vision provider unavailable. Explicit abstention enforced.'],
        requiresHumanReview: true
      };
    }

    const warnings: string[] = [];
    let requiresReview = output.needsReview;

    // 1. Check if vehicleId is provided and canonical
    let canonicalRecord: CanonicalVehicleRecord | null = null;
    if (output.vehicleId) {
      canonicalRecord = canonicalVehicleRegistry.getById(output.vehicleId);
    }

    // 2. If not found by ID, attempt lookup by text / make / model / generation
    if (!canonicalRecord) {
      const query = `${output.make || ''} ${output.model || ''} ${output.generation || ''}`;
      canonicalRecord = canonicalVehicleRegistry.lookupByTextOrAlias(query);
    }

    // 3. Fallback candidates search (requires strict model family alignment)
    if (!canonicalRecord && output.make && output.model) {
      const matches = canonicalVehicleRegistry.findMatchingCandidates(output.make, output.model, output.generation || '');
      const normOut = (output.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const modelMatch = matches.find((m) => {
        const normM = (m.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normM) return false;
        // Exact match
        if (normM === normOut) return true;
        // If output.model is longer and includes canonical model (e.g. output="911 Carrera", canon="911")
        if (normOut.includes(normM)) return true;
        // If canonical model is longer (e.g. canon="911 GT3 RS", output="911"), only match if no specialty track tokens were added
        if (normM.includes(normOut)) {
          const extra = normM.replace(normOut, '');
          const trackTokens = ['gt3', 'gt2', 'gt4', 'rs', 'sto', 'csl', 'svj', 'blackseries', 'nismo', 'turbo'];
          return !trackTokens.some((t) => extra.includes(t));
        }
        return false;
      });
      if (modelMatch) {
        canonicalRecord = modelMatch;
      }
    }

    // 4. Validate domain constraints if canonical record exists
    if (canonicalRecord) {
      // Check year range
      const estYear = parseInt(output.yearEstimate, 10);
      if (!isNaN(estYear)) {
        if (estYear < canonicalRecord.yearStart - 1) {
          warnings.push(`Estimated year ${estYear} is before generation start (${canonicalRecord.yearStart}).`);
          requiresReview = true;
        }
        if (canonicalRecord.yearEnd && estYear > canonicalRecord.yearEnd + 1) {
          warnings.push(`Estimated year ${estYear} is after generation end (${canonicalRecord.yearEnd}).`);
          requiresReview = true;
        }
      }

      // Check horsepower sanity
      if (output.horsepower > 0 && Math.abs(output.horsepower - canonicalRecord.horsepower) > 250) {
        warnings.push(`Claimed horsepower (${output.horsepower} HP) differs significantly from canonical baseline (${canonicalRecord.horsepower} HP).`);
      }

      // Determine model name: Do not escalate a base model to a specialty track model
      let finalResolvedModel = canonicalRecord.model;
      const normOutModel = (output.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCanonModel = (canonicalRecord.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normOutModel && normCanonModel !== normOutModel) {
        const extraTokens = normCanonModel.replace(normOutModel, '');
        const trackKeywords = ['gt3', 'gt2', 'gt4', 'rs', 'sto', 'csl', 'svj', 'blackseries', 'nismo', 'turbo'];
        const hasTrackKeywordInCanon = trackKeywords.some((kw) => extraTokens.includes(kw));
        const hasTrackKeywordInOutput = trackKeywords.some(
          (kw) => normOutModel.includes(kw) || (output.trim && output.trim.toLowerCase().includes(kw))
        );
        if (hasTrackKeywordInCanon && !hasTrackKeywordInOutput) {
          finalResolvedModel = output.model || canonicalRecord.model;
        }
      }

      // Determine generation: Preserve upstream generation if provided and distinct
      let finalResolvedGeneration = canonicalRecord.generation;
      const outGen = (output.generation || '').trim();
      if (outGen && outGen.toLowerCase() !== 'unknown' && outGen.toLowerCase() !== 'current') {
        const normOutGen = outGen.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normCanonGen = (canonicalRecord.generation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normCanonGen.includes(normOutGen) && !normOutGen.includes(normCanonGen)) {
          finalResolvedGeneration = outGen;
        }
      }

      // Determine trim: NEVER backfill canonical trim if upstream left trim unobserved/null
      const hasExplicitTrim = Boolean(
        output.trim &&
        output.trim.trim().length > 0 &&
        output.trim.toLowerCase() !== 'null' &&
        output.trim.toLowerCase() !== 'undefined'
      );
      const finalResolvedTrim = hasExplicitTrim ? output.trim! : undefined;

      const registeredIdentity = canonicalVehicleRegistry.resolveCanonicalIdentity({
        vehicleId: canonicalRecord.vehicleId,
        make: canonicalRecord.make,
        model: finalResolvedModel,
        generation: finalResolvedGeneration,
        variant: finalResolvedTrim,
        source: 'registry'
      });

      return {
        isValid: true,
        canonicalRecord,
        canonicalIdentity: registeredIdentity,
        isVerifiedUnregistered: false,
        resolvedMake: canonicalRecord.make,
        resolvedModel: finalResolvedModel,
        resolvedGeneration: finalResolvedGeneration,
        resolvedTrim: finalResolvedTrim,
        resolvedYear: output.yearEstimate || String(canonicalRecord.yearStart),
        resolvedRarity: canonicalRecord.baselineRarity,
        resolvedEngine: canonicalRecord.engine,
        resolvedHorsepower: canonicalRecord.horsepower,
        resolvedTorqueNm: canonicalRecord.torqueNm,
        resolvedTopSpeed: canonicalRecord.topSpeedKmH,
        resolvedZeroToHundred: canonicalRecord.zeroToHundredSec,
        resolvedKerbWeight: canonicalRecord.kerbWeightKg,
        resolvedProductionYears: canonicalRecord.productionYears,
        resolvedOriginCountry: canonicalRecord.originCountry,
        resolvedBodyStyle: canonicalRecord.bodyStyle,
        validationWarnings: warnings,
        requiresHumanReview: requiresReview
      };
    }

    // 5. If no canonical record exists in seed database:
    // REGISTRY ABSENCE != VEHICLE INVALIDITY.
    // Preserve valid upstream vision identity as VERIFIED_UNREGISTERED.
    if (output.make && output.model) {
      const openIdentity = canonicalVehicleRegistry.resolveCanonicalIdentity({
        vehicleId: output.vehicleId,
        make: output.make,
        model: output.model,
        generation: output.generation,
        variant: output.trim,
        source: 'gemini',
        specs: {
          horsepower: output.horsepower,
          torqueNm: output.torqueNm,
          topSpeedKmH: output.topSpeedKmH,
          zeroToHundredSec: output.zeroToHundredSec,
          kerbWeightKg: output.kerbWeightKg,
          engine: output.engine,
          productionYears: output.productionYears,
          originCountry: output.originCountry,
          bodyStyle: output.bodyStyle,
          baselineRarity: output.rarity
        }
      });

      const isConfidentUnregistered = (output.modelConfidence || 0) >= 0.70;

      return {
        isValid: true,
        canonicalRecord: null,
        canonicalIdentity: openIdentity,
        isVerifiedUnregistered: true,
        resolvedMake: output.make,
        resolvedModel: output.model,
        resolvedGeneration: output.generation || 'Current',
        resolvedTrim: output.trim || undefined,
        resolvedYear: output.yearEstimate || '2023',
        resolvedRarity: output.rarity || 'rare',
        resolvedEngine: output.engine || 'High-Output Engine',
        resolvedHorsepower: Math.min(2000, Math.max(50, output.horsepower || 300)),
        resolvedTorqueNm: Math.min(2000, Math.max(50, output.torqueNm || 400)),
        resolvedTopSpeed: Math.min(500, Math.max(100, output.topSpeedKmH || 250)),
        resolvedZeroToHundred: Math.min(15, Math.max(1.8, output.zeroToHundredSec || 4.5)),
        resolvedKerbWeight: Math.min(3500, Math.max(600, output.kerbWeightKg || 1500)),
        resolvedProductionYears: output.productionYears || '2020–Present',
        resolvedOriginCountry: output.originCountry || 'Global',
        resolvedBodyStyle: output.bodyStyle || 'Coupe',
        validationWarnings: ['Vehicle not registered in canonical database. Using validated open canonical identity.'],
        requiresHumanReview: output.needsReview || !isConfidentUnregistered
      };
    }

    // Invalid output
    return {
      isValid: false,
      canonicalRecord: null,
      resolvedMake: 'Unknown Make',
      resolvedModel: 'Unknown Model',
      resolvedGeneration: 'Unknown',
      resolvedTrim: undefined,
      resolvedYear: '2023',
      resolvedRarity: 'common',
      resolvedEngine: 'Internal Combustion Engine',
      resolvedHorsepower: 150,
      resolvedTorqueNm: 200,
      resolvedTopSpeed: 180,
      resolvedZeroToHundred: 8.5,
      resolvedKerbWeight: 1400,
      resolvedProductionYears: 'Unknown',
      resolvedOriginCountry: 'Global',
      resolvedBodyStyle: 'Sedan',
      validationWarnings: ['Failed to validate vehicle identity against knowledge base.'],
      requiresHumanReview: true
    };
  }
}

export const deterministicValidator = new DeterministicValidator();
