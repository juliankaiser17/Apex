/**
 * APEX — Canonical Vehicle Knowledge Graph & Registry
 * Immutable Vehicle Authority Dataset with Exact Specs, Generations, Trims, and Aliases
 */

import type { BodyStyle, RarityTier } from '../../types/apex';
import type { OpenCanonicalIdentity } from '../types';
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

    this.registerAliases('ferrari-daytona-sp3', [
      'daytona sp3',
      'ferrari daytona',
      'daytona sp3 icona',
      'ferrari daytona sp3',
      'ferrari daytona sp3 icona'
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

    this.registerAliases('porsche-911-carrera-996', [
      '996',
      '996 carrera',
      'porsche 996',
      '996.1',
      '996.2',
      '996 cabriolet'
    ]);

    this.registerAliases('porsche-911-carrera-997', [
      '997',
      '997 carrera',
      'porsche 997',
      '997.1',
      '997.2'
    ]);

    this.registerAliases('lamborghini-huracan-lp610-4', [
      'huracan',
      'huracán',
      'huracan coupe',
      'huracan spyder',
      'lp610',
      'lp610-4'
    ]);

    this.registerAliases('mclaren-650s', [
      '650s',
      'mclaren 650s spider',
      '650s coupe'
    ]);

    this.registerAliases('mclaren-675lt', [
      '675lt',
      'mclaren 675lt spider',
      '675lt coupe',
      '675 lt'
    ]);

    this.registerAliases('toyota-crown-comfort-taxi', [
      'crown comfort',
      'hong kong taxi',
      'hk taxi',
      'urban taxi',
      'toyota taxi'
    ]);

    this.registerAliases('kia-ev9', [
      'ev9',
      'kia ev 9',
      'ev9 gt-line',
      'ev9 awd'
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
    const scoredResults: { record: CanonicalVehicleRecord; score: number }[] = [];
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
        scoredResults.push({ record, score });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.map((s) => s.record);
  }

  public resolveCanonicalIdentity(params: {
    vehicleId?: string | null;
    make?: string | null;
    model?: string | null;
    generation?: string | null;
    variant?: string | null;
    source?: string;
    specs?: Record<string, any>;
  }): OpenCanonicalIdentity {
    const { vehicleId, make, model, generation, variant, source = 'gemini', specs } = params;

    // 1. Try vehicleId
    let record: CanonicalVehicleRecord | null = null;
    if (vehicleId) {
      record = this.getById(vehicleId);
    }

    // 2. Try text / alias query
    if (!record && make && model) {
      const query = `${make} ${model} ${generation || ''}`;
      record = this.lookupByTextOrAlias(query);
    }

    // If registered record found:
    if (record) {
      return {
        canonicalId: record.vehicleId,
        make: record.make,
        modelFamily: record.model,
        generation: record.generation,
        variant: record.trim || variant || null,
        registryStatus: 'REGISTERED',
        source: 'registry',
        specs: {
          horsepower: record.horsepower,
          torqueNm: record.torqueNm,
          topSpeedKmH: record.topSpeedKmH,
          zeroToHundredSec: record.zeroToHundredSec,
          kerbWeightKg: record.kerbWeightKg,
          engine: record.engine,
          productionYears: record.productionYears,
          originCountry: record.originCountry,
          bodyStyle: record.bodyStyle,
          baselineRarity: record.baselineRarity,
          ...specs
        }
      };
    }

    // 3. Open World / Unregistered but Verified Identity:
    // If make and model are provided with evidence from upstream vision,
    // preserve them with VERIFIED_UNREGISTERED status rather than substituting another vehicle!
    const safeMake = (make || 'Unknown Make').trim();
    const safeModel = (model || 'Unknown Model').trim();
    const generatedId = `${this.normalize(safeMake)}-${this.normalize(safeModel)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      canonicalId: generatedId || 'unverified-vehicle',
      make: safeMake,
      modelFamily: safeModel,
      generation: generation || null,
      variant: variant || null,
      registryStatus: safeMake !== 'Unknown Make' && safeModel !== 'Unknown Model' ? 'VERIFIED_UNREGISTERED' : 'UNVERIFIED',
      source: (source as any) || 'gemini',
      specs: specs || {}
    };
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
