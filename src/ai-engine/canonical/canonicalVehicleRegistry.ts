/**
 * APEX — Canonical Vehicle Knowledge Graph & Registry
 * Immutable Vehicle Authority Dataset with Exact Specs, Generations, Trims, and Aliases
 * 
 * HARD INVARIANTS:
 * 1. Manufacturer-Scoped Aliases: Aliases are indexed and searched strictly within
 *    the candidate manufacturer's namespace when make is established.
 * 2. Monotonic Specificity: Model resolution selects the highest defensible specificity
 *    (Level 0 Make -> Level 1 Model Family -> Level 2 Generation -> Level 3 Body/Roof -> Level 4 Trim).
 * 3. Never Replace Make: A correct manufacturer must NEVER be substituted with an unrelated
 *    manufacturer due to superficial visual similarity.
 * 4. Display Name Ownership: Canonical record provides the definitive UI display title.
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
  displayName?: string;
  specificityLevel?: number; // 0 = make, 1 = model family, 2 = generation, 3 = body style/roof, 4 = trim/variant
}

function computeRecordSpecificity(item: { model: string; generation: string; trim?: string; bodyStyle: string }): number {
  if (item.trim && item.trim.trim() !== '' && item.trim !== 'Base') return 4;
  const m = (item.model || '').toLowerCase();
  if (/(?:\blp\s*\d+[- ]\d+\b|\bgt[234]\s*rs\b|\bsvj\b|\bsto\b|\bblack\s*series\b|\bweissach\b)/i.test(m)) {
    return 4;
  }
  if (/(?:\b\d+lt\b|\blt\b|\bgt[234]\b|\bsv\b|\btype[- ]r\b|\bcsl\b|\bpista\b|\bscuderia\b|\bnismo\b|\bcompetizione\b|\bperformante\b|\bsuperleggera\b)/i.test(m)) {
    return 3;
  }
  const b = (item.bodyStyle || '').toLowerCase();
  if (b.includes('convertible') || b.includes('spider') || b.includes('targa') || b.includes('cabriolet') || b.includes('roadster') || b.includes('speedster')) return 3;
  if (item.generation && item.generation.trim() !== '' && item.generation !== 'Base' && item.generation !== 'Current') return 2;
  if (item.model && item.model.trim() !== '') return 1;
  return 0;
}

function computeRecordDisplayName(item: { manufacturer: string; model: string; generation: string; trim?: string; bodyStyle: string }): string {
  const make = item.manufacturer;
  let model = item.model;
  if (model.toLowerCase().startsWith(make.toLowerCase() + ' ')) {
    model = model.slice(make.length + 1).trim();
  }

  const gen = item.generation;
  const isGenericGen = !gen || gen === 'Base' || gen === 'Current' || gen === model || model.includes(`(${gen})`);

  // A trim that is already carried by the model name must not be repeated (e.g. a record with
  // model "458 Spider" and trim "Spider" must render as "Ferrari 458 Spider", not
  // "Ferrari 458 Spider Spider").
  const trim = (item.trim || '').trim();
  const trimIsRedundant = !trim || trim === 'Base' || model.toLowerCase().includes(trim.toLowerCase());

  if (!trimIsRedundant) {
    return isGenericGen ? `${make} ${model} ${trim}` : `${make} ${model} ${trim} (${gen})`;
  }

  return isGenericGen ? `${make} ${model}` : `${make} ${model} (${gen})`;
}

class CanonicalVehicleRegistry {
  private registry: Map<string, CanonicalVehicleRecord> = new Map();
  private globalAliasLookup: Map<string, string> = new Map(); // normalized alias -> vehicleId
  private manufacturerScopedAliasLookup: Map<string, Map<string, string>> = new Map(); // normalizedMake -> normalizedAlias -> vehicleId
  private makeModelIndex: Map<string, CanonicalVehicleRecord[]> = new Map(); // "make_model" -> records

  constructor() {
    this.seedCanonicalDatabase();
  }

  private seedCanonicalDatabase() {
    // 1. Ingest base local database
    APEX_LOCAL_VEHICLE_DATABASE.forEach((item) => {
      const specificityLevel = computeRecordSpecificity(item);
      const displayName = computeRecordDisplayName(item);

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
        referenceImages: [],
        displayName,
        specificityLevel
      };

      this.registerVehicle(record);
    });

    // 2. Add extra aliases with strict manufacturer scoping
    // ── PORSCHE ──
    this.registerAliases('porsche-911-carrera-992', [
      '911',
      'porsche 911',
      '911 carrera',
      'porsche 911 carrera',
      '992',
      'porsche 992',
      '992 carrera',
      'porsche 992 carrera'
    ]);

    this.registerAliases('porsche-911-carrera-996', [
      '996',
      '996 carrera',
      'porsche 996',
      'porsche 996 carrera',
      '996.1',
      '996.2',
      '911 carrera 996',
      'porsche 911 carrera 996',
      'porsche 911 carrera (996)',
      '911 carrera (996)'
    ]);

    this.registerAliases('porsche-911-carrera-cabriolet-996', [
      '996 cabriolet',
      '996 carrera cabriolet',
      '911 carrera cabriolet',
      'porsche 911 carrera cabriolet',
      'porsche 996 cabriolet',
      '911 cabriolet',
      '996 cabrio',
      'carrera cabriolet 996'
    ]);

    this.registerAliases('porsche-911-carrera-997', [
      '997',
      '997 carrera',
      'porsche 997',
      'porsche 997 carrera',
      '997.1',
      '997.2',
      '911 carrera 997',
      'porsche 911 carrera 997',
      'porsche 911 carrera (997)',
      '911 carrera (997)'
    ]);

    this.registerAliases('porsche-718-boxster', [
      '718 boxster',
      'porsche 718 boxster',
      '718 boxster 982',
      'boxster 718',
      'boxster',
      'porsche boxster',
      '718'
    ]);

    this.registerAliases('porsche-911-gt3-rs', [
      'gt3 rs',
      'porsche 911 gt3 rs',
      '911 gt3 rs',
      '992 gt3 rs',
      'gt3 rs 992',
      'porsche 992 gt3 rs',
      '911 gt3rs',
      '992 gt3rs',
      'porsche-911-gt3-rs-992',
      'porsche-911-gt3-rs',
      'porsche 911 gt3 rs weissach package'
    ]);

    // NOTE: the "Turbo S" name forms belong to porsche-911-turbo-s-992. Registering them here
    // would silently hijack that record's own canonical name and collapse a 911 Turbo S onto a
    // 911 Turbo (same-manufacturer exact-model failure). Keep the namespaces disjoint.
    this.registerAliases('porsche-911-turbo', [
      '911 turbo',
      'porsche 911 turbo',
      'porsche turbo',
      '992 turbo',
      'porsche 992 turbo'
    ]);

    this.registerAliases('porsche-911-turbo-s-992', [
      '911 turbo s',
      'porsche 911 turbo s',
      '992 turbo s',
      'porsche 992 turbo s',
      '911 turbos',
      'porsche 911 turbos'
    ]);

    this.registerAliases('porsche-cayman-gt4-rs', [
      '718 cayman gt4 rs',
      'porsche 718 cayman gt4 rs',
      'cayman gt4 rs',
      'gt4 rs',
      'gt4rs',
      '718 cayman',
      'porsche 718 cayman',
      'cayman',
      'porsche cayman'
    ]);

    // NOTE: porsche-911-gt3-992 is intentionally NOT registered here. The 992 GT3 (non-RS)
    // has no canonical / vehicle-database record yet, and registerAliases() silently ignores
    // unknown vehicleIds — so a registration here would be a dead no-op rather than a fix.
    // Tracked in POSTPONED_ISSUES.md as a candidate-completeness gap.

    // ── FERRARI ──
    this.registerAliases('ferrari-amalfi', [
      'amalfi',
      'ferrari amalfi',
      'f169m',
      'ferrari f169m',
      'amalfi coupe',
      'ferrari amalfi coupe'
    ]);

    this.registerAliases('ferrari-458-italia', [
      '458',
      '458 italia',
      'ferrari 458',
      'ferrari 458 italia',
      'f142',
      'ferrari f142'
    ]);

    this.registerAliases('ferrari-458-spider', [
      '458 spider',
      'ferrari 458 spider',
      '458 convertible',
      'ferrari 458 convertible',
      '458 spyder',
      'ferrari 458 spyder',
      'f142 spider'
    ]);

    this.registerAliases('ferrari-daytona-sp3', [
      'daytona sp3',
      'ferrari daytona',
      'daytona sp3 icona',
      'ferrari daytona sp3',
      'ferrari daytona sp3 icona'
    ]);

    this.registerAliases('ferrari-488-pista', [
      '488 pista',
      'ferrari 488 pista',
      'pista',
      'ferrari pista'
    ]);

    this.registerAliases('ferrari-sf90-stradale', [
      'sf90',
      'sf90 stradale',
      'ferrari sf90',
      'ferrari sf90 stradale'
    ]);

    // ── MCLAREN ──
    this.registerAliases('mclaren-650s', [
      '650s',
      'mclaren 650s coupe',
      '650s coupe'
    ]);

    this.registerAliases('mclaren-650s-spider', [
      '650s spider',
      'mclaren 650s spider',
      '650s convertible'
    ]);

    this.registerAliases('mclaren-675lt', [
      '675lt',
      'mclaren 675lt coupe',
      '675lt coupe',
      '675 lt'
    ]);

    this.registerAliases('mclaren-675lt-spider', [
      '675lt spider',
      'mclaren 675lt spider',
      '675 lt spider',
      '675lt convertible'
    ]);

    this.registerAliases('mclaren-720s', [
      '720s',
      'mclaren 720s',
      '720s coupe',
      '720s spider'
    ]);

    this.registerAliases('mclaren-570s', [
      '570s',
      'mclaren 570',
      '570s coupe',
      '570s spider',
      '570gt'
    ]);

    this.registerAliases('mclaren-artura', [
      'artura',
      'mclaren artura',
      'artura spider'
    ]);

    // ── ASTON MARTIN ──
    this.registerAliases('aston-martin-dbs', [
      'dbs',
      'aston martin dbs',
      'dbs v12',
      'dbs coupe',
      'aston martin dbs (2007–2012)',
      'dbs 2007'
    ]);

    this.registerAliases('aston-martin-dbs-superleggera', [
      'dbs superleggera',
      'aston martin dbs superleggera',
      'aston martin dbs (2018–2024)',
      'dbs superleggera coupe',
      'dbs superleggera volante'
    ]);

    this.registerAliases('aston-martin-db9', [
      'db9',
      'aston martin db9',
      'db9 coupe',
      'db9 volante'
    ]);

    this.registerAliases('aston-martin-db7', [
      'db7',
      'aston martin db7',
      'db7 vantage',
      'db7 volante'
    ]);

    this.registerAliases('aston-martin-db4', [
      'db4',
      'aston martin db4',
      'db4 gt',
      'db4 series'
    ]);

    this.registerAliases('aston-martin-vanquish', [
      'vanquish',
      'aston martin vanquish',
      'vanquish s',
      'vanquish v12'
    ]);

    this.registerAliases('aston-martin-vantage', [
      'vantage',
      'aston martin vantage',
      'v8 vantage',
      'v12 vantage',
      'vantage coupe'
    ]);

    // ── MASERATI ──
    this.registerAliases('maserati-mc20', [
      'mc20',
      'maserati mc 20',
      'mc 20',
      'mc20 coupe',
      'maserati mc20 coupe'
    ]);

    this.registerAliases('maserati-mc20-cielo', [
      'mc20 cielo',
      'maserati mc20 cielo',
      'mc20 spyder',
      'mc20 convertible'
    ]);

    this.registerAliases('maserati-granturismo', [
      'granturismo',
      'gran turismo',
      'maserati gran turismo',
      'granturismo s',
      'granturismo sport',
      'granturismo mc'
    ]);

    this.registerAliases('maserati-grancabrio', [
      'grancabrio',
      'gran cabrio',
      'maserati grancabrio',
      'maserati gran cabrio',
      'granturismo convertible',
      'granturismo cabrio'
    ]);

    // ── LAMBORGHINI ──
    this.registerAliases('lamborghini-gallardo', [
      'gallardo',
      'lamborghini gallardo',
      'gallardo lp560',
      'gallardo lp550',
      'gallardo superleggera'
    ]);

    this.registerAliases('lamborghini-huracan-lp610-4', [
      'huracan',
      'huracán',
      'lamborghini huracan',
      'lamborghini huracán',
      'huracan lp610',
      'huracan lp610-4',
      'huracan coupe',
      'huracan spyder',
      'lp610',
      'lp610-4',
      'huracán evo',
      'huracan evo'
    ]);

    // ── NISSAN ──
    this.registerAliases('nissan-skyline-gtr-r34', [
      'skyline',
      'skyline gtr',
      'skyline gt-r',
      'nissan skyline',
      'nissan skyline gt-r',
      'r34',
      'r34 gtr',
      'r34 skyline',
      'skyline r34'
    ]);

    this.registerAliases('nissan-gt-r-nismo-r35', [
      'r35 nismo',
      'gtr nismo',
      'r35 gtr'
    ]);

    // ── HONDA ──
    this.registerAliases('honda-integra-type-r-dc2', [
      'integra',
      'integra type r',
      'dc2',
      'dc2 type r',
      'honda integra',
      'honda integra type r',
      'acura integra'
    ]);

    // ── TOYOTA ──
    this.registerAliases('toyota-gr-supra-a90', [
      'supra',
      'gr supra',
      'toyota supra',
      'toyota gr supra',
      'a90 supra',
      'supra a90',
      'a90',
      'a91'
    ]);

    this.registerAliases('toyota-crown-comfort-taxi', [
      'crown comfort',
      'hong kong taxi',
      'hk taxi',
      'urban taxi',
      'toyota taxi'
    ]);

    // ── OTHER ──
    this.registerAliases('mercedes-amg-gt', [
      'amg gt',
      'mercedes amg gt',
      'mercedes-benz amg gt',
      'amg gt coupe',
      'c190',
      'mercedes c190'
    ]);

    this.registerAliases('bmw-m3-competition-g80', [
      'g80 m3',
      'm3 competition',
      'bmw g80',
      'm3 comp'
    ]);

    this.registerAliases('kia-ev9', [
      'ev9',
      'kia ev 9',
      'ev9 gt-line',
      'ev9 awd'
    ]);

    this.registerAliases('koenigsegg-gemera', [
      'gemera',
      'koenigsegg gemera',
      'gemera hv8',
      'gemera tfg'
    ]);

    // ── ASTON MARTIN ──
    this.registerAliases('aston-martin-dbs', [
      'aston martin dbs',
      'dbs',
      'dbs v12',
      'dbs coupe',
      'aston martin dbs coupe',
      'aston martin dbs v12 coupe',
      'dbs v12 coupe'
    ]);

    this.registerAliases('aston-martin-db9', [
      'aston martin db9',
      'db9',
      'db9 coupe',
      'aston martin db9 coupe'
    ]);

    this.registerAliases('aston-martin-db7', [
      'aston martin db7',
      'db7',
      'db7 coupe',
      'db7 vantage'
    ]);

    this.registerAliases('aston-martin-db4', [
      'aston martin db4',
      'db4',
      'db4 superleggera',
      'db4 coupe',
      'aston martin db4 coupe'
    ]);

    this.registerAliases('aston-martin-vanquish', [
      'aston martin vanquish',
      'vanquish',
      'vanquish v12',
      'vanquish coupe',
      'aston martin vanquish coupe',
      'v12 vanquish'
    ]);

    this.registerAliases('aston-martin-vantage', [
      'aston martin vantage',
      'vantage',
      'v8 vantage',
      'v12 vantage',
      'aston martin v8 vantage',
      'aston martin v12 vantage',
      'vantage coupe'
    ]);

    // ── MERCEDES-BENZ S-CLASS & MAYBACH ──
    this.registerAliases('mercedes-s-class-w223', [
      'mercedes-benz s-class',
      'mercedes s-class',
      's-class',
      's580',
      's500',
      'w223',
      'mercedes w223',
      's-class w223',
      'mercedes s class'
    ]);

    this.registerAliases('mercedes-maybach-s-class', [
      'mercedes-maybach',
      'maybach s-class',
      'maybach',
      'mercedes-maybach s580',
      'mercedes-maybach s680',
      'maybach s580',
      'maybach s680',
      'z223',
      'mercedes maybach'
    ]);

    // ── BMW 7 SERIES ──
    this.registerAliases('bmw-7-series-g70', [
      'bmw 7 series',
      '7 series',
      'bmw 7-series',
      '740i',
      '760i',
      'g70',
      'bmw g70',
      '7 series sedan'
    ]);

    // ── LAMBORGHINI HURACÁN EVO ──
    this.registerAliases('lamborghini-huracan-evo', [
      'huracan evo',
      'lamborghini huracan evo',
      'huracán evo',
      'lamborghini huracán evo',
      'huracan evo coupe',
      'huracan evo spyder'
    ]);
  }

  public registerVehicle(record: CanonicalVehicleRecord) {
    this.registry.set(record.vehicleId, record);

    const normMake = this.normalize(record.make);
    if (!this.manufacturerScopedAliasLookup.has(normMake)) {
      this.manufacturerScopedAliasLookup.set(normMake, new Map());
    }
    const scopedMap = this.manufacturerScopedAliasLookup.get(normMake)!;

    // Index aliases
    record.aliases.forEach((alias) => {
      const norm = this.normalize(alias);
      this.globalAliasLookup.set(norm, record.vehicleId);
      scopedMap.set(norm, record.vehicleId);
    });

    // Index make+model
    const key = `${normMake}_${this.normalize(record.model)}`;
    const existing = this.makeModelIndex.get(key) || [];
    existing.push(record);
    this.makeModelIndex.set(key, existing);
  }

  public registerAliases(vehicleId: string, aliases: string[]) {
    const record = this.registry.get(vehicleId);
    if (!record) return;

    const normMake = this.normalize(record.make);
    if (!this.manufacturerScopedAliasLookup.has(normMake)) {
      this.manufacturerScopedAliasLookup.set(normMake, new Map());
    }
    const scopedMap = this.manufacturerScopedAliasLookup.get(normMake)!;

    aliases.forEach((alias) => {
      const norm = this.normalize(alias);
      this.globalAliasLookup.set(norm, vehicleId);
      scopedMap.set(norm, vehicleId);
      if (!record.aliases.includes(alias)) {
        record.aliases.push(alias);
      }
    });
  }

  public getById(vehicleId: string): CanonicalVehicleRecord | null {
    return this.registry.get(vehicleId) || null;
  }

  /**
   * Specificity-aware and manufacturer-scoped text/alias lookup.
   * 
   * When preferredMake is provided:
   * 1. Strictly scopes search to records belonging to that manufacturer.
   * 2. NEVER returns a candidate from a differing manufacturer.
   * 3. Selects the candidate with the highest defensible specificity (Level 4 > 3 > 2 > 1).
   */
  public lookupByTextOrAlias(query: string, preferredMake?: string): CanonicalVehicleRecord | null {
    if (!query) return null;
    const norm = this.normalize(query);
    const normMake = preferredMake ? this.normalize(preferredMake) : '';

    // 1. Scoped search when manufacturer is specified
    if (normMake) {
      const scopedMap = this.manufacturerScopedAliasLookup.get(normMake);
      const subNorm = norm.startsWith(normMake) ? norm.slice(normMake.length) : '';
      if (scopedMap) {
        if (scopedMap.has(norm)) {
          const id = scopedMap.get(norm)!;
          return this.registry.get(id) || null;
        }
        if (subNorm && scopedMap.has(subNorm)) {
          const id = scopedMap.get(subNorm)!;
          return this.registry.get(id) || null;
        }
        // Normalize parenthesized annotations (e.g. generation hints "Porsche Boxster (991)" -> "Porsche Boxster")
        if (query.includes('(')) {
          const cleanQuery = query.replace(/\s*\([^)]*\)/g, '').trim();
          const cleanNorm = this.normalize(cleanQuery);
          const cleanSubNorm = cleanNorm.startsWith(normMake) ? cleanNorm.slice(normMake.length) : '';
          if (scopedMap.has(cleanNorm)) {
            const id = scopedMap.get(cleanNorm)!;
            return this.registry.get(id) || null;
          }
          if (cleanSubNorm && scopedMap.has(cleanSubNorm)) {
            const id = scopedMap.get(cleanSubNorm)!;
            return this.registry.get(id) || null;
          }
        }
      }

      // Specificity-aware candidate matching strictly within this manufacturer
      const makeCandidates = Array.from(this.registry.values()).filter(
        (r) => this.normalize(r.make) === normMake
      );

      let bestRecord: CanonicalVehicleRecord | null = null;
      let bestScore = -1;

      for (const record of makeCandidates) {
        const recIdNorm = this.normalize(record.vehicleId);
        const recModelNorm = this.normalize(record.model);
        const recFullNorm = this.normalize(`${record.make} ${record.model} ${record.generation || ''} ${record.trim || ''}`);
        const recGenNorm = this.normalize(record.generation || '');

        let matchScore = 0;
        if (norm === recIdNorm || norm === recFullNorm) {
          matchScore = 150 + (record.specificityLevel || 1) * 10;
        } else if (norm.includes(recModelNorm) || recModelNorm.includes(norm)) {
          matchScore = 60 + (record.specificityLevel || 1) * 10;

          // Body/roof variant cues
          const hasConvertibleCue = norm.includes('cabrio') || norm.includes('spider') || norm.includes('convertible') || norm.includes('targa');
          if (hasConvertibleCue) {
            if (record.bodyStyle === 'Convertible' || (record.bodyStyle as string) === 'Targa') matchScore += 30;
            else matchScore -= 25; // Penalize coupe when convertible is explicitly mentioned
          }

          // Generation matching
          if (recGenNorm && norm.includes(recGenNorm)) {
            matchScore += 25;
          }

          // Performance trim matching
          if (record.trim && norm.includes(this.normalize(record.trim))) {
            matchScore += 35;
          }
        }

        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestRecord = record;
        }
      }

      if (bestRecord && bestScore >= 40) {
        return bestRecord;
      }

      // Hard Manufacturer Lock: NEVER substitute another manufacturer when make is known!
      return null;
    }

    // 2. Unconstrained global alias lookup (only when make is completely unprovided)
    if (this.globalAliasLookup.has(norm)) {
      const id = this.globalAliasLookup.get(norm)!;
      return this.registry.get(id) || null;
    }

    // 3. Fallback partial match across registry with highest specificity priority
    let bestGlobal: CanonicalVehicleRecord | null = null;
    let bestGlobalScore = -1;
    for (const record of this.registry.values()) {
      const recNorm = this.normalize(`${record.make} ${record.model}`);
      if (norm.includes(recNorm) || recNorm.includes(norm)) {
        const score = 10 + (record.specificityLevel || 1) * 5;
        if (score > bestGlobalScore) {
          bestGlobalScore = score;
          bestGlobal = record;
        }
      }
    }

    return bestGlobal;
  }

  /**
   * Find matching candidates for a given make, model, and generation.
   * HARD INVARIANT: When make is provided, candidates from differing makes are strictly excluded.
   */
  public findMatchingCandidates(make?: string, model?: string, generation?: string): CanonicalVehicleRecord[] {
    const scoredResults: { record: CanonicalVehicleRecord; score: number }[] = [];
    const normMake = make ? this.normalize(make) : '';
    const normModel = model ? this.normalize(model) : '';
    const normGen = generation ? this.normalize(generation) : '';

    for (const record of this.registry.values()) {
      const recMake = this.normalize(record.make);
      const recModel = this.normalize(record.model);
      const recGen = this.normalize(record.generation);

      // HARD INVARIANT: If manufacturer is specified, exclude candidates from other manufacturers
      if (normMake && recMake !== normMake && !recMake.includes(normMake) && !normMake.includes(recMake)) {
        continue;
      }

      let score = 0;
      if (normMake && (recMake === normMake || recMake.includes(normMake))) score += 5;
      if (normModel && (recModel.includes(normModel) || normModel.includes(recModel))) score += 5;
      if (normGen && (recGen.includes(normGen) || normGen.includes(recGen))) score += 4;

      if (score > 0) {
        // Higher specificity level breaks ties cleanly
        scoredResults.push({ record, score: score + (record.specificityLevel || 1) * 0.1 });
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

    // 2. Try text / alias query with preferredMake scoping
    if (!record && make && model) {
      const query = `${make} ${model} ${generation || ''} ${variant || ''}`.trim();
      record = this.lookupByTextOrAlias(query, make);
      if (!record) {
        record = this.lookupByTextOrAlias(`${model} ${generation || ''}`.trim(), make);
      }
    }

    // If registered record found:
    if (record) {
      return {
        canonicalId: record.vehicleId,
        make: record.make,
        modelFamily: record.model,
        generation: record.generation,
        // INVARIANT: Never backfill trim from catalog record. Variant requires direct visual corroboration.
        variant: variant || null,
        registryStatus: 'REGISTERED',
        source: 'registry',
        displayName: record.displayName || `${record.make} ${record.model}`,
        specificityLevel: record.specificityLevel ?? computeRecordSpecificity(record),
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

    const specificityLevel = variant ? 4 : generation ? 2 : safeModel !== 'Unknown Model' ? 1 : 0;

    return {
      canonicalId: generatedId || 'unverified-vehicle',
      make: safeMake,
      modelFamily: safeModel,
      generation: generation || null,
      variant: variant || null,
      registryStatus: safeMake !== 'Unknown Make' && safeModel !== 'Unknown Model' ? 'VERIFIED_UNREGISTERED' : 'UNVERIFIED',
      source: (source as any) || 'gemini',
      displayName: `${safeMake} ${safeModel}`,
      specificityLevel,
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
}

export const canonicalVehicleRegistry = new CanonicalVehicleRegistry();
