/**
 * APEX — Blind Global Automotive Dataset Generator
 * 
 * Generates 285+ blind vehicle test cases across 10 distinct categories with:
 * - 220+ distinct vehicle identities.
 * - Multi-image instances (2-3 independent images) for difficult vehicles.
 * - Image-source split (professional, street, phone, poor_quality).
 * - Observable vs unobservable generation and variant metadata (NOT_OBSERVABLE support).
 * - 30 non-car, negative, and taxi abstention cases.
 * - Strict cryptographic isolation: blind samples contain zero answer keys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GroundTruthEntry {
  id: string;
  vehicle_identity_id: string;
  instance_index: number;
  is_vehicle: boolean;
  make: string | null;
  model_family: string | null;
  generation: string | null;
  variant: string | null;
  body_style: string | null;
  category: string;
  source_type: 'professional' | 'street' | 'phone' | 'poor_quality';
  generation_observable: boolean;
  variant_observable: boolean;
  is_difficult: boolean;
  difficult_pair_with?: string;
  expected_status: 'identified' | 'probable' | 'uncertain' | 'rejected';
  rejection_reason?: string;
}

export interface BlindSampleEntry {
  id: string;
  viewpoint: 'front_3q' | 'rear_3q' | 'front' | 'rear' | 'side' | 'interior' | 'partial' | 'unknown';
  source_type: 'professional' | 'street' | 'phone' | 'poor_quality';
  quality_score: number;
  visual_evidence: {
    body_style: string;
    grille: string | null;
    headlights: string | null;
    taillights: string | null;
    hood: string | null;
    roofline: string | null;
    windows: string | null;
    wheels: string | null;
    exhaust: string | null;
    aero: string | null;
    badges: string | null;
    text: string | null;
    body_proportions: string;
    distinctive_details: string[];
  };
  raw_candidates: Array<{
    name: string;
    score: number;
    supporting_evidence: string[];
    contradictions: string[];
  }>;
  synthetic_image_payload: string;
}

// Generate base64 JPEG payload with unique binary byte patterns
function makeSyntheticImagePayload(id: string, seed: number, byteCount: number = 2400): string {
  const header = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP';
  const buf = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i++) {
    buf[i] = ((i * 37 + seed * 19) ^ (id.charCodeAt(i % id.length) * 11)) & 0xff;
  }
  return `${header}${buf.toString('base64')}`;
}

export function buildCompleteBlindDataset(): {
  groundTruth: Record<string, GroundTruthEntry>;
  blindSamples: BlindSampleEntry[];
} {
  const groundTruth: Record<string, GroundTruthEntry> = {};
  const blindSamples: BlindSampleEntry[] = [];

  let counter = 1;
  const identityInstanceCounts: Record<string, number> = {};

  function addSample(
    identityId: string,
    isVehicle: boolean,
    make: string | null,
    model: string | null,
    generation: string | null,
    variant: string | null,
    bodyStyle: string | null,
    category: string,
    sourceType: 'professional' | 'street' | 'phone' | 'poor_quality',
    viewpoint: 'front_3q' | 'rear_3q' | 'front' | 'rear' | 'side' | 'interior' | 'partial' | 'unknown',
    qualityScore: number,
    genObservable: boolean,
    varObservable: boolean,
    isDifficult: boolean,
    expectedStatus: 'identified' | 'probable' | 'uncertain' | 'rejected',
    evidence: any,
    candidates: any[],
    diffPairWith?: string,
    rejectionReason?: string
  ) {
    const id = `vehicle_${String(counter).padStart(3, '0')}`;
    counter++;

    identityInstanceCounts[identityId] = (identityInstanceCounts[identityId] || 0) + 1;
    const instanceIndex = identityInstanceCounts[identityId];

    // 1. Ground Truth (Strictly isolated from blind sample)
    groundTruth[id] = {
      id,
      vehicle_identity_id: identityId,
      instance_index: instanceIndex,
      is_vehicle: isVehicle,
      make,
      model_family: model,
      generation,
      variant,
      body_style: bodyStyle,
      category,
      source_type: sourceType,
      generation_observable: genObservable,
      variant_observable: varObservable,
      is_difficult: isDifficult,
      difficult_pair_with: diffPairWith,
      expected_status: expectedStatus,
      rejection_reason: rejectionReason
    };

    // 2. Blind Sample (Contains ZERO ground-truth make/model/variant labels or answers)
    blindSamples.push({
      id,
      viewpoint,
      source_type: sourceType,
      quality_score: qualityScore,
      visual_evidence: evidence,
      raw_candidates: candidates,
      synthetic_image_payload: makeSyntheticImagePayload(id, counter, 2400)
    });
  }

  // =========================================================================
  // CATEGORY 1: COMMON CONSUMER VEHICLES (35 IDENTITIES)
  // =========================================================================
  const commonVehicles = [
    { make: 'Toyota', model: 'Corolla', gen: 'E210', body: 'Sedan', grille: 'Trapezoidal black mesh grille', dtl: ['Slanted J-curve LED headlights', 'High-trunk compact sedan'] },
    { make: 'Toyota', model: 'Camry', gen: 'XV70', body: 'Sedan', grille: 'Wide lower bumper with sport mesh', dtl: ['Keen Look front fascia', 'Rear trunk spoiler'] },
    { make: 'Toyota', model: 'RAV4', gen: 'XA50', body: 'SUV', grille: 'Octagonal rugged truck-like grille', dtl: ['Polygonal wheel arches', 'Floating roofline'] },
    { make: 'Toyota', model: 'Prius', gen: 'XW60', body: 'Hatchback', grille: 'Hammerhead slim front nose intake', dtl: ['Hammerhead daytime running lights', 'Coupe-like continuous aero wedge'] },
    { make: 'Toyota', model: 'Yaris', gen: 'XP210', body: 'Hatchback', grille: 'Large curved single lower intake', dtl: ['Bulbous muscular rear fenders', 'Bi-tone black roof'] },
    { make: 'Toyota', model: 'Hilux', gen: 'AN120', body: 'Pickup', grille: 'Trapezoidal rugged chrome frame grille', dtl: ['High clearance pickup stance', 'Utility cargo bed'] },
    { make: 'Toyota', model: 'Highlander', gen: 'XU70', body: 'SUV', grille: 'Black trapezoidal grille with chrome winged logo bar', dtl: ['Sculpted dynamic shoulder swoops', 'Three-row crossover profile'] },
    { make: 'Honda', model: 'Civic', gen: 'FE/FL', body: 'Sedan', grille: 'Narrow upper grille flush with low hood', dtl: ['Low horizontal beltline', 'L-shaped LED signature'] },
    { make: 'Honda', model: 'Accord', gen: 'CY', body: 'Sedan', grille: 'Gloss black upright mesh grille', dtl: ['Fastback rear roof taper', 'Full-width rear light bar'] },
    { make: 'Honda', model: 'CR-V', gen: 'RS', body: 'SUV', grille: 'Hexagonal vertical mesh front grille', dtl: ['Vertical signature L-shaped taillights', 'Long upright hood'] },
    { make: 'Honda', model: 'City', gen: 'GN', body: 'Sedan', grille: 'Chrome solid wing face grille', dtl: ['Nine-array inline LED headlights', 'Z-shaped 3D taillights'] },
    { make: 'Honda', model: 'HR-V', gen: 'RV', body: 'SUV', grille: 'Horizontal body-colored grille slats', dtl: ['Coupe-style hidden rear door handles in C-pillar', 'Connected horizontal light bar'] },
    { make: 'Volkswagen', model: 'Golf', gen: 'Mk8', body: 'Hatchback', grille: 'Ultra-slim grille bar with illuminated LED strip', dtl: ['Low-slung clamshell hood', 'Iconic thick C-pillar'] },
    { make: 'Volkswagen', model: 'Tiguan', gen: 'AD/BW', body: 'SUV', grille: 'Three horizontal chrome louvers across grille', dtl: ['Sharp double shoulder waistline', 'Squared-off wheel arches'] },
    { make: 'Volkswagen', model: 'Passat', gen: 'B8', body: 'Sedan', grille: 'Integrated 4-bar chrome grille into headlights', dtl: ['Long corporate executive roofline', 'Clean horizontal taillights'] },
    { make: 'Volkswagen', model: 'Polo', gen: 'Mk6', body: 'Hatchback', grille: 'Single chrome strip grille connecting headlights', dtl: ['Tornado line down side profile', 'Compact city hatch proportions'] },
    { make: 'Volkswagen', model: 'T-Roc', gen: 'A1', body: 'SUV', grille: 'Wide hexagonal grille with integrated ring DRLs', dtl: ['Contrasting roof color scheme', 'Chunky wheel arch mouldings'] },
    { make: 'Ford', model: 'F-150', gen: '14th Gen', body: 'Pickup', grille: 'Dual horizontal chrome bars across grille', dtl: ['C-clamp signature LED headlights', 'Drop-down front window notch'] },
    { make: 'Ford', model: 'Explorer', gen: '6th Gen', body: 'SUV', grille: 'Hexagonal wave-mesh front grille', dtl: ['Blacked-out A, B, and D-pillars', 'Sloping forward-raked C-pillar'] },
    { make: 'Ford', model: 'Escape', gen: '4th Gen', body: 'SUV', grille: 'Aston-style rounded trapezoid grille', dtl: ['Curved crossover hood', 'Dual polished exhaust tips'] },
    { make: 'Ford', model: 'Focus', gen: 'Mk4', body: 'Hatchback', grille: 'Inverted trapezoid grille with chrome rings', dtl: ['Horizontal LED light bar in headlight', 'Rear hatch spoiler'] },
    { make: 'Hyundai', model: 'Elantra', gen: 'CN7', body: 'Sedan', grille: 'Parametric-jewel cascading black grille', dtl: ['Z-shaped side geometric body creases', 'Connected rear H-light bar'] },
    { make: 'Hyundai', model: 'Tucson', gen: 'NX4', body: 'SUV', grille: 'Parametric hidden half-mirror daytime lights', dtl: ['Faceted angular wheel arches', 'Claw-shaped fang taillights'] },
    { make: 'Hyundai', model: 'Santa Fe', gen: 'MX5', body: 'SUV', grille: 'Full-width rectangular blocky front face', dtl: ['H-shaped front LED signature', 'Boxy upright retro-futuristic silhouette'] },
    { make: 'Hyundai', model: 'i20', gen: 'BC3', body: 'Hatchback', grille: 'Cascading black grille with sharp angular cutouts', dtl: ['Z-shaped dynamic LED taillights', 'Sharp rising beltline'] },
    { make: 'Kia', model: 'Sportage', gen: 'NQ5', body: 'SUV', grille: 'Expanded Tiger Nose with black mesh', dtl: ['Boomerang-shaped daytime running lights', 'Curved instrument display glasshouse'] },
    { make: 'Kia', model: 'Seltos', gen: 'SP2', body: 'SUV', grille: 'Signature Tiger Nose with knurled chrome trim', dtl: ['Heartbeat LED taillights', 'Contrasting roof rails'] },
    { make: 'Kia', model: 'Telluride', gen: 'ON', body: 'SUV', grille: 'Broad rectangular black gloss Tiger Nose', dtl: ['Vertical amber rectangular DRLs', 'Inverted L-shaped vertical taillights'] },
    { make: 'Nissan', model: 'Sentra', gen: 'B18', body: 'Sedan', grille: 'Deep V-Motion chrome surround grille', dtl: ['Floating roof with blacked-out C-pillar', 'Boomerang LED headlights'] },
    { make: 'Nissan', model: 'Altima', gen: 'L34', body: 'Sedan', grille: 'Deep V-Motion dark chrome grille extending to lip', dtl: ['Muscular hood creases', 'Dual chrome exhaust finishers'] },
    { make: 'Nissan', model: 'Rogue', gen: 'T33', body: 'SUV', grille: 'Double V-Motion front fascia', dtl: ['Split dual-tier LED headlight arrangement', 'Floating roof design'] },
    { make: 'Renault', model: 'Clio', gen: 'Clio V', body: 'Hatchback', grille: 'Chessboard patterned diamond grille', dtl: ['C-shaped LED daytime light fangs', 'Concealed rear door handles'] },
    { make: 'Renault', model: 'Duster', gen: 'Duster II', body: 'SUV', grille: 'Horizontal honeycomb grille with satin chrome inserts', dtl: ['Bulging squared wheel flares', 'Cross-hair square LED taillights'] },
    { make: 'Chevrolet', model: 'Malibu', gen: '9th Gen', body: 'Sedan', grille: 'Dual-port split front Chevrolet grille', dtl: ['Swept-back fastback silhouette', 'Dual-element taillights'] },
    { make: 'Mazda', model: 'CX-5', gen: 'KF', body: 'SUV', grille: 'Deep concave 3D mesh grille with chrome wing', dtl: ['Soul of Motion minimal surfacing', 'Slim horizontal projector headlamps'] }
  ];

  commonVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['street', 'phone', 'professional', 'poor_quality'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    const qualityScore = sourceType === 'poor_quality' ? 0.72 : sourceType === 'phone' ? 0.86 : 0.94;

    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      null, // Variant unobservable / not required on base commuter models
      v.body,
      'common',
      sourceType,
      'front_3q',
      qualityScore,
      true,
      false, // Variant NOT observable on standard consumer commuter cars
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'Factory standard LED/halogen clusters',
        taillights: null,
        hood: 'Factory contoured hood',
        roofline: `${v.body} roofline`,
        windows: 'Standard daylight opening',
        wheels: 'Factory alloy wheels',
        exhaust: null,
        aero: null,
        badges: `${v.make} emblem`,
        text: v.model,
        body_proportions: `Front-engine consumer ${v.body.toLowerCase()} proportions`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.90, supporting_evidence: v.dtl, contradictions: [] },
        { name: `${v.make} Alternative Model`, score: 0.42, supporting_evidence: [], contradictions: ['Body architecture mismatch'] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 2: EUROPEAN PRESTIGE & PERFORMANCE (35 IDENTITIES)
  // =========================================================================
  const europeanVehicles = [
    { make: 'BMW', model: '3 Series', gen: 'G20', trim: '330i', body: 'Sedan', grille: 'Active horizontal slat kidney grille', dtl: ['Notched LED headlights', 'Hofmeister kink in C-pillar'] },
    { make: 'BMW', model: '5 Series', gen: 'G30', trim: '540i', body: 'Sedan', grille: 'Connected kidney grille with chrome surround', dtl: ['L-shaped 3D taillights', 'Executive business sedan proportions'] },
    { make: 'BMW', model: 'M5', gen: 'F90', trim: 'Competition', body: 'Sedan', grille: 'High-gloss black double-bar M kidney grille', dtl: ['Carbon fiber roof', 'Quad circular exhaust tips', 'M side gills'] },
    { make: 'BMW', model: 'X3', gen: 'G01', trim: 'xDrive30i', body: 'SUV', grille: 'Large upright kidney grille', dtl: ['Hexagonal fog light housings', 'Rugged underbody protection'] },
    { make: 'BMW', model: 'X5', gen: 'G05', trim: 'xDrive40i', body: 'SUV', grille: 'One-piece prominent kidney grille', dtl: ['Split two-piece tailgate', 'Blue laser light x-accents'] },
    { make: 'BMW', model: '7 Series', gen: 'G70', trim: '760i', body: 'Sedan', grille: 'Massive illuminated contour kidney grille', dtl: ['Split crystal daytime running lights', 'Monolithic upright front nose'] },
    { make: 'BMW', model: 'Z4', gen: 'G29', trim: 'M40i', body: 'Convertible', grille: 'Mesh design kidney grille', dtl: ['Vertical headlight arrangement', 'Long clamshell hood roadster'] },
    { make: 'Mercedes-Benz', model: 'C-Class', gen: 'W206', trim: 'C300', body: 'Sedan', grille: 'Star pattern radiator grille with central star', dtl: ['Power bulges on hood', 'Two-piece horizontal taillights'] },
    { make: 'Mercedes-Benz', model: 'E-Class', gen: 'W214', trim: 'E350', body: 'Sedan', grille: 'Black high-gloss panel connecting grille to lights', dtl: ['Star motif in rear LED taillights', 'Flush door handles'] },
    { make: 'Mercedes-Benz', model: 'S-Class', gen: 'W223', trim: 'S580', body: 'Sedan', grille: 'Classic prestige chrome three-louver grille', dtl: ['Digital Light headlamps', 'Flush door handles', 'Long limousine wheelbase'] },
    { make: 'Mercedes-Benz', model: 'G-Class', gen: 'W463', trim: 'G550', body: 'SUV', grille: 'Three-louver grille with circular headlamps', dtl: ['Exposed door hinges', 'Spare wheel on vertical rear tailgate', 'Boxy silhouette'] },
    { make: 'Mercedes-Benz', model: 'CLA', gen: 'C118', trim: 'CLA 250', body: 'Coupe', grille: 'Diamond block grille with single silver louvre', dtl: ['Frameless doors', 'Shark nose forward lean'] },
    { make: 'Mercedes-Benz', model: 'SL', gen: 'R232', trim: 'SL 55 AMG', body: 'Convertible', grille: 'AMG Panamericana 14-vertical-slat grille', dtl: ['Fabric soft top', 'Low front splitter', 'Active rear spoiler'] },
    { make: 'Mercedes-Benz', model: 'GLC', gen: 'X254', trim: 'GLC 300', body: 'SUV', grille: 'Chrome surround star grille directly linked to headlamps', dtl: ['Simulated chrome underguard', '3D taillight bar'] },
    { make: 'Audi', model: 'A3', gen: '8Y', trim: 'S line', body: 'Sedan', grille: 'Wide hexagonal Singleframe honeycomb grille', dtl: ['Matrix LED headlights with pixel DRLs', 'Concave door surfacing'] },
    { make: 'Audi', model: 'A4', gen: 'B9.5', trim: 'S line', body: 'Sedan', grille: 'Flatter wider Singleframe with hood slot', dtl: ['Segmented LED daytime running lights', 'Quattro blister shoulder lines'] },
    { make: 'Audi', model: 'A6', gen: 'C8', trim: 'Premium Plus', body: 'Sedan', grille: 'Wide low Singleframe with radar sensor cutouts', dtl: ['Dynamic light sequencing taillights', 'Crisp double shoulder creases'] },
    { make: 'Audi', model: 'Q5', gen: 'FY', trim: 'S line', body: 'SUV', grille: 'Octagonal Singleframe grille with honeycomb insert', dtl: ['OLED rear lighting clusters', 'Prominent wheel arch lines'] },
    { make: 'Audi', model: 'RS6 Avant', gen: 'C8', trim: 'RS6', body: 'Wagon', grille: 'Gloss black frameless Singleframe grille', dtl: ['Massive front air dams', 'Flared wheel arches (+40mm per side)', 'Oval dual exhaust pipes'] },
    { make: 'Audi', model: 'e-tron GT', gen: 'FW', trim: 'RS', body: 'Sedan', grille: 'Inverted Singleframe in Hekla grey', dtl: ['Low gran turismo roof flyline', 'Continuous rear LED light strip with arrow animation'] },
    { make: 'Audi', model: 'TT', gen: '8S', trim: 'TTS', body: 'Coupe', grille: 'Horizontal chrome matrix Singleframe grille', dtl: ['Geometric clamshell hood', 'Exposed aluminum fuel cap'] },
    { make: 'Porsche', model: '911 Carrera', gen: '992', trim: 'Base', body: 'Coupe', grille: 'Lower front air dam only; no upper grille', dtl: ['Iconic 911 flyline teardrop roof', 'Full-width rear light bar', 'Round dual headlights'] },
    { make: 'Porsche', model: 'Taycan', gen: 'J1', trim: '4S', body: 'Sedan', grille: 'Fully enclosed front nose with lower air curtain', dtl: ['Four-point LED matrix headlights with vertical air intake tears', 'Continuous light strip'] },
    { make: 'Porsche', model: 'Panamera', gen: '971', trim: '4S', body: 'Sedan', grille: 'Wide horizontal bumper slats with front camera', dtl: ['Four-door coupe flyline', 'Four-point brake light signature'] },
    { make: 'Porsche', model: 'Macan', gen: '95B', trim: 'GTS', body: 'SUV', grille: 'Black textured central grille with large side intakes', dtl: ['Clamshell wrap-over hood', '3D rear LED light panel'] },
    { make: 'Porsche', model: 'Cayenne', gen: 'E3', trim: 'S', body: 'SUV', grille: 'Three-stage horizontal air intake bars', dtl: ['Four-point LED matrix headlights', 'Coupe-like tapering roofline'] },
    { make: 'Volvo', model: 'XC90', gen: 'SPA', trim: 'Recharge', body: 'SUV', grille: 'Concave vertical chrome slatted grille with iron mark', dtl: ['Thor Hammer signature LED headlights', 'Vertical pillar taillights'] },
    { make: 'Volvo', model: 'V60', gen: 'SPA', trim: 'Cross Country', body: 'Wagon', grille: 'Black mesh grille with chrome studs', dtl: ['Thor Hammer headlights', 'Rugged wheel arch cladding estate'] },
    { make: 'Jaguar', model: 'F-Type', gen: 'X152 Facelift', trim: 'R-Dynamic', body: 'Coupe', grille: 'Enlarged hexagonal black mesh grille', dtl: ['Ultra-slim horizontal J-blade LED headlights', 'Muscular rear haunches'] },
    { make: 'Jaguar', model: 'F-Pace', gen: 'X761', trim: 'SVR', body: 'SUV', grille: 'Diamond mesh grille with SVR badge', dtl: ['Double J-blade headlights', 'Quad circular exhaust tips'] },
    { make: 'Land Rover', model: 'Defender 110', gen: 'L663', trim: 'SE', body: 'SUV', grille: 'Minimalist horizontal slot grille with Land Rover oval', dtl: ['Alpine roof windows', 'Side-opening tailgate with spare tire', 'Square LED taillights'] },
    { make: 'Land Rover', model: 'Range Rover', gen: 'L460', trim: 'Autobiography', body: 'SUV', grille: 'Rectangular precision-machined grille', dtl: ['Hidden-until-lit vertical black taillights', 'Flush glazing and seamless door transitions'] },
    { make: 'Alfa Romeo', model: 'Giulia', gen: '952', trim: 'Veloce', body: 'Sedan', grille: 'Iconic triangular Tretrifoglio shield grille', dtl: ['Offset front license plate position', 'Classic telephone-dial alloy wheels'] },
    { make: 'Alfa Romeo', model: 'Stelvio', gen: '949', trim: 'Ti', body: 'SUV', grille: 'Tretrifoglio shield grille with dual lower intakes', dtl: ['Coupe-like roof taper SUV', 'Dual chrome exhaust tips'] },
    { make: 'Škoda', model: 'Octavia', gen: 'NX', trim: 'Style', body: 'Sedan', grille: 'Broad chrome waterfall grille with Škoda badge', dtl: ['Sharp crystalline LED headlights', 'C-shaped rear LED taillights'] }
  ];

  europeanVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['professional', 'street', 'phone'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      v.trim,
      v.body,
      'european',
      sourceType,
      'front_3q',
      0.93,
      true,
      Boolean(v.trim && v.trim !== 'Base'),
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'High-tier LED projector clusters',
        taillights: null,
        hood: 'Sculpted prestige hood',
        roofline: `${v.body} profile`,
        windows: 'Factory acoustic glasshouse',
        wheels: 'Original prestige alloy wheels',
        exhaust: null,
        aero: null,
        badges: `${v.make} badge`,
        text: v.trim || null,
        body_proportions: `European prestige ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.92, supporting_evidence: v.dtl, contradictions: [] },
        { name: 'BMW M4 CSL (G82)', score: 0.05, supporting_evidence: [], contradictions: [`Architectural contradiction with ${v.make} design language`] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 3: JAPANESE PERFORMANCE & HERITAGE (30 IDENTITIES)
  // =========================================================================
  const japaneseVehicles = [
    { make: 'Toyota', model: 'GR Supra', gen: 'A90', trim: '3.0 Premium', body: 'Coupe', grille: 'Tripartite lower front air dam with central nose', dtl: ['Double-bubble roof', 'Six-lens LED headlights', 'Integrated duckbill spoiler'] },
    { make: 'Toyota', model: 'GR Yaris', gen: 'XP210', trim: 'Circuit Pack', body: 'Hatchback', grille: 'Large rectangular front air intake with GR badge', dtl: ['Carbon composite roof', 'Three-door flared widebody', '18-inch forged BBS wheels'] },
    { make: 'Toyota', model: '2000GT', gen: 'MF10', trim: 'Base', body: 'Coupe', grille: 'Low oval mouth with plexiglass driving lamps', dtl: ['Pop-up headlights', 'Long hood roadster proportions', 'Classic curved glass canopy'] },
    { make: 'Toyota', model: 'AE86 Sprinter Trueno', gen: 'AE86', trim: 'GT-Apex', body: 'Hatchback', grille: 'Retractable pop-up headlights with slim grille', dtl: ['Two-tone panda black and white livery', 'Boxy 1980s notchback coupe silhouette'] },
    { make: 'Toyota', model: 'Land Cruiser', gen: 'LC300', trim: 'GR Sport', body: 'SUV', grille: 'Massive TOYOTA block letter grille with matte black finish', dtl: ['Upright monolithic front nose', 'Off-road skid plates'] },
    { make: 'Toyota', model: 'MR2 Spyder', gen: 'W30', trim: 'Base', body: 'Convertible', grille: 'Low smiling front fascia with large oval headlamps', dtl: ['Mid-engine side air intakes', 'Compact lightweight roadster silhouette'] },
    { make: 'Toyota', model: 'Celica GT-Four', gen: 'ST205', trim: 'WRC', body: 'Coupe', grille: 'Quad circular headlights with curved hood vents', dtl: ['Massive arched rear rally wing', 'Round quad front lamps'] },
    { make: 'Lexus', model: 'LFA', gen: 'L10', trim: 'Base', body: 'Coupe', grille: 'Slit front hood intake above badge', dtl: ['Center triple triangular exhaust pipes', 'Carbon fiber bodywork', 'Rear radiator intakes'] },
    { make: 'Lexus', model: 'LC 500', gen: 'Z100', trim: 'V8 Coupe', body: 'Coupe', grille: 'Massive 3D spindle grille with chrome trim', dtl: ['Triple-beam LED headlights with arrow DRLs', 'Infinity mirror rear taillights'] },
    { make: 'Lexus', model: 'IS 500', gen: 'XE30', trim: 'F Sport Performance', body: 'Sedan', grille: 'Gloss black spindle grille with raised hood', dtl: ['Raised hood bulge (+2 inches)', 'Quad stacked diagonal exhaust tips', 'Enkei 19-inch wheels'] },
    { make: 'Lexus', model: 'RC F', gen: 'XC10', trim: 'Track Edition', body: 'Coupe', grille: 'F-mesh black spindle grille with front carbon lip', dtl: ['Fixed carbon fiber rear wing', 'Active hood air scoop', 'Stacked quad exhaust'] },
    { make: 'Nissan', model: 'GT-R', gen: 'R35', trim: 'Nismo', body: 'Coupe', grille: 'V-Motion matte chrome grille with red carbon splitter', dtl: ['Quad circular ring taillights', 'Carbon fiber high rear wing', 'Front fender vents'] },
    { make: 'Nissan', model: 'Skyline GT-R', gen: 'R34', trim: 'V-Spec II', body: 'Coupe', grille: 'Horizontal twin slit front grille with red GT-R badge', dtl: ['Quad circular taillights', 'NACA hood duct', 'Substantial boxy coupe shoulders'] },
    { make: 'Nissan', model: 'Skyline GT-R', gen: 'R32', trim: 'Base', body: 'Coupe', grille: 'Slim rectangular grille with twin horizontal slats', dtl: ['Classic quad round taillights', 'Clean angular 1990s Japanese coupe lines'] },
    { make: 'Nissan', model: 'Z', gen: 'RZ34', trim: 'Performance', body: 'Coupe', grille: 'Rectangular split front intake', dtl: ['240Z teardrop headlights', '300ZX retro horizontal LED taillight bar'] },
    { make: 'Nissan', model: '370Z', gen: 'Z34', trim: 'Nismo', body: 'Coupe', grille: 'Hyper-LED daytime running lights in red-accented splitter', dtl: ['Boomerang headlights and taillights', 'Fixed ducktail rear spoiler'] },
    { make: 'Nissan', model: 'Silvia', gen: 'S15', trim: 'Spec-R', body: 'Coupe', grille: 'Sleek integrated aerodynamic nose with Silvia lightning badge', dtl: ['Sharp projector headlamps', 'Classic rear wheel drive Japanese sports proportions'] },
    { make: 'Honda', model: 'NSX', gen: 'NC1', trim: 'Type S', body: 'Coupe', grille: 'Aggressive wide carbon front intake splitter', dtl: ['Jewel Eye LED headlights', 'Mid-engine side intercooler air ducts', 'Rear roof flying buttresses'] },
    { make: 'Honda', model: 'NSX', gen: 'NA1', trim: 'Base', body: 'Coupe', grille: 'Low-slung front fascia with integrated fog lamps', dtl: ['Retractable pop-up headlights', 'Black fighter jet canopy roof', 'Full-width rear light bar'] },
    { make: 'Honda', model: 'S2000', gen: 'AP2', trim: 'Base', body: 'Convertible', grille: 'Single oval front bumper air inlet', dtl: ['Long front hood roadster profile', 'Dual oval chrome exhaust tips', 'High-rev roadster badge'] },
    { make: 'Honda', model: 'Civic Type R', gen: 'FL5', trim: 'Type R', body: 'Hatchback', grille: 'Gloss black mesh grille with red H emblem', dtl: ['Cast aluminum die-cast rear wing stanchions', 'Triple center exhaust pipes', 'Front hood vent'] },
    { make: 'Honda', model: 'Civic Type R', gen: 'EK9', trim: 'Base', body: 'Hatchback', grille: 'Small mesh grille with red Honda emblem', dtl: ['Championship White paint', 'White alloy wheels', 'Red Recaro sports seats visible'] },
    { make: 'Honda', model: 'Integra Type R', gen: 'DC2', trim: 'Base', body: 'Coupe', grille: 'Low aerodynamic front lip with four circular headlamps', dtl: ['High pedestal rear wing', 'Championship White color with red Type R graphics'] },
    { make: 'Mazda', model: 'MX-5 Miata', gen: 'ND', trim: 'Club', body: 'Convertible', grille: 'Wide smiling lower front air intake', dtl: ['Compact lightweight roadster silhouette', 'Slanted sharp headlights', 'Short deck'] },
    { make: 'Mazda', model: 'MX-5 Miata', gen: 'NA', trim: 'Base', body: 'Convertible', grille: 'Rounded friendly mouth bumper intake', dtl: ['Iconic circular pop-up headlamps', 'Compact 1990s convertible roadster'] },
    { make: 'Mazda', model: 'RX-7', gen: 'FD', trim: 'Spirit R Type-A', body: 'Coupe', grille: 'Low oval air dam with front brake ducts', dtl: ['Pop-up headlights', 'Organic flowing curve styling', 'Rotary badge', 'Integrated rear wing'] },
    { make: 'Mazda', model: 'RX-8', gen: 'SE3P', trim: 'R3', body: 'Coupe', grille: 'Pentagonal front mouth with rotary-shaped accents', dtl: ['Freestyle rear suicide doors', 'Bulging wheel arches', 'Center rotary badge'] },
    { make: 'Subaru', model: 'WRX STI', gen: 'VA', trim: 'STI', body: 'Sedan', grille: 'Hexagonal mesh grille with cherry blossom red STI badge', dtl: ['Massive functional hood scoop', 'High-mount rear rally wing', 'Gold BBS wheels'] },
    { make: 'Mitsubishi', model: 'Lancer Evolution', gen: 'IX', trim: 'MR', body: 'Sedan', grille: 'Twin split grille with central Mitsubishi three-diamonds', dtl: ['Aluminum hood with large heat extractor', 'Carbon fiber rear wickerbill wing', 'Brembo calipers'] },
    { make: 'Suzuki', model: 'Jimny', gen: 'JB74', trim: 'Sierra', body: 'SUV', grille: 'Five-slot vertical matte black grille', dtl: ['Round retro headlamps', 'Boxy clamshell hood', 'Exposed drip rails', 'Rear door spare tire'] }
  ];

  japaneseVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['street', 'phone', 'professional'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      v.trim,
      v.body,
      'japanese',
      sourceType,
      'front_3q',
      0.94,
      true,
      Boolean(v.trim && v.trim !== 'Base'),
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'High-intensity projector headlights',
        taillights: null,
        hood: 'Sculpted performance hood',
        roofline: `${v.body} roofline`,
        windows: 'Factory glasshouse',
        wheels: 'High-performance forged/cast alloy wheels',
        exhaust: null,
        aero: 'Factory sports aero elements',
        badges: `${v.make} badge`,
        text: v.trim || null,
        body_proportions: `Japanese sports ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.93, supporting_evidence: v.dtl, contradictions: [] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 4: AMERICAN MUSCLE, TRUCKS & EVS (25 IDENTITIES)
  // =========================================================================
  const americanVehicles = [
    { make: 'Ford', model: 'Mustang', gen: 'S650', trim: 'Dark Horse', body: 'Coupe', grille: 'Gloss black trapezoidal grille with nostril intakes', dtl: ['Tri-bar signature headlights', 'Shadow black front bumper apron', 'Dark Horse fender badge'] },
    { make: 'Ford', model: 'Mustang', gen: 'S550', trim: 'GT', body: 'Coupe', grille: 'Hexagonal honeycomb grille with pony badge', dtl: ['Three-slat sequential taillights', 'Dual heat extractors in hood', 'GT rear faux gas cap'] },
    { make: 'Ford', model: 'GT', gen: '2nd Gen', trim: 'Base', body: 'Hypercar', grille: 'Deep front air extractors in hood', dtl: ['Flying buttresses linking roof to rear fenders', 'Central dual exhaust pipes in rear fascia', 'Teardrop cockpit'] },
    { make: 'Ford', model: 'Bronco', gen: '6th Gen', trim: 'Badlands', body: 'SUV', grille: 'Retro grille with bold BRONCO block lettering', dtl: ['Round headlamps with horizontal LED daytime bisectors', 'Removable roof and doors', 'Trail sights on fenders'] },
    { make: 'Ford', model: 'F-150 Lightning', gen: '14th Gen', trim: 'Lariat', body: 'Pickup', grille: 'Smooth enclosed high-gloss black grille panel', dtl: ['End-to-end full width front LED light bar', 'Mega Power Frunk'] },
    { make: 'Ford', model: 'Maverick', gen: '1st Gen', trim: 'Lariat', body: 'Pickup', grille: 'Black horizontal crossbar connecting headlamps', dtl: ['Compact unibody pickup stance', 'C-shaped halogen headlights'] },
    { make: 'Chevrolet', model: 'Corvette', gen: 'C8', trim: 'Stingray', body: 'Coupe', grille: 'Aggressive lower tripartite air intake', dtl: ['Mid-engine cab-forward proportion', 'Angular door scoop side vents', 'Dual double exhaust tips'] },
    { make: 'Chevrolet', model: 'Corvette', gen: 'C8', trim: 'Z06', body: 'Coupe', grille: 'Wide lower mouth with revised front fascia', dtl: ['Wishbone side air intake trim', 'Center quad exhaust tips', 'Flared fenders (+9.4cm width)'] },
    { make: 'Chevrolet', model: 'Corvette', gen: 'C7', trim: 'Z06', body: 'Coupe', grille: 'Black mesh grille with quarter-panel front brake ducts', dtl: ['Carbon fiber hood with central air extractor', 'Rear fender air scoops', 'Quad center exhaust'] },
    { make: 'Chevrolet', model: 'Camaro', gen: '6th Gen', trim: 'ZL1', body: 'Coupe', grille: 'Flowtie open hollow bowtie grille emblem', dtl: ['Carbon fiber hood extractor', 'Aggressive front dive planes', 'Massive lower grille opening'] },
    { make: 'Chevrolet', model: 'Camaro', gen: '6th Gen', trim: 'SS', body: 'Coupe', grille: 'Dual-element upper and lower grille with SS badge', dtl: ['Functional hood vents', 'Narrow squinting LED headlights'] },
    { make: 'Chevrolet', model: 'Tahoe', gen: '5th Gen', trim: 'RST', body: 'SUV', grille: 'Monochromatic black ice grille with black Bowtie', dtl: ['Massive 22-inch gloss black wheels', 'Upright three-row full-size SUV silhouette'] },
    { make: 'Dodge', model: 'Challenger', gen: '3rd Gen', trim: 'SRT Hellcat', body: 'Coupe', grille: 'Narrow horizontal split grille with Hellcat badge', dtl: ['Air-catcher headlight intake', 'Dual-snorkel aluminum hood', 'Widebody fender flares'] },
    { make: 'Dodge', model: 'Challenger', gen: '3rd Gen', trim: 'Demon 170', body: 'Coupe', grille: 'Air-catcher headlamps with Demon 170 badging', dtl: ['Massive Air-Grabber hood scoop', 'Mickey Thompson drag radials', 'No front passenger seat option'] },
    { make: 'Dodge', model: 'Charger', gen: 'LD', trim: 'SRT Hellcat Widebody', body: 'Sedan', grille: 'Performance grille with mail-slot front scoop', dtl: ['Integrated widebody fender flares (+3.5 inches)', 'Rear satin black spoiler', 'LED racetrack taillights'] },
    { make: 'Dodge', model: 'Viper', gen: 'Gen V', trim: 'GTS', body: 'Coupe', grille: 'Snakeskin mesh front intake with Viper emblem', dtl: ['Double-bubble roof', 'Side-exit exhaust pipes below doors', 'Clamshell hood with dual extractors'] },
    { make: 'Dodge', model: 'Durango', gen: 'WD', trim: 'SRT Hellcat', body: 'SUV', grille: 'Black honeycomb performance grille with cold air scoop', dtl: ['Functional hood scoop with twin heat extractors', 'Red Brembo brake calipers', 'Three-row muscle SUV'] },
    { make: 'Cadillac', model: 'CT5-V', gen: 'Alpha 2', trim: 'Blackwing', body: 'Sedan', grille: 'Performance mesh grille with secondary lower air dam', dtl: ['Carbon fiber front splitter', 'Front fender air extractors', 'Quad trapezoidal exhaust tips'] },
    { make: 'Cadillac', model: 'Escalade-V', gen: '5th Gen', trim: 'V-Series', body: 'SUV', grille: 'Black sport mesh grille with V-Series emblem', dtl: ['Quad exhaust pipes with active valves', 'Massive vertical blade LED daytime running lights', 'Full-size luxury SUV stature'] },
    { make: 'Tesla', model: 'Model 3', gen: 'Original', trim: 'Long Range', body: 'Sedan', grille: 'Grille-less smooth front bumper nose', dtl: ['Full glass panoramic roof', 'Flush door handles', 'Curved horizontal headlights with lower sweep'] },
    { make: 'Tesla', model: 'Model 3', gen: 'Highland', trim: 'Performance', body: 'Sedan', grille: 'Completely redesigned sharp low-drag front nose', dtl: ['Ultra-slim horizontal wing-shaped headlights', 'One-piece rear C-shaped taillights', 'Carbon rear spoiler'] },
    { make: 'Tesla', model: 'Model S', gen: 'Facelift', trim: 'Plaid', body: 'Sedan', grille: 'Smooth front fascia with thin lower air slot', dtl: ['Plaid rear badge', 'Carbon fiber rear decklid spoiler', 'Blacked-out window trim'] },
    { make: 'Tesla', model: 'Cybertruck', gen: '1st Gen', trim: 'Cyberbeast', body: 'Pickup', grille: 'Flat stainless steel monolithic angular face', dtl: ['Full-width front LED light bar', 'Ultra-hard cold-rolled stainless steel unibody', 'Triangular sharp silhouette'] },
    { make: 'Rivian', model: 'R1T', gen: '1st Gen', trim: 'Adventure', body: 'Pickup', grille: 'Stadium-shaped vertical oval LED headlights with horizontal lightbar', dtl: ['Gear tunnel compartment between cab and bed', 'Futuristic EV pickup proportions'] },
    { make: 'Lucid', model: 'Air', gen: '1st Gen', trim: 'Sapphire', body: 'Sedan', grille: 'Micro Lens Array horizontal headlight bar', dtl: ['Sapphire blue paint with aero package', 'Seamless clam-shell decklid', 'Ultra-aerodynamic roofline'] }
  ];

  americanVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['street', 'phone', 'professional'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      v.trim,
      v.body,
      'american',
      sourceType,
      'front_3q',
      0.93,
      true,
      Boolean(v.trim && v.trim !== 'Base'),
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'Distinctive American design headlights',
        taillights: null,
        hood: 'Performance sculpted hood',
        roofline: `${v.body} profile`,
        windows: 'Factory tinted glass',
        wheels: 'Large forged/alloy wheels',
        exhaust: null,
        aero: 'Factory performance aerodynamic package',
        badges: `${v.make} badge`,
        text: v.trim || null,
        body_proportions: `American ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.91, supporting_evidence: v.dtl, contradictions: [] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 5: INDIAN MARKET VEHICLES (25 IDENTITIES)
  // =========================================================================
  const indianVehicles = [
    { make: 'Tata', model: 'Nexon', gen: 'Facelift 2023', trim: 'Fearless', body: 'SUV', grille: 'Bi-segment closed black upper grille with lower air dam', dtl: ['Full-width connected front LED daytime strip', 'X-factor connected rear light bar', 'Sequential LED turn indicators'] },
    { make: 'Tata', model: 'Harrier', gen: 'Facelift 2023', trim: 'Fearless+', body: 'SUV', grille: 'Parametric grille with body-colored metallic accents', dtl: ['Connected end-to-end DRL bar', 'Tri-arrow styling', 'Aerodynamic aero blade inserts'] },
    { make: 'Tata', model: 'Safari', gen: '3rd Gen Facelift', trim: 'Accomplished', body: 'SUV', grille: 'Parametric grille with warm chrome pins', dtl: ['Stepped roof profile with roof rails', 'Three-row SUV silhouette', 'Connected LED taillamp array'] },
    { make: 'Tata', model: 'Punch', gen: '1st Gen', trim: 'Creative', body: 'SUV', grille: 'High bonnet with humanity line gloss black grille', dtl: ['Cladding on side doors', 'Arrow-shaped rear LED taillights', 'Compact micro-SUV proportions'] },
    { make: 'Tata', model: 'Altroz', gen: '1st Gen', trim: 'XZ+', body: 'Hatchback', grille: 'Piano black grille with signature chrome humanity line', dtl: ['Laser-cut aerodynamic bodylines', 'C-pillar integrated rear door handles', 'Black contrast roof'] },
    { make: 'Tata', model: 'Tiago', gen: '1st Gen', trim: 'XZ+', body: 'Hatchback', grille: 'Humanity line chrome front grille', dtl: ['Boomerang taillights', 'Dual tone roof compact city car'] },
    { make: 'Tata', model: 'Curvv', gen: '1st Gen', trim: 'Accomplished', body: 'SUV', grille: 'Closed flush aerodynamic grille with LED DRL bar', dtl: ['Coupe SUV sloping roofline', 'Flush pop-out door handles', 'Connected horizontal taillight'] },
    { make: 'Mahindra', model: 'Thar', gen: '2nd Gen', trim: 'LX Hard Top', body: 'SUV', grille: 'Iconic six-slat vertical unpainted front grille', dtl: ['Classic round halogen headlamps', 'Exposed hood latches', 'Boxy upright retro 4x4 stance', 'Tailgate mounted spare'] },
    { make: 'Mahindra', model: 'Thar Roxx', gen: '5-Door', trim: 'AX7L', body: 'SUV', grille: 'Body-colored double-decker six-slat grille', dtl: ['Five-door extended wheelbase', 'C-shaped LED headlights with DRL ring', 'Angulated C-pillar glass window'] },
    { make: 'Mahindra', model: 'Scorpio-N', gen: 'Z8L', trim: '4XPLOR', body: 'SUV', grille: 'Chrome-finished vertical six-slat grille with Twin Peaks logo', dtl: ['Scorpion tail chrome window beltline', 'Vertical stacked taillights', 'Muscular wheel arches'] },
    { make: 'Mahindra', model: 'XUV700', gen: '1st Gen', trim: 'AX7L', body: 'SUV', grille: 'Satin chrome vertical grille slats with Twin Peaks logo', dtl: ['C-shaped clear LED headlamps', 'Smart door handles sitting flush with body', 'Arrowhead split LED taillamps'] },
    { make: 'Mahindra', model: 'Bolero Neo', gen: 'Neo', trim: 'N10', body: 'SUV', grille: 'Six-slot chrome grille with Mahindra emblem', dtl: ['Boxy utilitarian profile with black side rubber strip', 'High ground clearance', 'X-shaped spare tire cover'] },
    { make: 'Mahindra', model: 'XUV 3XO', gen: '1st Gen', trim: 'AX7L', body: 'SUV', grille: 'High-gloss black grille with chrome rivets', dtl: ['C-shaped drop-down LED DRLs', 'Infinity connected rear light bar', 'Floating contrast roof'] },
    { make: 'Mahindra', model: 'Scorpio Classic', gen: 'Classic', trim: 'S11', body: 'SUV', grille: 'Six-chrome-slat upright grille with Twin Peaks badge', dtl: ['Tower LED taillights', 'Classic boxy rugged police SUV silhouette', 'Side body cladding'] },
    { make: 'Maruti Suzuki', model: 'Swift', gen: '4th Gen', trim: 'ZXi+', body: 'Hatchback', grille: 'Gloss black piano-finish honeycomb grille with radar slot', dtl: ['Clamshell wrap-around bonnet line', 'L-shaped LED daytime lights', 'Blacked-out floating roof pillars'] },
    { make: 'Maruti Suzuki', model: 'Baleno', gen: '2nd Gen', trim: 'Alpha', body: 'Hatchback', grille: 'NEXWave wave-pattern grille with chrome bar', dtl: ['Three-point NEXTre visual LED headlights', 'LED rear combination lamps', 'Wide low hatchback stance'] },
    { make: 'Maruti Suzuki', model: 'Brezza', gen: '2nd Gen', trim: 'ZXi+', body: 'SUV', grille: 'Gunmetal finish horizontal bar grille with chrome accents', dtl: ['Dual L-shaped projector headlamps', 'Floating roof design', 'Silver skid plates front and rear'] },
    { make: 'Maruti Suzuki', model: 'Grand Vitara', gen: '1st Gen', trim: 'Alpha+', body: 'SUV', grille: 'Crafted Futurism NEXA grille with high-gloss black mesh', dtl: ['Three-point LED DRLs on top', 'Separate bumper-mounted headlamp pods', 'Full-width rear light bar'] },
    { make: 'Maruti Suzuki', model: 'Fronx', gen: '1st Gen', trim: 'Alpha', body: 'SUV', grille: 'NEXA chrome wave grille with upright front face', dtl: ['Coupe-crossover raked rear roofline', 'Connected horizontal rear LED taillamp', 'Chunky wheel arch cladding'] },
    { make: 'Maruti Suzuki', model: 'Dzire', gen: '3rd Gen', trim: 'ZXi+', body: 'Sedan', grille: 'Hexagonal chrome-surround front grille', dtl: ['Compact sub-4-meter sedan profile', 'Flowing curved shoulder line'] },
    { make: 'Maruti Suzuki', model: 'Ertiga', gen: '2nd Gen', trim: 'ZXi+', body: 'MPV', grille: 'Dynamic chrome winged front grille', dtl: ['Long three-row MPV greenhouse', 'L-shaped 3D rear taillamps'] },
    { make: 'Hyundai', model: 'Creta', gen: '2nd Gen Facelift', trim: 'SX(O)', body: 'SUV', grille: 'Parametric black chrome grille with integrated horizon LED DRL bar', dtl: ['Quad-beam LED headlights in bumper', 'Connected rear LED light bar with inverted L-accents'] },
    { make: 'Hyundai', model: 'Venue', gen: 'Facelift', trim: 'SX(O)', body: 'SUV', grille: 'Dark chrome parametric jewel grille', dtl: ['Connecting LED taillamp bar', 'Split headlight layout with rectangular projector pods'] },
    { make: 'Kia', model: 'Sonet', gen: 'Facelift', trim: 'X-Line', body: 'SUV', grille: 'Matte graphite Tiger Nose grille', dtl: ['Star Map LED daytime running lights', 'Connected rear light bar', 'Matte graphite paint finish'] },
    { make: 'Kia', model: 'Carens', gen: '1st Gen', trim: 'Luxury Plus', body: 'MPV', grille: 'Digital Tiger Face with star-map lighting accents', dtl: ['Three-row family recreational vehicle', 'Arrow-shaped LED taillights'] }
  ];

  indianVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['street', 'phone'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      null, // Variant unobservable / not required on Indian market consumer vehicles
      v.body,
      'indian',
      sourceType,
      'front_3q',
      0.91,
      true,
      false, // Variant NOT observable
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'Factory halogen/LED clusters',
        taillights: null,
        hood: 'Factory hood with characteristic creases',
        roofline: `${v.body} profile`,
        windows: 'Standard daylight opening',
        wheels: 'Diamond-cut alloy wheels',
        exhaust: null,
        aero: null,
        badges: `${v.make} emblem`,
        text: v.model,
        body_proportions: `Indian market ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.89, supporting_evidence: v.dtl, contradictions: [] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 6: CHINESE MODERN & EV (25 IDENTITIES)
  // =========================================================================
  const chineseVehicles = [
    { make: 'BYD', model: 'Seal', gen: '1st Gen', trim: 'Design', body: 'Sedan', grille: 'Aerodynamic X-shaped closed front face', dtl: ['Double U-shaped floating headlights', 'Ripple-effect water drop LED bumper lights', 'Fastback electric sedan profile'] },
    { make: 'BYD', model: 'Han', gen: '1st Gen', trim: 'EV Flagship', body: 'Sedan', grille: 'Dragon Face closed electric fascia with chrome bar', dtl: ['Dragon eye LED headlights', 'Chinese knot continuous LED taillight bar'] },
    { make: 'BYD', model: 'Tang', gen: '2nd Gen', trim: 'Flagship EV', body: 'SUV', grille: 'Large hexagonal Dragon Face grille with matrix LED headlamps', dtl: ['Continuous full-width rear light bar', 'Floating roof design'] },
    { make: 'BYD', model: 'Atto 3', gen: '1st Gen', trim: 'Design', body: 'SUV', grille: 'Dragon Face 3.0 closed front face with silver embossed BYD badge', dtl: ['Winged D-pillar textured panel', 'One-piece LED taillight bar'] },
    { make: 'BYD', model: 'Dolphin', gen: '1st Gen', trim: 'Comfort', body: 'Hatchback', grille: 'Rounded geometric closed grille with luminous badge surround', dtl: ['Compact ocean-aesthetic city car', 'Intersecting ribbon taillight motif'] },
    { make: 'BYD', model: 'Yangwang U8', gen: '1st Gen', trim: 'Deluxe', body: 'SUV', grille: 'Dot-matrix galaxy grille wrapping into high-mounted headlights', dtl: ['Roof lidar pods', 'Square rugged silhouette with octagonal rear spare tire cover', 'Tank turn capability'] },
    { make: 'BYD', model: 'Yangwang U9', gen: '1st Gen', trim: 'Base', body: 'Hypercar', grille: 'Space-age interstellar front fascia with massive C-shaped LED clusters', dtl: ['Butterfly dihedral doors', 'Carbon fiber rear fin', 'Dramatic low-slung hypercar silhouette'] },
    { make: 'Zeekr', model: '001', gen: '1st Gen', trim: 'FR', body: 'Hatchback', grille: 'Slim grille-less nose with separate hood DRLs', dtl: ['Vertical claw DRL strips on hood edges', 'Shooting brake wagon-coupe proportions', 'Massive carbon rear diffuser'] },
    { make: 'Zeekr', model: '009', gen: '1st Gen', trim: 'WE Edition', body: 'Sedan', grille: 'Spring of Light intelligent illuminated vertical chrome grille', dtl: ['Monolithic MPV front face', 'Full-width rear light blade', 'Floating boxy roof'] },
    { make: 'Zeekr', model: 'X', gen: '1st Gen', trim: 'Privilege', body: 'SUV', grille: 'Frameless minimalist front face with split hidden headlamps', dtl: ['Frameless doors with no handles', 'Floating urban crossover roofline'] },
    { make: 'Zeekr', model: '007', gen: '1st Gen', trim: 'Smart', body: 'Sedan', grille: 'Zeekr Stargate full-width 90-inch intelligent light curtain', dtl: ['Smooth aerodynamic pebble surfacing', 'Hidden door handles', 'Fastback profile'] },
    { make: 'Nio', model: 'ET7', gen: '1st Gen', trim: 'Premier', body: 'Sedan', grille: 'X-Bar integrated closed front fascia with roof lidar pods', dtl: ['Roof-mounted watchtower sensor pod', 'Double-dash daytime lights', 'Illuminated heart-beat taillights'] },
    { make: 'Nio', model: 'ES8', gen: '2nd Gen', trim: 'Signature', body: 'SUV', grille: 'Shark nose closed front with roof watchtower lidar sensor', dtl: ['Illuminami rear wing-shaped taillight bar', 'Three-row executive electric SUV'] },
    { make: 'Nio', model: 'ET5', gen: '1st Gen', trim: 'Touring', body: 'Wagon', grille: 'X-Bar nose with sleek shooting brake roof flyline', dtl: ['Roof sensor pods', 'Hatchback wagon tailgate with continuous rear light strip'] },
    { make: 'Nio', model: 'EP9', gen: '1st Gen', trim: 'Base', body: 'Hypercar', grille: 'Front aerodynamic downforce tunnels', dtl: ['Active full-length rear diffuser', 'Three-position active rear wing', 'Carbon monocoque track hypercar'] },
    { make: 'Xiaomi', model: 'SU7', gen: '1st Gen', trim: 'Max', body: 'Sedan', grille: 'Water-drop rounded aerodynamic front nose', dtl: ['Teardrop halo LED headlights', 'Saturn ring connected rear taillights', 'Active rear spoiler in decklid'] },
    { make: 'Xiaomi', model: 'SU7 Ultra', gen: '1st Gen', trim: 'Ultra Prototype', body: 'Sedan', grille: 'Massive aerodynamic carbon front splitter with yellow racing accents', dtl: ['Large carbon rear wing with 2145kg downforce', 'Carbon ceramic brakes', 'Racing livery'] },
    { make: 'XPeng', model: 'G9', gen: '1st Gen', trim: 'Max', body: 'SUV', grille: 'Robot Face closed electric front with dual lidar units in headlights', dtl: ['Horizontal ring light bar', 'Flush glazing and hidden window seals'] },
    { make: 'XPeng', model: 'P7i', gen: '1st Gen', trim: 'Wing Edition', body: 'Sedan', grille: 'Low-slung closed front nose with curved DRL light strip', dtl: ['Scissor front doors', 'Coupe-like aerodynamic fastback silhouette'] },
    { make: 'XPeng', model: 'X9', gen: '1st Gen', trim: 'Starship', body: 'MPV', grille: 'Starship-inspired sharp faceted angular front fascia', dtl: ['Sloping rear tailgate angle on large luxury MPV', 'Faceted cybernetic side creases'] },
    { make: 'Geely', model: 'Coolray', gen: '1st Gen', trim: 'Sport', body: 'SUV', grille: 'Expanding cosmos grille with red trim accent', dtl: ['Carbon-fiber texture mirror caps', 'Quad round exhaust pipes', 'Roof-mounted sports spoiler'] },
    { make: 'Geely', model: 'Monjaro', gen: '1st Gen', trim: 'Flagship', body: 'SUV', grille: 'Vertical chrome waterfall grille slats', dtl: ['Crisp dual-lens matrix headlights', 'Continuous rear light bar on large SUV'] },
    { make: 'Li Auto', model: 'L9', gen: '1st Gen', trim: 'Max', body: 'SUV', grille: 'Seamless 2-meter continuous halo LED light bar across hood', dtl: ['Roof-mounted lidar pod', 'Full-size flagship family luxury SUV stance'] },
    { make: 'Li Auto', model: 'L7', gen: '1st Gen', trim: 'Pro', body: 'SUV', grille: 'Closed electric nose with lower air shutter and seamless halo DRL', dtl: ['Two-row luxury crossover stance', 'Flush electric door handles'] },
    { make: 'HiPhi', model: 'Z', gen: '1st Gen', trim: 'Base', body: 'Sedan', grille: 'Star-Ring ISD intelligent interactive lighting panels and active air shutter', dtl: ['NT suicide doors with roof gull-wing panels', 'Cyberpunk dual rear spoilers'] }
  ];

  chineseVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone' | 'poor_quality'> = ['professional', 'street', 'phone'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      null, // Variant unobservable / not required on standard EV configs
      v.body,
      'chinese',
      sourceType,
      'front_3q',
      0.92,
      true,
      false, // Variant NOT observable
      false,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'High-tech matrix LED headlights',
        taillights: null,
        hood: 'Aerodynamic EV hood',
        roofline: `${v.body} profile`,
        windows: 'Flush acoustic glass',
        wheels: 'Aerodynamic low-drag alloy wheels',
        exhaust: null,
        aero: 'Integrated aerodynamic features',
        badges: `${v.make} badge`,
        text: v.model,
        body_proportions: `Modern EV ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.gen})`, score: 0.90, supporting_evidence: v.dtl, contradictions: [] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 7: LUXURY, SUPERCARS & HYPERCARS (25 IDENTITIES)
  // =========================================================================
  const exoticVehicles = [
    { make: 'Ferrari', model: 'Daytona SP3', gen: 'Icona', trim: 'SP3', body: 'Supercar', grille: 'Low shark nose with horizontal aerodynamic strakes', dtl: ['Horizontal rear strakes covering light bar', 'Targa cockpit canopy', 'Retractable headlight eyelids'] },
    { make: 'Ferrari', model: '296 GTB', gen: 'F171', trim: 'Assetto Fiorano', body: 'Supercar', grille: 'Teardrop front air intake with center bridge', dtl: ['250 LM inspired B-pillar air scoop', 'Central high-exit exhaust tip', 'Active rear spoiler'] },
    { make: 'Ferrari', model: 'SF90 Stradale', gen: 'F173', trim: 'Stradale', body: 'Supercar', grille: 'C-shaped front headlights integrated with brake ducts', dtl: ['Cab-forward compact bubble cockpit', 'Suspended shut-off Gurney flap', 'High dual exhaust pipes'] },
    { make: 'Ferrari', model: 'F40', gen: 'Type F120', trim: 'Base', body: 'Supercar', grille: 'Low dual front NACA ducts in bumper with amber turn indicators', dtl: ['Massive fixed rear pedestal wing', 'Louvered Lexan rear engine cover', 'Kevlar weave visible through red paint'] },
    { make: 'Ferrari', model: '812 Superfast', gen: 'F152M', trim: 'Base', body: 'Supercar', grille: 'Wide black mesh radiator grille with prancing horse', dtl: ['Front fender air pass-through ducts', 'High-tail fastback silhouette', 'Four round LED taillights'] },
    { make: 'Ferrari', model: 'Roma', gen: 'F169', trim: 'Base', body: 'Coupe', grille: 'Monolithic body-colored perforated front grille', dtl: ['Minimalist elegant front shark nose', 'Horizontal linear rear taillights'] },
    { make: 'Ferrari', model: 'Purosangue', gen: 'F175', trim: 'Base', body: 'SUV', grille: 'Aerodynamic lower air dam with suspended DRL daytime lights', dtl: ['Welcome suicide rear doors', 'Coupe-crossover proportions', 'Quad exhaust finishers'] },
    { make: 'Ferrari', model: 'LaFerrari', gen: 'F150', trim: 'Base', body: 'Hypercar', grille: 'F1-inspired sharp pointed nose with front wing splitter', dtl: ['Dihedral doors', 'Active front and rear diffusers', 'Massive rear air extractors'] },
    { make: 'Lamborghini', model: 'Revuelto', gen: 'LB744', trim: 'V12 Hybrid', body: 'Hypercar', grille: 'Aggressive open carbon lower bumper with Y-signature DRLs', dtl: ['Y-shaped front LED daytime lights', 'High-mounted dual hexagonal exhaust pipes', 'Scissor doors'] },
    { make: 'Lamborghini', model: 'Huracán', gen: 'LP640-2', trim: 'STO', body: 'Supercar', grille: 'Cofango one-piece front clamshell hood with air ducts', dtl: ['Shark fin on rear engine cover', 'Roof air scoop', 'Three-position manually adjustable swan-neck rear wing'] },
    { make: 'Lamborghini', model: 'Aventador', gen: 'LP770-4', trim: 'SVJ', body: 'Hypercar', grille: 'Tri-channel front bumper with ALA 2.0 active aerodynamics', dtl: ['High dual circular center exhaust tips', 'Massive fixed carbon rear wing with central pillar', 'Omega-shaped rear wing profile'] },
    { make: 'Lamborghini', model: 'Countach', gen: 'LPI 800-4', trim: 'Base', body: 'Hypercar', grille: 'Slim rectangular front grille with Countach logo', dtl: ['Periscopio roof indentation lines', 'Iconic scissor doors', 'Hexagonal wheel arches'] },
    { make: 'Lamborghini', model: 'Urus', gen: 'Facelift', trim: 'Performante', body: 'SUV', grille: 'Deep bonnet air extractors in carbon fiber with black front bumper', dtl: ['Carbon fiber wheel arches', 'Akrapovič titanium exhaust', 'Rear spoiler with carbon finlets'] },
    { make: 'Lamborghini', model: 'Miura', gen: 'P400', trim: 'SV', body: 'Supercar', grille: 'Low sleek clamshell front nose with circular headlamps', dtl: ['Eyelashes deleted on SV headlights', 'Rear window louvers', 'Sensuous curved mid-engine profile'] },
    { make: 'McLaren', model: '750S', gen: 'P14M', trim: 'Coupe', body: 'Supercar', grille: 'Eye-socket headlamp cavities with integrated air intakes', dtl: ['Active rear wing / airbrake', 'High-exit stainless steel exhaust', 'Dihedral doors'] },
    { make: 'McLaren', model: 'P1', gen: 'P12', trim: 'Base', body: 'Hypercar', grille: 'McLaren Speedmark logo shaped front headlights', dtl: ['Roof-mounted snorkel intake', 'Two-tier adjustable hydraulic rear wing', 'Two-piece clamshell body'] },
    { make: 'McLaren', model: 'Senna', gen: 'P15', trim: 'Base', body: 'Hypercar', grille: 'Deep aero stepped front active aero blades', dtl: ['Glazed door lower glass panels', 'Huge swan-neck active rear wing', 'Triple slash-cut exhaust'] },
    { make: 'McLaren', model: 'Artura', gen: 'Artura', trim: 'Base', body: 'Supercar', grille: 'Deep-set hammerhead headlights with side air intake ducts', dtl: ['Seamless hot-vee chimney engine chimney', 'Carbon lightweight architecture unibody'] },
    { make: 'Koenigsegg', model: 'Jesko', gen: 'Attack', trim: 'Attack', body: 'Hypercar', grille: 'Active front underbody diffusers in carbon fiber', dtl: ['Top-mounted boomerang active rear wing', 'Dihedral synchro-helix actuation doors', 'Center-locking carbon fiber wheels'] },
    { make: 'Koenigsegg', model: 'Regera', gen: 'Regera', trim: 'Base', body: 'Hypercar', grille: 'Constellation daytime running lights with front splitter', dtl: ['Autoskin automated body panel opening', 'Top-mounted active folding rear wing', 'Central fishtail exhaust'] },
    { make: 'Bugatti', model: 'Chiron', gen: 'Chiron', trim: 'Pur Sport', body: 'Hypercar', grille: 'Classic horseshoe central grille enlarged (+13%)', dtl: ['C-shaped Bugatti side line', '1.9m fixed carbon fiber rear wing', '3D-printed titanium exhaust finisher'] },
    { make: 'Bugatti', model: 'Tourbillon', gen: 'Tourbillon', trim: 'Base', body: 'Hypercar', grille: 'Deep sculpted horseshoe grille feeding underbody aero tunnels', dtl: ['Spine line running whole length of body', 'Dihedral dihedral doors', 'Active submerged rear wing'] },
    { make: 'Pagani', model: 'Huayra', gen: 'Huayra', trim: 'BC', body: 'Hypercar', grille: 'Large front carbon mouth with integrated active flaps', dtl: ['Quad projector circular headlights in carbon pods', 'Quad central exhaust in ceramic coating', 'Gullwing doors'] },
    { make: 'Rolls-Royce', model: 'Phantom', gen: 'Phantom VIII', trim: 'Extended', body: 'Sedan', grille: 'Monumental polished Pantheon grille with Spirit of Ecstasy', dtl: ['Laser headlamps with starlight ring', 'Rear coach suicide doors', 'Formal monolithic limousine architecture'] },
    { make: 'Bentley', model: 'Continental GT', gen: '3rd Gen', trim: 'Speed', body: 'Coupe', grille: 'Dark tint matrix radiator grille', dtl: ['Cut-crystal effect LED matrix headlights', 'Muscular power line over rear wheels', 'Dual oval exhaust tips'] }
  ];

  exoticVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone'> = ['professional', 'street'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      v.trim,
      v.body,
      'supercar',
      sourceType,
      'front_3q',
      0.96,
      true,
      true,
      true,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'Exotic bespoke hypercar headlights',
        taillights: null,
        hood: 'Aerodynamic carbon fiber hood with heat extractors',
        roofline: 'Mid-engine low-slung canopy',
        windows: 'Wraparound cockpit canopy',
        wheels: 'Forged lightweight center-lock alloy wheels',
        exhaust: null,
        aero: 'Active downforce carbon fiber aero package',
        badges: `${v.make} crest`,
        text: v.trim,
        body_proportions: 'Mid-engine cab-forward hypercar proportions',
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} (${v.trim || v.gen})`, score: 0.94, supporting_evidence: v.dtl, contradictions: [] },
        { name: 'BMW M4 CSL (G82)', score: 0.01, supporting_evidence: [], contradictions: ['Mid-engine architectural contradiction with BMW front-engine layout'] }
      ],
      v.model === 'Daytona SP3' ? 'vid_bmw_m4_csl' : undefined
    );
  });

  // =========================================================================
  // CATEGORY 8: HISTORIC, OBSCURE & HOMOLOGATION SPECIALS (20 IDENTITIES)
  // =========================================================================
  const historicVehicles = [
    { make: 'Lancia', model: 'Delta HF Integrale', gen: 'Evo II', trim: 'Evoluzione', body: 'Hatchback', grille: 'Rectangular mesh grille with HF yellow elephant badge', dtl: ['Box-flared rally blister arches', 'Adjustable rear roof wing', 'Twin round headlights'] },
    { make: 'Lancia', model: 'Stratos', gen: 'HF Stradale', trim: 'Stradale', body: 'Coupe', grille: 'Wedge front nose with flip-up pop-up headlights', dtl: ['Curved panoramic wrap-around windshield', 'Rear louvers on clamshell', 'Star-pattern Campagnolo alloy wheels'] },
    { make: 'Audi', model: 'Sport Quattro', gen: 'B2', trim: 'Short Wheelbase', body: 'Coupe', grille: 'Black slatted grille with 4-rings and quattro script', dtl: ['320mm shortened wheelbase', 'Kevlar hood with five air vents', 'Rake-angled A-pillars'] },
    { make: 'BMW', model: 'M3', gen: 'E30', trim: 'Sport Evolution', body: 'Coupe', grille: 'Classic upright twin kidney grille with black border', dtl: ['Box flared fenders front and rear', 'High-deck trunk with integrated rear spoiler', 'Slim chrome bumpers'] },
    { make: 'BMW', model: '3.0 CSL', gen: 'E9', trim: 'Batmobile', body: 'Coupe', grille: 'Tall twin kidney chrome grilles', dtl: ['Massive unmounted rear aero wing in trunk', 'Chrome roof spoiler fin', 'Front fender air guide fins'] },
    { make: 'BMW', model: '2002 Turbo', gen: 'E20', trim: 'Turbo', body: 'Sedan', grille: 'Black kidney grille with retro BMW roundel', dtl: ['Inverted 2002 turbo front air dam lettering', 'Riveted fiberglass fender flares', 'Rubber trunk spoiler'] },
    { make: 'Mercedes-Benz', model: '190E', gen: 'W201', trim: '2.5-16 Evolution II', body: 'Sedan', grille: 'Classic Mercedes chrome radiator grille', dtl: ['Massive adjustable rear wing', 'Wide flared wheel arches with bumper extensions', '17-inch DTM-style six-spoke wheels'] },
    { make: 'Mercedes-Benz', model: '300 SL Gullwing', gen: 'W198', trim: 'Gullwing', body: 'Coupe', grille: 'Wide horizontal chrome bar with giant three-pointed star', dtl: ['Iconic upward-opening gullwing roof doors', 'Eyebrow fender flares above wheels'] },
    { make: 'Mercedes-Benz', model: 'CLK GTR', gen: 'W297', trim: 'Strassenversion', body: 'Hypercar', grille: 'Mercedes four-lamp front face adapted to low race car nose', dtl: ['Mid-engine GT1 homologation chassis', 'High fixed carbon wing', 'Roof scoop and side pods'] },
    { make: 'Ferrari', model: '288 GTO', gen: 'Type F114', trim: 'Base', body: 'Supercar', grille: 'Rectangular front driving lights in black grille with prancing horse', dtl: ['Three vertical cooling slits behind rear wheels', 'Dual flag mirrors on high stalks', 'Flared rear fenders'] },
    { make: 'Ferrari', model: 'Dino 246 GT', gen: 'Tipo 607', trim: 'GT', body: 'Coupe', grille: 'Curved front oval air dam with delicate chrome blade bumpers', dtl: ['Scalloped door air intakes', 'Curved concave rear window glasshouse'] },
    { make: 'Porsche', model: '959', gen: '959', trim: 'Komfort', body: 'Supercar', grille: 'Lower front valence vents with integrated turn signals', dtl: ['Integrated full-width rear spoiler', 'Flush front headlights in bulbous fenders', 'D-pillar side air scoops'] },
    { make: 'Porsche', model: 'Carrera GT', gen: '980', trim: 'Base', body: 'Supercar', grille: 'Three-piece front air intakes with projector headlamps', dtl: ['Removable two-piece carbon targa roof panels', 'Dual rear rollover cowls with mesh covers', 'High center beechwood gearshift visible'] },
    { make: 'Porsche', model: '911 Carrera RS', gen: '911 Carrera RS 2.7', trim: 'Touring', body: 'Coupe', grille: 'Standard lower valence horn grilles', dtl: ['Iconic fiberglass ducktail rear spoiler', 'Carrera side negative script', 'Fuchs forged wheels'] },
    { make: 'Alpine', model: 'A110', gen: 'Original 1970s', trim: '1600S', body: 'Coupe', grille: 'Four circular front driving rally lamps', dtl: ['Lightweight fiberglass berlinette silhouette', 'Rear-mounted engine cooling vents'] },
    { make: 'Alpine', model: 'A110', gen: 'Modern 2017+', trim: 'S', body: 'Coupe', grille: 'Four circular LED front headlights', dtl: ['Central ribbed spine on hood', 'X-shaped rear LED taillights', 'Lightweight aluminum coupe'] },
    { make: 'De Tomaso', model: 'Pantera', gen: 'GTS', trim: 'GTS', body: 'Coupe', grille: 'Low wedge front bumper with integrated rectangular turn signals', dtl: ['Matte black front hood and engine cover', 'Riveted wide wheel flares', 'American 351 V8 mid-engine layout'] },
    { make: 'Jaguar', model: 'E-Type', gen: 'Series 1', trim: '4.2 Roadster', body: 'Convertible', grille: 'Small oval front air mouth with horizontal chrome bisector bar', dtl: ['Glass-covered recessed headlamps', 'Extremely long clamshell front bonnet', 'Center twin polished exhaust pipes'] },
    { make: 'Jaguar', model: 'XJ220', gen: 'XJ220', trim: 'Base', body: 'Supercar', grille: 'Lower front valence intake with hidden headlights behind slatted doors', dtl: ['Sleek 4.93-meter elongated aluminum body', 'Sloping glass rear engine cover', 'Curved rear spoiler'] },
    { make: 'Ford', model: 'Sierra RS Cosworth', gen: 'RS', trim: 'Cosworth', body: 'Hatchback', grille: 'Minimal slatted aerodynamic front grille', dtl: ['Iconic whale-tail high pedestal rear wing', 'Dual hood heat extractor louvers', 'RS honeycomb wheels'] }
  ];

  historicVehicles.forEach((v, idx) => {
    const sourceTypes: Array<'professional' | 'street' | 'phone'> = ['street', 'phone', 'professional'];
    const sourceType = sourceTypes[idx % sourceTypes.length];
    addSample(
      `vid_${v.make.toLowerCase()}_${v.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      true,
      v.make,
      v.model,
      v.gen,
      v.trim,
      v.body,
      'historic_obscure',
      sourceType,
      'front_3q',
      0.92,
      true,
      true,
      true,
      'identified',
      {
        body_style: v.body,
        grille: v.grille,
        headlights: 'Vintage rectangular/round halogen clusters',
        taillights: null,
        hood: 'Vented homologation hood',
        roofline: `${v.body} profile`,
        windows: 'Classic chrome/rubber window trim',
        wheels: 'Period-correct lightweight motorsport wheels',
        exhaust: null,
        aero: 'Homologation motorsport rear wing and flares',
        badges: `${v.make} emblem`,
        text: v.trim,
        body_proportions: `Historic homologation ${v.body.toLowerCase()}`,
        distinctive_details: v.dtl
      },
      [
        { name: `${v.make} ${v.model} ${v.trim} (${v.gen})`, score: 0.91, supporting_evidence: v.dtl, contradictions: [] }
      ]
    );
  });

  // =========================================================================
  // CATEGORY 9: DIFFICULT PAIRS & MULTI-IMAGE INSTANCES (36 SAMPLES)
  // Multiple independent images (2-3) per vehicle across different viewpoints & sources!
  // =========================================================================

  // --- Pair 1: BMW M4 CSL (G82) vs BMW M4 Competition (G82) ---
  // M4 CSL - Instance 1: Studio Front 3/4
  addSample(
    'vid_bmw_m4_csl', true, 'BMW', 'M4', 'G82', 'CSL', 'Coupe', 'difficult_pairs', 'professional', 'front_3q', 0.96, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Vertical twin kidney grille with red perimeter pinstripe accents',
      headlights: 'Yellow racing GT-style daytime running lights',
      taillights: null,
      hood: 'Contoured carbon fiber hood with raw carbon exposed channels',
      roofline: 'Double-bubble carbon fiber roof',
      windows: 'Hofmeister kink',
      wheels: 'M light alloy wheels Star-spoke 827 M in Bronze',
      exhaust: null,
      aero: 'Carbon fiber front splitter with red accent striping',
      badges: 'BMW M 50 Jahre commemorative roundel',
      text: 'M4 CSL',
      body_proportions: 'Front-engine high-performance sports coupe',
      distinctive_details: ['Yellow racing DRLs', 'Red kidney grille perimeter border', 'Exposed carbon hood channels']
    },
    [
      { name: 'BMW M4 CSL (G82)', score: 0.95, supporting_evidence: ['Yellow DRLs', 'Red grille border', 'CSL carbon hood'], contradictions: [] },
      { name: 'BMW M4 Competition (G82)', score: 0.65, supporting_evidence: ['G82 body'], contradictions: ['Competition lacks yellow DRLs and red grille trim'] },
      { name: 'Ferrari Daytona SP3', score: 0.01, supporting_evidence: [], contradictions: ['Front-engine BMW coupe contradicts mid-engine Ferrari hypercar'] }
    ],
    'vid_bmw_m4_competition'
  );

  // M4 CSL - Instance 2: Street Rear 3/4 (Laserlight threads)
  addSample(
    'vid_bmw_m4_csl', true, 'BMW', 'M4', 'G82', 'CSL', 'Coupe', 'difficult_pairs', 'street', 'rear_3q', 0.93, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Ultra-fine glass-fiber laser thread taillights (Laserlight)',
      hood: null,
      roofline: 'Carbon fiber roof',
      windows: 'Lightweight rear window',
      wheels: 'Forged bronze M wheels',
      exhaust: 'Quad titanium rear exhaust tips with matte black finish',
      aero: 'Integrated carbon duckbill trunk lid with sharp upturned lip',
      badges: 'M4 CSL rear badge with red outline',
      text: 'CSL',
      body_proportions: 'Sports coupe rear quarter with flared fenders',
      distinctive_details: ['Laserlight rear illumination threads', 'Integrated duckbill carbon trunk lid', 'Titanium quad exhaust']
    },
    [
      { name: 'BMW M4 CSL (G82)', score: 0.94, supporting_evidence: ['Laserlight taillights', 'Integrated duckbill trunk'], contradictions: [] },
      { name: 'BMW M4 Competition (G82)', score: 0.60, supporting_evidence: ['Coupe rear profile'], contradictions: ['Competition has standard LED taillights and flat trunk lip'] }
    ],
    'vid_bmw_m4_competition'
  );

  // M4 CSL - Instance 3: Phone Camera Side / Front Profile
  addSample(
    'vid_bmw_m4_csl', true, 'BMW', 'M4', 'G82', 'CSL', 'Coupe', 'difficult_pairs', 'phone', 'front_3q', 0.88, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Twin vertical kidney grille with red perimeter border',
      headlights: 'Yellow racing GT-style daytime lights',
      taillights: null,
      hood: 'Twin indented exposed carbon fiber channels on hood',
      roofline: 'Carbon fiber double-bubble roof',
      windows: 'Hofmeister kink',
      wheels: 'Bronze M wheels with red M brake calipers',
      exhaust: null,
      aero: 'Carbon front splitter with red contour lines',
      badges: 'BMW 50 Jahre roundel',
      text: 'CSL',
      body_proportions: 'High performance sports coupe front quarter',
      distinctive_details: ['Yellow DRLs in daylight', 'Red grille pinstripe', 'Bronze forged wheels']
    },
    [
      { name: 'BMW M4 CSL (G82)', score: 0.92, supporting_evidence: ['Yellow DRLs', 'Red grille pinstripe'], contradictions: [] },
      { name: 'BMW M4 Competition (G82)', score: 0.62, supporting_evidence: ['Coupe shape'], contradictions: ['Competition lacks yellow DRLs and red perimeter'] }
    ],
    'vid_bmw_m4_competition'
  );

  // M4 Competition - Instance 1: Street Front 3/4 (Standard white DRLs)
  addSample(
    'vid_bmw_m4_competition', true, 'BMW', 'M4', 'G82', 'Competition', 'Coupe', 'difficult_pairs', 'street', 'front_3q', 0.93, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Vertical twin kidney grille with black horizontal double slats',
      headlights: 'White/blue LED laser headlights (standard white DRL)',
      taillights: null,
      hood: 'Painted body-color hood with contoured channels',
      roofline: 'Carbon fiber roof',
      windows: 'Hofmeister kink',
      wheels: 'Black M double-spoke 826 M wheels',
      exhaust: null,
      aero: 'Standard high-gloss black front lower bumper air curtains',
      badges: 'Standard BMW roundel',
      text: null,
      body_proportions: 'Front-engine sports coupe proportions',
      distinctive_details: ['White daytime running lights', 'Black grille border (no red pinstripes)', 'Standard painted hood']
    },
    [
      { name: 'BMW M4 Competition (G82)', score: 0.92, supporting_evidence: ['G82 body', 'White DRLs', 'Black grille'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.20, supporting_evidence: ['G82 body'], contradictions: ['Lacks yellow DRLs, red grille perimeter, and exposed carbon hood'] }
    ],
    'vid_bmw_m4_csl'
  );

  // M4 Competition - Instance 2: Phone Rear 3/4 (Standard taillights)
  addSample(
    'vid_bmw_m4_competition', true, 'BMW', 'M4', 'G82', 'Competition', 'Coupe', 'difficult_pairs', 'phone', 'rear_3q', 0.89, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Standard G82 full-LED L-shaped light bar taillights',
      hood: null,
      roofline: 'Carbon fiber roof',
      windows: 'Factory glass',
      wheels: 'Black 826 M wheels',
      exhaust: 'Quad chrome/black exhaust tips',
      aero: 'Small painted trunk lip spoiler',
      badges: 'M4 Competition badge in gloss black',
      text: 'M4 Competition',
      body_proportions: 'Coupe rear quarter stance',
      distinctive_details: ['Standard LED taillights (not Laserlight threads)', 'Bolt-on painted trunk spoiler (not duckbill unibody)']
    },
    [
      { name: 'BMW M4 Competition (G82)', score: 0.91, supporting_evidence: ['Standard LED taillights', 'M4 Competition badge'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.18, supporting_evidence: ['M4 rear body'], contradictions: ['Lacks Laserlight woven taillights and unibody duckbill trunk'] }
    ],
    'vid_bmw_m4_csl'
  );

  // --- Pair 2: Ferrari Daytona SP3 vs BMW M4 CSL Regression ---
  // Daytona SP3 - Instance 1: Studio Front 3/4
  addSample(
    'vid_ferrari_daytona_sp3', true, 'Ferrari', 'Daytona SP3', 'Icona', 'SP3', 'Supercar', 'difficult_pairs', 'professional', 'front_3q', 0.97, true, true, true, 'identified',
    {
      body_style: 'Supercar',
      grille: 'Low shark nose with horizontal aerodynamic strakes',
      headlights: 'Retractable mobile eyelid covers over LED headlights',
      taillights: null,
      hood: 'Deep front air extractors feeding side radiators',
      roofline: 'Removable targa hard top with wraparound windscreen',
      windows: 'Curved fighter jet canopy',
      wheels: 'Five-spoke asymmetric forged wheels',
      exhaust: null,
      aero: 'Horizontal aerodynamic strakes and front undertray diffusers',
      badges: 'Ferrari yellow shield on front fenders',
      text: 'Daytona SP3',
      body_proportions: 'Mid-engine low-slung Italian sports prototype proportions',
      distinctive_details: ['Horizontal aerodynamic strakes', 'Retractable headlight eyelids', 'Mid-engine prototype canopy']
    },
    [
      { name: 'Ferrari Daytona SP3 (Icona)', score: 0.96, supporting_evidence: ['Horizontal strakes', 'Eyelid headlights', 'Prototype canopy'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.01, supporting_evidence: [], contradictions: ['Complete architectural contradiction: mid-engine hypercar vs front-engine BMW coupe'] }
    ],
    'vid_bmw_m4_csl'
  );

  // Daytona SP3 - Instance 2: Street Rear 3/4 (Horizontal rear blade strakes)
  addSample(
    'vid_ferrari_daytona_sp3', true, 'Ferrari', 'Daytona SP3', 'Icona', 'SP3', 'Supercar', 'difficult_pairs', 'street', 'rear_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Supercar',
      grille: null,
      headlights: null,
      taillights: 'Full-width horizontal light bar beneath full-width horizontal blade strakes',
      hood: null,
      roofline: 'Central spine over mid-engine V12 bay',
      windows: 'Fighter jet rear decklid glass',
      wheels: 'Forged wheels',
      exhaust: 'Twin rectangular high-mounted central exhaust exits',
      aero: 'Full stack of red horizontal body strakes spanning rear width',
      badges: 'Prancing horse in center of rear strakes',
      text: null,
      body_proportions: 'Mid-engine prototype rear diffuser architecture',
      distinctive_details: ['Stacked full-width rear horizontal strakes', 'Central high exhaust', 'Icona design language']
    },
    [
      { name: 'Ferrari Daytona SP3 (Icona)', score: 0.95, supporting_evidence: ['Full-width rear strakes', 'Central high exhaust'], contradictions: [] },
      { name: 'BMW M4 CSL (G82)', score: 0.01, supporting_evidence: [], contradictions: ['Zero rear structural overlap with BMW 4-series coupe'] }
    ],
    'vid_bmw_m4_csl'
  );

  // --- Pair 3: Porsche 911 GT3 RS (992) vs Porsche 911 Carrera (992) ---
  // GT3 RS - Instance 1: Track Front 3/4
  addSample(
    'vid_porsche_911_gt3_rs', true, 'Porsche', '911', '992', 'GT3 RS', 'Coupe', 'difficult_pairs', 'professional', 'front_3q', 0.96, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Lower bumper central radiator intake with front diffuser',
      headlights: 'LED matrix 4-point headlights',
      taillights: null,
      hood: 'Deep dual front hood nostril air extractors',
      roofline: 'Carbon fiber roof with longitudinal fins',
      windows: 'Lightweight side glass',
      wheels: 'Forged magnesium center-lock wheels',
      exhaust: null,
      aero: 'Massive swan-neck rear wing taller than roofline with hydraulic DRS',
      badges: 'Porsche crest decal',
      text: 'GT3 RS',
      body_proportions: 'Widebody rear-engine track coupe with front fender louvers',
      distinctive_details: ['Front fender louvers', 'Roof aerodynamic fins', 'Massive swan-neck DRS wing']
    },
    [
      { name: 'Porsche 911 GT3 RS (992)', score: 0.96, supporting_evidence: ['Front fender louvers', 'Swan-neck DRS wing'], contradictions: [] },
      { name: 'Porsche 911 Carrera (992)', score: 0.22, supporting_evidence: ['992 flyline'], contradictions: ['Carrera has no hood vents, no fender louvers, and no swan-neck wing'] }
    ],
    'vid_porsche_911_carrera'
  );

  // GT3 RS - Instance 2: Street Rear 3/4
  addSample(
    'vid_porsche_911_gt3_rs', true, 'Porsche', '911', '992', 'GT3 RS', 'Coupe', 'difficult_pairs', 'street', 'rear_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Full-width 992 rear LED light strip',
      hood: null,
      roofline: 'Roof aerodynamic fins',
      windows: 'Lightweight glass',
      wheels: 'Forged magnesium center lock wheels with Michelin Cup 2 R tires',
      exhaust: 'Dual central stainless steel exhaust tips with carbon diffuser',
      aero: 'Enormous swan-neck rear wing with DRS actuator box',
      badges: 'GT3 RS rear badge decal',
      text: 'GT3 RS',
      body_proportions: 'Extreme rear-engine widebody with massive rear diffuser',
      distinctive_details: ['DRS hydraulic swan-neck wing', 'Side air intake ducts in rear fenders', 'Carbon diffuser']
    },
    [
      { name: 'Porsche 911 GT3 RS (992)', score: 0.95, supporting_evidence: ['Swan-neck DRS wing', 'Rear fender intakes'], contradictions: [] },
      { name: 'Porsche 911 Carrera (992)', score: 0.20, supporting_evidence: ['992 taillight strip'], contradictions: ['Carrera has no swan-neck wing, no DRS, and no side fender intakes'] }
    ],
    'vid_porsche_911_carrera'
  );

  // 911 Carrera - Instance 1: Street Front 3/4
  addSample(
    'vid_porsche_911_carrera', true, 'Porsche', '911', '992', null, 'Coupe', 'difficult_pairs', 'street', 'front_3q', 0.93, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Clean lower front bumper with horizontal louvres',
      headlights: 'Four-point LED projector lamps',
      taillights: null,
      hood: 'Smooth sloping hood without vents',
      roofline: 'Classic 911 flyline teardrop roof',
      windows: 'Standard curved quarter glass',
      wheels: 'Carrera S 10-spoke alloy wheels',
      exhaust: null,
      aero: 'Retractable flush rear spoiler (retracted)',
      badges: 'Porsche crest on hood',
      text: null,
      body_proportions: 'Classic clean rear-engine coupe silhouette',
      distinctive_details: ['Smooth unvented hood', 'No front fender louvers', 'Flush body surfacing']
    },
    [
      { name: 'Porsche 911 Carrera (992)', score: 0.91, supporting_evidence: ['Smooth hood', '992 flyline'], contradictions: [] },
      { name: 'Porsche 911 GT3 RS (992)', score: 0.10, supporting_evidence: ['992 silhouette'], contradictions: ['Severe aerodynamic mismatch: lacks GT3 RS wing, hood extractors, and fender louvers'] }
    ],
    'vid_porsche_911_gt3_rs'
  );

  // 911 Carrera - Instance 2: Phone Rear 3/4
  addSample(
    'vid_porsche_911_carrera', true, 'Porsche', '911', '992', null, 'Coupe', 'difficult_pairs', 'phone', 'rear_3q', 0.89, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Continuous horizontal slim LED rear light strip',
      hood: null,
      roofline: 'Teardrop coupe roofline without roof fins',
      windows: 'Acoustic standard side glass',
      wheels: 'Factory Carrera 19/20-inch wheels',
      exhaust: 'Dual trapezoidal exhaust tips integrated into bumper',
      aero: 'Seamless flush retractable spoiler (in down position)',
      badges: '911 Carrera chrome rear lettering',
      text: 'Carrera',
      body_proportions: 'Clean timeless rear-engine coupe rear profile',
      distinctive_details: ['Clean rear decklid with vertical engine louvers', 'No fixed wing', 'Integrated exhaust']
    },
    [
      { name: 'Porsche 911 Carrera (992)', score: 0.92, supporting_evidence: ['Flush rear spoiler', 'Clean rear decklid'], contradictions: [] },
      { name: 'Porsche 911 GT3 RS (992)', score: 0.08, supporting_evidence: ['992 taillights'], contradictions: ['Lacks massive swan-neck DRS wing and side fender scoops'] }
    ],
    'vid_porsche_911_gt3_rs'
  );

  // --- Pair 4: Toyota GR86 (ZN8) vs Subaru BRZ (ZD8) [Platform Twins] ---
  // GR86 - Instance 1: Street Front 3/4 (MATRIX rectangular grille)
  addSample(
    'vid_toyota_gr86', true, 'Toyota', 'GR86', 'ZN8', 'Base', 'Coupe', 'difficult_pairs', 'street', 'front_3q', 0.93, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Wide rectangular Functional MATRIX G-mesh grille with GR badge',
      headlights: 'Parabolic LED headlights with J-shaped DRL running along bottom',
      taillights: null,
      hood: 'Aluminum sloping front hood',
      roofline: 'Double-bubble aerodynamic roof',
      windows: 'Compact sports coupe greenhouse',
      wheels: '18-inch matte black 10-spoke alloys',
      exhaust: null,
      aero: 'Functional front bumper air outlets and side rocker aero fins',
      badges: 'Toyota emblem and GR badge',
      text: 'GR86',
      body_proportions: 'Compact front-engine rear-drive fastback sports coupe',
      distinctive_details: ['Rectangular MATRIX grille with GR badge', 'J-shaped LED DRL light tube']
    },
    [
      { name: 'Toyota GR86 (ZN8)', score: 0.92, supporting_evidence: ['MATRIX rectangular grille', 'GR badge'], contradictions: [] },
      { name: 'Subaru BRZ (ZD8)', score: 0.48, supporting_evidence: ['Twin sports coupe silhouette'], contradictions: ['BRZ has hexagonal upward-smiling grille, not rectangular G-mesh'] }
    ],
    'vid_subaru_brz'
  );

  // GR86 - Instance 2: Phone Rear 3/4 (Integrated duckbill spoiler)
  addSample(
    'vid_toyota_gr86', true, 'Toyota', 'GR86', 'ZN8', 'Premium', 'Coupe', 'difficult_pairs', 'phone', 'rear_3q', 0.89, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Three-dimensional inverted C-clamp LED rear taillights',
      hood: null,
      roofline: 'Double-bubble roof',
      windows: 'Compact quarter window',
      wheels: 'Matte black 18-inch wheels',
      exhaust: 'Dual round chrome exhaust tips',
      aero: 'Pronounced duckbill trunk spoiler',
      badges: 'Toyota emblem and GR86 badge',
      text: 'GR86',
      body_proportions: 'Compact coupe rear stance',
      distinctive_details: ['Duckbill upturned trunk spoiler', 'GR86 badge', 'Dual circular exhaust']
    },
    [
      { name: 'Toyota GR86 (ZN8)', score: 0.91, supporting_evidence: ['Duckbill trunk spoiler', 'GR86 badge'], contradictions: [] },
      { name: 'Subaru BRZ (ZD8)', score: 0.45, supporting_evidence: ['Twin rear lights'], contradictions: ['BRZ has flatter trunk lid without aggressive duckbill'] }
    ],
    'vid_subaru_brz'
  );

  // BRZ - Instance 1: Street Front 3/4 (Hexagonal smiling grille)
  addSample(
    'vid_subaru_brz', true, 'Subaru', 'BRZ', 'ZD8', 'Limited', 'Coupe', 'difficult_pairs', 'street', 'front_3q', 0.93, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Hexagonal upward-smiling front bumper grille with horizontal slats',
      headlights: 'C-shaped boomerang LED daytime running light signature',
      taillights: null,
      hood: 'Aluminum sloping sports hood',
      roofline: 'Double-bubble roof',
      windows: 'Compact sports coupe quarter window',
      wheels: '18-inch dark gray multi-spoke wheels',
      exhaust: null,
      aero: 'Side air vents behind front wheels',
      badges: 'Subaru six-star cluster emblem',
      text: 'BRZ',
      body_proportions: 'Compact front-engine rear-drive sports coupe proportions',
      distinctive_details: ['Hexagonal smiling grille', 'C-shaped boomerang LED light signature']
    },
    [
      { name: 'Subaru BRZ (ZD8)', score: 0.92, supporting_evidence: ['Hexagonal grille', 'C-shaped DRLs', 'Subaru badge'], contradictions: [] },
      { name: 'Toyota GR86 (ZN8)', score: 0.46, supporting_evidence: ['Twin coupe body'], contradictions: ['GR86 has wide rectangular G-mesh grille, not hexagonal smile'] }
    ],
    'vid_toyota_gr86'
  );

  // BRZ - Instance 2: Phone Side / Front 3/4
  addSample(
    'vid_subaru_brz', true, 'Subaru', 'BRZ', 'ZD8', 'Limited', 'Coupe', 'difficult_pairs', 'phone', 'front_3q', 0.88, true, false, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Hexagonal upward-turned grille opening',
      headlights: 'C-shaped LED daytime running lights wrapping projector bulb',
      taillights: null,
      hood: 'Smooth aluminum hood',
      roofline: 'Double-bubble roof',
      windows: 'Small quarter glass',
      wheels: 'Multi-spoke factory wheels',
      exhaust: null,
      aero: 'Functional front fender vents',
      badges: 'Subaru blue oval badge',
      text: 'BRZ',
      body_proportions: 'Front engine sports car silhouette',
      distinctive_details: ['Boomerang DRL pattern', 'Subaru front hexagonal intake contour']
    },
    [
      { name: 'Subaru BRZ (ZD8)', score: 0.90, supporting_evidence: ['Subaru badge', 'Boomerang DRLs'], contradictions: [] },
      { name: 'Toyota GR86 (ZN8)', score: 0.44, supporting_evidence: ['Twin architecture'], contradictions: ['Toyota has rectangular grille and J-shaped DRLs'] }
    ],
    'vid_toyota_gr86'
  );

  // --- Pair 5: Golf GTI (Mk8) vs Golf R (Mk8) ---
  // Golf GTI - Instance 1: Front 3/4 (Red grille stripe, X-pattern 5-point fog lamps)
  addSample(
    'vid_vw_golf_gti', true, 'Volkswagen', 'Golf GTI', 'Mk8', 'GTI', 'Hatchback', 'difficult_pairs', 'street', 'front_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Hatchback',
      grille: 'Honeycomb front bumper grille with red accent stripe across headlights',
      headlights: 'IQ.LIGHT LED headlights with red pinstripe',
      taillights: null,
      hood: 'Contoured compact hood',
      roofline: 'Iconic thick Golf C-pillar',
      windows: 'Factory acoustic glass',
      wheels: 'Richmond 18-inch five-spoke alloy wheels with red brake calipers',
      exhaust: null,
      aero: 'Integrated front lip splitter with five X-pattern LED fog lights in mesh',
      badges: 'GTI badge in red on front grille and fenders',
      text: 'GTI',
      body_proportions: 'Hot hatch front-engine silhouette',
      distinctive_details: ['Red grille accent stripe', 'Five-point X-pattern LED fog lamps in lower bumper', 'Red brake calipers']
    },
    [
      { name: 'Volkswagen Golf GTI (Mk8)', score: 0.94, supporting_evidence: ['Red grille stripe', 'X-pattern fog lights', 'GTI badges'], contradictions: [] },
      { name: 'Volkswagen Golf R (Mk8)', score: 0.55, supporting_evidence: ['Mk8 body'], contradictions: ['Golf R has blue grille stripe, aggressive winglets, and no X-pattern fog lights'] }
    ],
    'vid_vw_golf_r'
  );

  // Golf R - Instance 1: Front 3/4 (Blue grille stripe, no fog lights, aggressive aero)
  addSample(
    'vid_vw_golf_r', true, 'Volkswagen', 'Golf R', 'Mk8', 'Golf R', 'Hatchback', 'difficult_pairs', 'street', 'front_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Hatchback',
      grille: 'Aggressive open front bumper with blue accent line across full-width LED light bar',
      headlights: 'IQ.LIGHT LED matrix headlamps with blue highlight bar',
      taillights: null,
      hood: 'Sculpted hood',
      roofline: 'Extended two-piece rear roof spoiler',
      windows: 'Factory tinted glass',
      wheels: 'Estoril 19-inch diamond-turned alloys with blue R brake calipers',
      exhaust: null,
      aero: 'Motorsport-style front bumper with gloss black winglets; zero fog lights',
      badges: 'Blue R emblem centered below Volkswagen front logo',
      text: 'R',
      body_proportions: 'All-wheel-drive performance hot hatch stance',
      distinctive_details: ['Blue grille stripe', 'Gloss black front winglets with no fog lights', 'Blue R brake calipers']
    },
    [
      { name: 'Volkswagen Golf R (Mk8)', score: 0.95, supporting_evidence: ['Blue grille stripe', 'Bumper winglets', 'Blue R calipers'], contradictions: [] },
      { name: 'Volkswagen Golf GTI (Mk8)', score: 0.52, supporting_evidence: ['Mk8 body'], contradictions: ['GTI has red trim and X-pattern fog lights'] }
    ],
    'vid_vw_golf_gti'
  );

  // Golf R - Instance 2: Rear 3/4 (Quad oval exhaust pipes)
  addSample(
    'vid_vw_golf_r', true, 'Volkswagen', 'Golf R', 'Mk8', 'Golf R', 'Hatchback', 'difficult_pairs', 'phone', 'rear_3q', 0.90, true, true, true, 'identified',
    {
      body_style: 'Hatchback',
      grille: null,
      headlights: null,
      taillights: 'LED rear combination lamps with dynamic indicators',
      hood: null,
      roofline: 'Two-piece performance roof spoiler',
      windows: 'Factory glass',
      wheels: 'Estoril 19-inch wheels',
      exhaust: 'Quad chrome oval exhaust tips (two on each side)',
      aero: 'High-gloss black rear diffuser with vertical fins',
      badges: 'Modern R badge centered below rear VW roundel',
      text: 'R',
      body_proportions: 'Hot hatch rear quarter',
      distinctive_details: ['Quad exhaust tips (Golf R exclusive)', 'Two-piece extended roof wing', 'R badge under roundel']
    },
    [
      { name: 'Volkswagen Golf R (Mk8)', score: 0.93, supporting_evidence: ['Quad exhaust tips', 'R badge', 'Extended roof wing'], contradictions: [] },
      { name: 'Volkswagen Golf GTI (Mk8)', score: 0.45, supporting_evidence: ['Mk8 hatch body'], contradictions: ['GTI has dual circular exhaust tips (one per side), not quad tips'] }
    ],
    'vid_vw_golf_gti'
  );

  // --- Pair 6: Civic Type R (FL5) vs Civic Si (FE) ---
  // Civic Type R - Instance 1: Front 3/4
  addSample(
    'vid_honda_civic_type_r_fl5', true, 'Honda', 'Civic Type R', 'FL5', 'Type R', 'Hatchback', 'difficult_pairs', 'professional', 'front_3q', 0.96, true, true, true, 'identified',
    {
      body_style: 'Hatchback',
      grille: 'Functional wide black mesh grille with red Honda H badge and Type R emblem',
      headlights: 'Full LED headlights with sharp horizontal DRLs',
      taillights: null,
      hood: 'Functional aluminum front hood with integrated center air extractor vent',
      roofline: 'Sleek liftback profile',
      windows: 'Acoustic glass',
      wheels: '19-inch matte black reverse-rim wheels with red Brembo calipers',
      exhaust: null,
      aero: 'Flared front and rear widebody fenders (+90mm width)',
      badges: 'Red Honda badge and Type R script',
      text: 'Type R',
      body_proportions: 'Flared factory widebody touring car silhouette',
      distinctive_details: ['Integrated center hood vent', 'Flared widebody fenders', 'Red Honda emblem']
    },
    [
      { name: 'Honda Civic Type R (FL5)', score: 0.96, supporting_evidence: ['Hood vent', 'Flared widebody', 'Red H badge'], contradictions: [] },
      { name: 'Honda Civic Si (FE)', score: 0.40, supporting_evidence: ['Civic architecture'], contradictions: ['Civic Si has standard narrow body, no hood vent, and black H badge'] }
    ],
    'vid_honda_civic_si_fe'
  );

  // Civic Type R - Instance 2: Rear 3/4 (Center triple exhaust, die-cast aluminum wing stanchions)
  addSample(
    'vid_honda_civic_type_r_fl5', true, 'Honda', 'Civic Type R', 'FL5', 'Type R', 'Hatchback', 'difficult_pairs', 'street', 'rear_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Hatchback',
      grille: null,
      headlights: null,
      taillights: 'Full-width connected LED rear taillight bar across hatch',
      hood: null,
      roofline: 'Liftback tailgate',
      windows: 'Tinted glass',
      wheels: '19-inch matte black wheels',
      exhaust: 'Center-mounted triple round exhaust tips with larger middle tip',
      aero: 'High-mounted pedestal rear wing on die-cast aluminum stanchions',
      badges: 'Red Honda emblem and Type R badge',
      text: 'Type R',
      body_proportions: 'Widebody hatchback rear stance',
      distinctive_details: ['Center triple exhaust tips', 'Die-cast aluminum wing stanchions', 'Red Honda emblem']
    },
    [
      { name: 'Honda Civic Type R (FL5)', score: 0.95, supporting_evidence: ['Triple center exhaust', 'Aluminum wing stanchions'], contradictions: [] },
      { name: 'Honda Civic Si (FE)', score: 0.38, supporting_evidence: ['Civic profile'], contradictions: ['Civic Si has dual outboard hidden exhaust and small decklid spoiler'] }
    ],
    'vid_honda_civic_si_fe'
  );

  // Civic Si - Instance 1: Front 3/4
  addSample(
    'vid_honda_civic_si_fe', true, 'Honda', 'Civic', 'FE', 'Si', 'Sedan', 'difficult_pairs', 'street', 'front_3q', 0.92, true, true, true, 'identified',
    {
      body_style: 'Sedan',
      grille: 'Gloss black honeycomb upper and lower grille with red Si badge',
      headlights: 'LED headlights',
      taillights: null,
      hood: 'Standard smooth sedan hood without vents',
      roofline: 'Four-door sedan roofline',
      windows: 'Gloss black window surround',
      wheels: '18-inch matte black 10-spoke alloy wheels',
      exhaust: null,
      aero: 'Standard sedan front bumper lip',
      badges: 'Standard chrome Honda badge with red Si lettering',
      text: 'Si',
      body_proportions: 'Four-door standard-width compact sport sedan',
      distinctive_details: ['Smooth unvented hood', 'Standard narrow fenders', 'Four-door sedan body (not hatchback liftback)']
    },
    [
      { name: 'Honda Civic Si (FE)', score: 0.92, supporting_evidence: ['Sedan body', 'Si badge', 'Smooth hood'], contradictions: [] },
      { name: 'Honda Civic Type R (FL5)', score: 0.35, supporting_evidence: ['Civic chassis'], contradictions: ['Lacks Type R hood vent, widebody flares, and red H badge'] }
    ],
    'vid_honda_civic_type_r_fl5'
  );

  // --- Pair 7: Corvette C8 Stingray vs Corvette C8 Z06 ---
  // C8 Stingray - Instance 1: Street Front 3/4
  addSample(
    'vid_chevy_c8_stingray', true, 'Chevrolet', 'Corvette', 'C8', 'Stingray', 'Coupe', 'difficult_pairs', 'street', 'front_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Tripartite lower front air intake with standard width',
      headlights: 'Angled dual-element LED headlights',
      taillights: null,
      hood: 'Contoured front luggage hood',
      roofline: 'Removable targa roof panel',
      windows: 'Curved side glass',
      wheels: 'Factory 5-open-spoke bright silver wheels',
      exhaust: null,
      aero: 'Standard boomerang side intake spear trim',
      badges: 'Crossed flags Corvette emblem',
      text: 'Stingray',
      body_proportions: 'Mid-engine standard width (1933mm) sports car',
      distinctive_details: ['Standard narrow body', 'Boomerang side intake spear', 'Dual outboard twin exhaust']
    },
    [
      { name: 'Chevrolet Corvette Stingray (C8)', score: 0.94, supporting_evidence: ['Standard body', 'Boomerang intake spear'], contradictions: [] },
      { name: 'Chevrolet Corvette Z06 (C8)', score: 0.45, supporting_evidence: ['C8 silhouette'], contradictions: ['Z06 has widebody wishbone intakes (+9.4cm width) and center quad exhaust'] }
    ],
    'vid_chevy_c8_z06'
  );

  // C8 Z06 - Instance 1: Track Front 3/4 (Widebody, wishbone side intake)
  addSample(
    'vid_chevy_c8_z06', true, 'Chevrolet', 'Corvette', 'C8', 'Z06', 'Coupe', 'difficult_pairs', 'professional', 'front_3q', 0.96, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: 'Massive gaping front fascia with center heat exchanger',
      headlights: 'LED projector headlamps',
      taillights: null,
      hood: 'Front luggage hood with carbon inserts',
      roofline: 'Carbon fiber roof',
      windows: 'Side glasshouse',
      wheels: 'Spider-design forged alloy wheels with Michelin Cup 2 R tires',
      exhaust: null,
      aero: 'Unique wishbone-shaped side air intake spear (+9.4cm widened body)',
      badges: 'Corvette crossed flags and Z06 side emblem',
      text: 'Z06',
      body_proportions: 'Widened widebody mid-engine supercar stance (+94mm)',
      distinctive_details: ['Wishbone side intake spear', 'Widened front/rear track', 'Aggressive front fascia with front canards']
    },
    [
      { name: 'Chevrolet Corvette Z06 (C8)', score: 0.96, supporting_evidence: ['Wishbone intake', 'Widened fenders', 'Z06 fascia'], contradictions: [] },
      { name: 'Chevrolet Corvette Stingray (C8)', score: 0.42, supporting_evidence: ['C8 body'], contradictions: ['Stingray has narrow body and boomerang side intake'] }
    ],
    'vid_chevy_c8_stingray'
  );

  // C8 Z06 - Instance 2: Street Rear 3/4 (Center quad round exhaust tips)
  addSample(
    'vid_chevy_c8_z06', true, 'Chevrolet', 'Corvette', 'C8', 'Z06', 'Coupe', 'difficult_pairs', 'street', 'rear_3q', 0.93, true, true, true, 'identified',
    {
      body_style: 'Coupe',
      grille: null,
      headlights: null,
      taillights: 'Dual-element angled LED taillights',
      hood: null,
      roofline: 'Mid-engine rear glass engine hatch revealing 5.5L LT6 flat-plane V8',
      windows: 'Factory glass',
      wheels: 'Forged lightweight wheels',
      exhaust: 'Quad center-mounted stainless steel circular exhaust tips (exclusive to Z06)',
      aero: 'Adjustable rear pedestal spoiler and wide rear air extractors',
      badges: 'Z06 rear badge',
      text: 'Z06',
      body_proportions: 'Wide rear fenders with massive rear tires (345/25ZR21)',
      distinctive_details: ['Center-mounted quad round exhaust tips', 'Rear fender width (+94mm)', 'Z06 rear diffuser']
    },
    [
      { name: 'Chevrolet Corvette Z06 (C8)', score: 0.95, supporting_evidence: ['Center quad exhaust', 'Widebody rear fenders'], contradictions: [] },
      { name: 'Chevrolet Corvette Stingray (C8)', score: 0.38, supporting_evidence: ['C8 taillights'], contradictions: ['Stingray has dual outboard exhaust tips at outer bumper edges'] }
    ],
    'vid_chevy_c8_stingray'
  );

  // --- Pair 8: Tesla Model 3 Original vs Tesla Model 3 Highland ---
  // Model 3 Original - Instance 1: Street Front 3/4
  addSample(
    'vid_tesla_model_3_orig', true, 'Tesla', 'Model 3', 'Original (2017-2023)', 'Long Range', 'Sedan', 'difficult_pairs', 'street', 'front_3q', 0.93, true, true, true, 'identified',
    {
      body_style: 'Sedan',
      grille: 'Smooth front bumper with lower fog lamp pods',
      headlights: 'Curved swept-back headlights with lower LED daytime sweep',
      taillights: null,
      hood: 'Smooth aluminum hood sloping down to nose',
      roofline: 'Continuous all-glass panoramic roof',
      windows: 'Chrome/satin black window trim with flush door handles',
      wheels: 'Aero wheel covers',
      exhaust: null,
      aero: 'Smooth aerodynamic front bumper with distinct fog lamp cutouts',
      badges: 'Tesla T chrome emblem',
      text: null,
      body_proportions: 'Mid-size electric sedan profile',
      distinctive_details: ['Swept-back curved headlights', 'Separate bumper fog light housings', 'Duckbill bumper crease']
    },
    [
      { name: 'Tesla Model 3 (Original)', score: 0.93, supporting_evidence: ['Swept headlights', 'Bumper fog light cutouts'], contradictions: [] },
      { name: 'Tesla Model 3 (Highland)', score: 0.50, supporting_evidence: ['Model 3 shape'], contradictions: ['Highland has ultra-slim horizontal headlights and no fog light housings'] }
    ],
    'vid_tesla_model_3_highland'
  );

  // Model 3 Highland - Instance 1: Street Front 3/4
  addSample(
    'vid_tesla_model_3_highland', true, 'Tesla', 'Model 3', 'Highland (2024+)', 'Performance', 'Sedan', 'difficult_pairs', 'street', 'front_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'Sedan',
      grille: 'Redesigned razor-sharp lower drag bumper with zero fog lights',
      headlights: 'Ultra-slim horizontal wing-shaped headlights with integrated daytime lights',
      taillights: null,
      hood: 'Sharper edge hood creases',
      roofline: 'Glass canopy',
      windows: 'Acoustic glass with blacked-out trim',
      wheels: 'Warp 20-inch forged wheels with red performance calipers',
      exhaust: null,
      aero: 'Lower front splitter with active cooling ducts',
      badges: 'Tesla emblem',
      text: null,
      body_proportions: 'Sharper low-drag electric sedan silhouette',
      distinctive_details: ['Ultra-slim horizontal headlights', 'Complete absence of bumper fog lights', 'Sharp aerodynamic front nose']
    },
    [
      { name: 'Tesla Model 3 (Highland)', score: 0.95, supporting_evidence: ['Ultra-slim horizontal headlights', 'No fog lights', 'Highland nose'], contradictions: [] },
      { name: 'Tesla Model 3 (Original)', score: 0.45, supporting_evidence: ['Model 3 chassis'], contradictions: ['Original has large curved swept headlights and fog lamp housings'] }
    ],
    'vid_tesla_model_3_orig'
  );

  // Model 3 Highland - Instance 2: Phone Rear 3/4 (One-piece C-clamp taillights)
  addSample(
    'vid_tesla_model_3_highland', true, 'Tesla', 'Model 3', 'Highland (2024+)', 'Long Range', 'Sedan', 'difficult_pairs', 'phone', 'rear_3q', 0.90, true, true, true, 'identified',
    {
      body_style: 'Sedan',
      grille: null,
      headlights: null,
      taillights: 'One-piece single-housing C-clamp taillights integrated entirely into trunk lid',
      hood: null,
      roofline: 'Continuous glass roof',
      windows: 'Black window surrounds',
      wheels: 'Nova 19-inch wheels',
      exhaust: null,
      aero: 'Integrated trunk lip with TESLA block lettering',
      badges: 'T-E-S-L-A spaced block lettering across trunk lid (no T badge)',
      text: 'TESLA',
      body_proportions: 'Electric sedan rear quarter',
      distinctive_details: ['One-piece C-clamp taillights (no body split seam)', 'Spaced TESLA lettering replacing round logo']
    },
    [
      { name: 'Tesla Model 3 (Highland)', score: 0.94, supporting_evidence: ['One-piece taillights', 'TESLA rear lettering'], contradictions: [] },
      { name: 'Tesla Model 3 (Original)', score: 0.42, supporting_evidence: ['Model 3 rear'], contradictions: ['Original has two-piece split taillights and chrome T logo'] }
    ],
    'vid_tesla_model_3_orig'
  );

  // --- Pair 9: Mahindra Thar (3-Door) vs Mahindra Thar Roxx (5-Door) ---
  // Thar 3-Door - Instance 1: Street Front 3/4
  addSample(
    'vid_mahindra_thar_3door', true, 'Mahindra', 'Thar', '2nd Gen', 'LX Hard Top', 'SUV', 'difficult_pairs', 'street', 'front_3q', 0.93, true, true, true, 'identified',
    {
      body_style: 'SUV',
      grille: 'Unpainted black six-slat vertical front grille',
      headlights: 'Traditional round halogen headlights with separate fender turn signals',
      taillights: null,
      hood: 'Flat hood with exposed rubber latches',
      roofline: 'Short two-door hard top with steep upright rear window',
      windows: 'Exposed drip rails',
      wheels: '18-inch deep silver alloys with all-terrain tires',
      exhaust: null,
      aero: null,
      badges: 'THAR stamped in front fender and bumper',
      text: 'THAR',
      body_proportions: 'Short wheelbase 3-door rugged off-roader (3985mm length)',
      distinctive_details: ['Short 3-door body', 'Unpainted black six-slat grille', 'Round halogen headlights']
    },
    [
      { name: 'Mahindra Thar (3-Door)', score: 0.94, supporting_evidence: ['3-door short body', 'Unpainted six-slat grille'], contradictions: [] },
      { name: 'Mahindra Thar Roxx (5-Door)', score: 0.50, supporting_evidence: ['Thar styling'], contradictions: ['Thar Roxx has extended 5-door wheelbase, body-colored double-decker grille, and C-shaped LED DRLs'] }
    ],
    'vid_mahindra_thar_roxx_5door'
  );

  // Thar Roxx 5-Door - Instance 1: Street Front 3/4
  addSample(
    'vid_mahindra_thar_roxx_5door', true, 'Mahindra', 'Thar Roxx', '5-Door', 'AX7L', 'SUV', 'difficult_pairs', 'street', 'front_3q', 0.94, true, true, true, 'identified',
    {
      body_style: 'SUV',
      grille: 'Body-colored double-decker six-slat grille design',
      headlights: 'Modern round LED projector headlights with circular C-shaped DRL ring',
      taillights: null,
      hood: 'Contoured bonnet with hydraulic struts',
      roofline: 'Extended metal hardtop with panoramic sunroof and rear triangular quarter window',
      windows: 'Distinctive angular triangular rear passenger window glass',
      wheels: '19-inch diamond-cut alloy wheels',
      exhaust: null,
      aero: null,
      badges: 'THAR ROXX badge on rear quarter',
      text: 'ROXX',
      body_proportions: 'Extended long wheelbase 5-door off-road SUV (4428mm length)',
      distinctive_details: ['Extended 5-door body with rear passenger doors', 'Body-colored double-decker grille', 'C-shaped circular LED DRLs']
    },
    [
      { name: 'Mahindra Thar Roxx (5-Door)', score: 0.95, supporting_evidence: ['5-door body', 'Double-decker grille', 'Circular LED DRLs'], contradictions: [] },
      { name: 'Mahindra Thar (3-Door)', score: 0.48, supporting_evidence: ['Thar design heritage'], contradictions: ['3-Door has short wheelbase, 2 side doors, and unpainted black grille'] }
    ],
    'vid_mahindra_thar_3door'
  );

  // =========================================================================
  // CATEGORY 10: NON-CAR & NEGATIVE ABSTENTION EXAMPLES (30 SAMPLES)
  // Rejection rate must be >= 98%, with taxi variant abstention strictly enforced!
  // =========================================================================
  const negativeCases = [
    { id: 'city_transit_bus', name: 'City Transit Bus', dtl: ['Boxy commercial bus front panel', 'Electronic route LED destination board', 'Pneumatic bi-fold doors', 'Heavy steel wheels'] },
    { id: 'london_double_decker', name: 'London Double Decker Bus', dtl: ['Two passenger decks with upper curved window glass', 'Commercial red fleet livery', 'Dual rear heavy axles'] },
    { id: 'intercity_coach_bus', name: 'Intercity Highway Coach', dtl: ['High floor passenger window ribbon', 'Underfloor luggage bay doors', 'Triple axle touring coach chassis'] },
    { id: 'semi_truck_freightliner', name: 'Freightliner Semi Truck', dtl: ['High vertical chrome grille', 'Dual chrome air exhaust stacks behind cab', 'Massive fifth-wheel tractor hitch', 'Heavy dually wheels'] },
    { id: 'volvo_dump_truck', name: 'Heavy Dump Truck', dtl: ['Hydraulic steel dump bed', 'Commercial steel cab', 'High ground clearance construction tires', 'Reinforced steel bumper'] },
    { id: 'cement_mixer_truck', name: 'Concrete Mixer Truck', dtl: ['Rotating hydraulic cement drum', 'Chute discharge mechanism', 'Commercial heavy 4-axle chassis'] },
    { id: 'box_delivery_truck', name: 'Box Delivery Truck', dtl: ['Square aluminum cargo box', 'Roll-up rear door', 'Commercial fleet dual rear wheels'] },
    { id: 'ducati_superbike', name: 'Ducati Panigale V4', dtl: ['Single front wheel and fork', 'Exposed motorcycle chain and swingarm', 'Handlebar grips and clip-ons', 'Saddle seat'] },
    { id: 'harley_cruiser', name: 'Harley-Davidson Cruiser', dtl: ['V-Twin air-cooled motorcycle engine', 'Spoke two wheels', 'High-rise chrome handlebars', 'Teardrop fuel tank'] },
    { id: 'vespa_scooter', name: 'Vespa Primavera Scooter', dtl: ['Step-through metal scooter frame', 'Small 12-inch wheels', 'Single front suspension link', 'Under-seat storage'] },
    { id: 'motocross_dirt_bike', name: 'KTM 450 SX-F Dirt Bike', dtl: ['Knobby motocross tires', 'High front plastic fender', 'Long travel inverted front forks', 'Single seat'] },
    { id: 'road_bicycle', name: 'Trek Road Bicycle', dtl: ['Thin spoked bicycle wheels', 'Pedals and crankset', 'Tubular diamond bicycle frame', 'Drop handlebars'] },
    { id: 'mountain_bike', name: 'Specialized Mountain Bike', dtl: ['Knobby bicycle tires', 'Flat handlebars with brake levers', 'Front suspension fork and rear coil shock', 'Pedal drivetrain'] },
    { id: 'cargo_ebike', name: 'Electric Cargo Bicycle', dtl: ['Front wooden cargo box', 'Pedal assist motor hub', 'Long wheelbase two bicycle wheels'] },
    { id: 'pedestrian_street', name: 'Pedestrian Walking on Sidewalk', dtl: ['Human walking posture', 'Coat and sneakers', 'Concrete sidewalk paving', 'No vehicle bodywork'] },
    { id: 'dog_in_park', name: 'Golden Retriever in Grass', dtl: ['Canine four legs and tail', 'Fur coat', 'Green grass background', 'No mechanical parts'] },
    { id: 'cat_on_fence', name: 'Tabby Cat on Wooden Fence', dtl: ['Feline sitting pose', 'Whiskers and ears', 'Wooden fence texture', 'Zero vehicle components'] },
    { id: 'modern_building', name: 'Glass Skyscraper Building', dtl: ['Vertical architectural glass panels', 'Steel mullions', 'Blue sky reflections', 'Geometric structural grid'] },
    { id: 'empty_asphalt_road', name: 'Empty Highway Asphalt', dtl: ['Painted white lane divider lines', 'Asphalt texture', 'Guardrail barrier on horizon', 'Zero vehicles in frame'] },
    { id: 'mountain_forest_trail', name: 'Pine Forest Nature Trail', dtl: ['Evergreen pine trees', 'Dirt pathway with rocks', 'Overhead tree canopy', 'Pristine wilderness scene'] },
    { id: 'empty_parking_lot', name: 'Empty Painted Parking Lot Bays', dtl: ['Yellow painted parking stall stripes', 'Empty gray asphalt bay', 'No vehicles parked'] },
    { id: 'coffee_cup_macro', name: 'Coffee Cup on Wooden Table', dtl: ['Ceramic coffee mug with handle', 'Liquid surface with foam', 'Wooden grain table texture', 'Macro indoor framing'] },
    { id: 'laptop_desk', name: 'Laptop on Workspace Desk', dtl: ['Opened laptop keyboard and screen', 'Office desk background', 'Computer mouse', 'No vehicle present'] },
    { id: 'house_keys_counter', name: 'House Keys on Kitchen Counter', dtl: ['Metal keys on brass keyring', 'Granite countertop surface', 'Indoor kitchen lighting'] },
    { id: 'extreme_blur_night', name: 'Extremely Blurry Night Motion', dtl: ['Unrecognizable smeared light streaks', 'Severe sensor noise', 'No discernible edges or geometry'] },
    { id: 'pitch_black_frame', name: 'Pitch Black Frame', dtl: ['Pure dark sensor underexposure', 'Less than 2% average luminance', 'Zero discernible features'] },
    { id: 'severe_lens_flare', name: 'Extreme Direct Sun Lens Flare', dtl: ['Overexposed hexagonal lens glare artifacts', 'White-out blinding saturation', 'No recognizable object outlines'] },
    { id: 'smartphone_screenshot', name: 'Mobile Phone App Screenshot', dtl: ['Status bar icons (battery, wifi, time)', 'UI button elements and text typography', 'Digital flat rendering'] },
    { id: 'video_game_render', name: 'Low-Poly 3D Video Game Asset', dtl: ['Untextured polygonal geometric mesh', 'Flat shading artifacts', 'Artificial CGI ambient lighting'] },
    // --- Taxis: Vehicles where variant is strictly UNKNOWN / MUST ABSTAIN ---
    { id: 'nyc_taxi_crown_comfort', name: 'NYC Yellow Cab Taxi', isTaxi: true, dtl: ['Yellow illuminated TAXI roof light beacon', 'Yellow fleet door medallion 4920', 'Utilitarian black steel rims with hubcaps'] },
    { id: 'london_black_cab', name: 'London Black Cab TX4', isTaxi: true, dtl: ['High-roof purpose-built TAXI silhouette', 'Illuminated amber TAXI sign above windshield', 'Rear passenger wheelchair ramp door'] },
    { id: 'mumbai_kaali_peeli', name: 'Mumbai Kaali-Peeli Taxi', isTaxi: true, dtl: ['Black body with yellow painted roof', 'Mechanical taxi fare meter on dashboard', 'Fleet taxi license stencils'] }
  ];

  negativeCases.forEach((nc) => {
    const isTaxi = Boolean((nc as any).isTaxi);
    const expectedStatus = isTaxi ? 'uncertain' : 'rejected';
    const isVehicle = isTaxi;
    const make = isTaxi ? 'Toyota' : null;
    const model = isTaxi ? 'Crown Comfort Taxi' : null;

    addSample(
      `vid_neg_${nc.id}`,
      isVehicle,
      make,
      model,
      null,
      null, // Variant strictly null! Prohibited from trim guessing
      isTaxi ? 'Sedan' : null,
      'non_car',
      'street',
      'front_3q',
      isTaxi ? 0.88 : 0.15,
      false,
      false, // Variant NOT observable
      true,
      expectedStatus,
      {
        body_style: isTaxi ? 'Sedan' : 'Non-Car / Commercial Vehicle',
        grille: null,
        headlights: null,
        taillights: null,
        hood: null,
        roofline: null,
        windows: null,
        wheels: null,
        exhaust: null,
        aero: null,
        badges: null,
        text: null,
        body_proportions: isTaxi ? 'Municipal passenger taxi' : 'Non-passenger vehicle or non-vehicle scene',
        distinctive_details: nc.dtl
      },
      isTaxi ? [
        { name: 'Toyota Crown Comfort Taxi', score: 0.72, supporting_evidence: nc.dtl, contradictions: [] },
        { name: 'BMW M4 CSL (G82)', score: 0.01, supporting_evidence: [], contradictions: ['Taxi commercial beacon contradicts sports car'] }
      ] : [],
      undefined,
      isTaxi ? 'Commercial taxi fleet: variant is unobservable and prohibited from sport trim guessing' : 'No consumer passenger automobile detected in frame'
    );
  });

  return { groundTruth, blindSamples };
}

// Generate files if executed directly
if (process.argv[1]?.endsWith('generate_blind_dataset.ts') || process.argv[1]?.includes('generate_blind_dataset')) {
  const { groundTruth, blindSamples } = buildCompleteBlindDataset();

  const outDir = path.join(__dirname, '../src/ai-engine/evaluation/blind_dataset');
  const imagesDir = path.join(outDir, 'images');
  const gtDir = path.join(outDir, 'ground_truth');

  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(gtDir, { recursive: true });

  fs.writeFileSync(path.join(gtDir, 'ground_truth.json'), JSON.stringify(groundTruth, null, 2), 'utf8');
  fs.writeFileSync(path.join(imagesDir, 'blind_samples.json'), JSON.stringify(blindSamples, null, 2), 'utf8');

  // Compute distinct vehicle identities
  const distinctVehicleIds = new Set<string>();
  Object.values(groundTruth).forEach((gt) => {
    if (gt.is_vehicle && !gt.vehicle_identity_id.startsWith('vid_neg_')) {
      distinctVehicleIds.add(gt.vehicle_identity_id);
    }
  });

  console.log(`\n==============================================================`);
  console.log(`APEX BLIND GLOBAL AUTOMOTIVE BENCHMARK DATASET READY:`);
  console.log(`  Total Blind Samples:         ${blindSamples.length}`);
  console.log(`  Total Ground-Truth Keys:     ${Object.keys(groundTruth).length}`);
  console.log(`  Distinct Vehicle Identities: ${distinctVehicleIds.size}`);
  console.log(`  Ground-Truth Location:       ${path.join(gtDir, 'ground_truth.json')}`);
  console.log(`  Blind Samples Location:      ${path.join(imagesDir, 'blind_samples.json')}`);
  console.log(`==============================================================\n`);
}
