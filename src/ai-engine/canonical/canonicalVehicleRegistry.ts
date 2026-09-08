/**
 * APEX — Canonical Vehicle Knowledge Graph & Registry
 * Immutable Vehicle Authority Dataset with Exact Specs, Generations, Trims, and Aliases
 */

import type { BodyStyle, RarityTier } from '../../types/apex';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../../data/vehicleDatabase';

export interface CanonicalVehicleRecord {
  vehicleId: string;
  make: string;
  model: string;
  generation: string;
  facelift?: string;
  trim?: string;
  bodyStyle: BodyStyle;
  yearStart: number;
  yearEnd?: number;
  engine: string;
  displacementCc?: number;
  aspiration: string;
  horsepower: number;
  torqueNm: number;
  topSpeedKmH: number;
  zeroToHundredSec: number;
  kerbWeightKg: number;
  productionYears: string;
  originCountry: string;
  baselineRarity: RarityTier;
  visualFeatures: string[];
  aliases: string[];
  notableFacts: string;
  historicalInformation: string;
  referenceImages: string[];
}

class CanonicalVehicleRegistry {
  private registry: Map<string, CanonicalVehicleRecord> = new Map();
  private aliasLookup: Map<string, string> = new Map(); // normalized alias -> vehicleId
  private makeModelIndex: Map<string, CanonicalVehicleRecord[]> = new Map(); // "make_model" -> records

  constructor() {
    this.seedCanonicalDatabase();
  }

  private seedCanonicalDatabase() {
    // 1. Ingest base local database
    APEX_LOCAL_VEHICLE_DATABASE.forEach((item) => {
      const record: CanonicalVehicleRecord = {
        vehicleId: item.id,
        make: item.manufacturer,
        model: item.model,
        generation: item.generation,
        trim: item.trim,
        bodyStyle: item.bodyStyle as BodyStyle,
        yearStart: item.yearStart,
        yearEnd: item.yearEnd,
        engine: item.engine,
        displacementCc: item.displacementCc,
        aspiration: item.aspiration,
        horsepower: item.horsepower,
        torqueNm: item.torqueNm,
        topSpeedKmH: item.topSpeedKmH,
        zeroToHundredSec: item.zeroToHundredSec,
        kerbWeightKg: item.curbWeightKg,
        productionYears: item.productionYears,
        originCountry: item.originCountry,
        baselineRarity: item.baselineRarity,
        visualFeatures: [
          item.visualSignature.silhouetteClass,
          ...item.visualSignature.prominentColors
        ],
        aliases: [
          `${item.manufacturer} ${item.model}`.toLowerCase(),
          `${item.manufacturer} ${item.model} ${item.generation}`.toLowerCase(),
          `${item.model} ${item.generation}`.toLowerCase(),
          item.id.toLowerCase()
        ],
        notableFacts: item.notableFacts,
        historicalInformation: `${item.manufacturer} ${item.model} (${item.generation}) manufactured in ${item.originCountry}.`,
        referenceImages: []
      };

      this.registerVehicle(record);
    });

    // 2. Add extra aliases and hard-negative distinguishes
    this.registerAliases('porsche-911-gt3-rs-992', [
      '992 gt3 rs',
      'gt3 rs 992',
      'porsche 992 gt3 rs',
      '911 gt3rs',
      '992 gt3rs'
    ]);

    this.registerAliases('porsche-911-gt3-992', [
      '992 gt3',
      'porsche 992 gt3',
      '911 gt3 touring'
    ]);

    this.registerAliases('bmw-m3-competition-g80', [
      'g80 m3',
      'm3 competition',
      'bmw g80',
      'm3 comp'
    ]);

    this.registerAliases('nissan-gt-r-nismo-r35', [
      'r35 nismo',
      'gtr nismo',
      'r35 gtr'
    ]);
  }

  public registerVehicle(record: CanonicalVehicleRecord) {
    this.registry.set(record.vehicleId, record);

    // Index aliases
    record.aliases.forEach((alias) => {
      this.aliasLookup.set(this.normalize(alias), record.vehicleId);
    });

    // Index make+model
    const key = `${this.normalize(record.make)}_${this.normalize(record.model)}`;
    const existing = this.makeModelIndex.get(key) || [];
    existing.push(record);
    this.makeModelIndex.set(key, existing);
  }

  public registerAliases(vehicleId: string, aliases: string[]) {
    const record = this.registry.get(vehicleId);
    if (!record) return;

    aliases.forEach((alias) => {
      const norm = this.normalize(alias);
      this.aliasLookup.set(norm, vehicleId);
      if (!record.aliases.includes(alias)) {
        record.aliases.push(alias);
      }
    });
  }

  public getById(vehicleId: string): CanonicalVehicleRecord | null {
    return this.registry.get(vehicleId) || null;
  }

  public lookupByTextOrAlias(query: string): CanonicalVehicleRecord | null {
    if (!query) return null;
    const norm = this.normalize(query);

    // 1. Direct alias / ID match
    if (this.aliasLookup.has(norm)) {
      const id = this.aliasLookup.get(norm)!;
      return this.registry.get(id) || null;
    }

    // 2. Partial match in registry
    for (const [id, record] of this.registry.entries()) {
      if (
        norm.includes(this.normalize(id)) ||
        norm.includes(this.normalize(`${record.make} ${record.model}`)) ||
        norm.includes(this.normalize(`${record.model} ${record.generation}`))
      ) {
        return record;
      }
    }

    return null;
  }

  public findMatchingCandidates(make?: string, model?: string, generation?: string): CanonicalVehicleRecord[] {
    const results: CanonicalVehicleRecord[] = [];
    const normMake = make ? this.normalize(make) : '';
    const normModel = model ? this.normalize(model) : '';
    const normGen = generation ? this.normalize(generation) : '';

    for (const record of this.registry.values()) {
      let score = 0;
      const recMake = this.normalize(record.make);
      const recModel = this.normalize(record.model);
      const recGen = this.normalize(record.generation);

      if (normMake && recMake.includes(normMake)) score += 3;
      if (normModel && (recModel.includes(normModel) || normModel.includes(recModel))) score += 5;
      if (normGen && (recGen.includes(normGen) || normGen.includes(recGen))) score += 4;

      if (score > 0) {
        results.push(record);
      }
    }

    return results;
  }

  public getAll(): CanonicalVehicleRecord[] {
    return Array.from(this.registry.values());
  }

  public size(): number {
    return this.registry.size;
  }

  private normalize(str: string): string {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
}

export const canonicalVehicleRegistry = new CanonicalVehicleRegistry();
