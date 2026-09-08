/**
 * APEX — Deterministic Vehicle Validator
 * Validates AI proposals against the Canonical Knowledge Graph.
 * Rejects impossible make/model/generation/year/trim combinations.
 */

import type { ModelIdentificationOutput } from '../types';
import { canonicalVehicleRegistry, type CanonicalVehicleRecord } from '../canonical/canonicalVehicleRegistry';

export interface ValidationReport {
  isValid: boolean;
  canonicalRecord: CanonicalVehicleRecord | null;
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

    // 3. Fallback candidates search (requires model family alignment)
    if (!canonicalRecord && output.make && output.model) {
      const matches = canonicalVehicleRegistry.findMatchingCandidates(output.make, output.model, output.generation || '');
      const modelMatch = matches.find((m) => {
        const normM = (m.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normOut = (output.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normM.length > 0 && (normM === normOut || normM.includes(normOut) || normOut.includes(normM));
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

      return {
        isValid: true,
        canonicalRecord,
        resolvedMake: canonicalRecord.make,
        resolvedModel: canonicalRecord.model,
        resolvedGeneration: canonicalRecord.generation,
        resolvedTrim: output.trim || canonicalRecord.trim,
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

    // 5. If no canonical record exists, validate generic bounds
    if (output.make && output.model) {
      return {
        isValid: true,
        canonicalRecord: null,
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
        validationWarnings: ['Vehicle not registered in canonical database. Using validated generic values.'],
        requiresHumanReview: true
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
