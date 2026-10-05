/**
 * APEX — General Field-Aware Evidence Normalization Engine
 * 
 * Provides domain-agnostic anatomical zone extraction, clause splitting,
 * and field-level isolation across all automotive manufacturers.
 * 
 * INVARIANTS:
 * 1. Zero Cross-Field Pollution: Evidence explicitly describing one field or zone
 *    (e.g. rear lamps, exhaust) can NEVER satisfy or contradict another field (e.g. front headlights).
 * 2. Transitional Clause Splitting: Compound natural-language sentences describing multiple
 *    vehicle regions are decomposed into independent, localized anatomical clauses.
 * 3. Manufacturer Neutrality: All rules operate on generic automotive anatomy
 *    (front, rear, side, roof, cabin, wheels, exhaust, intake, headlights, taillights),
 *    with zero brand-specific or model-specific hardcoding.
 */

export type AnatomicalZone = 'front' | 'rear' | 'side' | 'roof' | 'cabin' | 'wheels' | 'exhaust' | 'intake' | 'headlights' | 'taillights' | 'global';

export interface AnatomicalClause {
  rawText: string;
  normalizedText: string;
  hasFront: boolean;
  hasRear: boolean;
  hasSide: boolean;
  hasRoof: boolean;
  hasCabin: boolean;
  hasWheels: boolean;
  hasExhaust: boolean;
  hasIntake: boolean;
  hasHeadlights: boolean;
  hasTaillights: boolean;
}

// Regexes for detecting anatomical focus
const FRONT_INDICATORS = /\b(front|nose|bonnet|hood|headlights?|headlamps?|front\s+grille|front\s+bumper|front\s+splitter|front\s+fascia|front\s+fenders?|front\s+overhang)\b/i;
const REAR_INDICATORS = /\b(rear|tail|taillights?|tail\s+lamps?|tail[\s-]?lights?|exhaust|diffuser|rear\s+bumper|rear\s+wing|rear\s+spoiler|trunk|boot|ducktail|rear\s+fascia|rear\s+deck|rear\s+haunches|rear\s+apron)\b/i;
const HEADLIGHT_INDICATORS = /\b(headlights?|headlamps?|drl|daytime\s+running\s+lights?|front\s+lamps?|front\s+lights?|eyelid\s+covers?|matrix\s+led|high\s+beams?)\b/i;
const TAILLIGHT_INDICATORS = /\b(taillights?|tail\s+lamps?|tail[\s-]?lights?|rear\s+lamps?|rear\s+lights?|brake\s+lights?|rear\s+lightbar|squircle\s+taillights?)\b/i;
const EXHAUST_INDICATORS = /\b(exhaust|tailpipes?|exhaust\s+tips?|mufflers?|exhaust\s+outlets?|quad\s+exhaust|central\s+exhaust|dual\s+exhaust)\b/i;
const INTAKE_INDICATORS = /\b(grille|grill|air\s+intakes?|radiators?|intake\s+ducts?|cooling\s+vents?|air\s+scoops?|naca\s+ducts?|splitters?)\b/i;
const SIDE_INDICATORS = /\b(side|flanks?|doors?|side\s+skirts?|rockers?|side\s+sills?|side\s+scoops?|door\s+mirrors?|side\s+mirrors?|fender\s+louvers?)\b/i;
const ROOF_INDICATORS = /\b(roof|roofline|canopy|targa|convertible|soft\s*top|hardtop|a-pillars?|b-pillars?|c-pillars?|buttress(?:es)?|greenhouse|sunroof)\b/i;
const CABIN_INDICATORS = /\b(cabin|cockpit|windshield|windscreen|interior|seats?|steering\s+wheel|visor\s+canopy|glasshouse)\b/i;
const WHEEL_INDICATORS = /\b(wheels?|rims?|alloys?|calipers?|tires?|tyres?|brakes?|ceramic\s+rotors?)\b/i;

// Coordinate transitional conjunctions that split multi-zone sentences:
// Handles conjunctions and optional determiners/quantifiers before region tokens
// e.g. "two large headlamps with LED strip, and two smaller taillamps" -> splits cleanly
const COMPOUND_TRANSITION_RE = /\s*(?:[.;\n]+|,\s*(?:(?:and|while|whereas|but)\s+)?(?=(?:(?:two|three|four|dual|twin|a|an|the|each|pair\s+of|smaller|larger)\s+)?(?:front|rear|side|roof|cabin|wheels?|exhaust|intake|headlights?|headlamps?|lamps?|lights?|taillights?|hood|bonnet|nose|tail|diffuser|splitter|trunk|boot|mirrors?)\b))\s*/i;

export class EvidenceNormalizer {
  /**
   * Decompose free-text observations into localized, anatomically tagged clauses
   */
  public decomposeText(text: string): AnatomicalClause[] {
    if (!text || typeof text !== 'string') return [];

    const rawClauses = text
      .split(COMPOUND_TRANSITION_RE)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Deduplicate echoed/identical clauses to preserve true evidence independence
    const seenClauses = new Set<string>();
    const uniqueClauses: string[] = [];
    for (const c of rawClauses) {
      const simplified = c.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!simplified) continue;
      if (seenClauses.has(simplified)) continue;
      seenClauses.add(simplified);
      uniqueClauses.push(c);
    }

    return uniqueClauses.map((clause) => {
      const norm = clause.toLowerCase();
      const hasFront = FRONT_INDICATORS.test(norm);
      const hasRear = REAR_INDICATORS.test(norm);
      const hasHeadlights = HEADLIGHT_INDICATORS.test(norm);
      const hasTaillights = TAILLIGHT_INDICATORS.test(norm);
      const hasExhaust = EXHAUST_INDICATORS.test(norm);
      const hasIntake = INTAKE_INDICATORS.test(norm);
      const hasSide = SIDE_INDICATORS.test(norm);
      const hasRoof = ROOF_INDICATORS.test(norm);
      const hasCabin = CABIN_INDICATORS.test(norm);
      const hasWheels = WHEEL_INDICATORS.test(norm);

      return {
        rawText: clause,
        normalizedText: norm,
        hasFront,
        hasRear,
        hasSide,
        hasRoof,
        hasCabin,
        hasWheels,
        hasExhaust,
        hasIntake,
        hasHeadlights,
        hasTaillights
      };
    });
  }

  /**
   * Filter evidence clauses for a specific vehicle anatomical region.
   * Enforces that evidence explicitly describing opposing zones is excluded,
   * and requires relevant anatomical grounding tokens for targeted zones.
   */
  public filterClausesForZone(
    clauses: AnatomicalClause[],
    targetZone: 'headlights' | 'front_grille' | 'hood' | 'side' | 'roof' | 'rear_exhaust' | 'rear_fascia' | 'global'
  ): string {
    const eligible = clauses.filter((c) => {
      switch (targetZone) {
        case 'headlights':
          // Headlights must NEVER contain rear observations, taillights, or exhaust
          if (c.hasRear || c.hasTaillights || c.hasExhaust) return false;
          // If explicitly describing side, intake, wheels, or cabin with no lighting mentions, exclude
          if ((c.hasSide || c.hasIntake || c.hasWheels || c.hasCabin) && !c.hasHeadlights) return false;
          // Clause MUST have lighting or lamp indicators
          if (!c.hasHeadlights && !/\b(headlights?|headlamps?|drl|lamps?|lights?|eyelid|lens)\b/i.test(c.normalizedText)) return false;
          return true;

        case 'front_grille':
          // Front intake/grille must NEVER contain rear observations or exhaust
          if (c.hasRear || c.hasTaillights || c.hasExhaust) return false;
          // If explicitly describing side, roof, wheels, or cabin without intake/front mentions, exclude
          if ((c.hasSide || c.hasRoof || c.hasWheels || c.hasCabin) && !c.hasIntake && !c.hasFront) return false;
          // Clause MUST have grille, intake, mouth, or front aero indicators
          if (!c.hasIntake && !/\b(grille?|grill|intake|splitter|bumper|mesh|mouth|slats?|strakes?)\b/i.test(c.normalizedText)) return false;
          return true;

        case 'hood':
          // Hood must NEVER contain rear trunk/exhaust/diffuser observations
          if (c.hasRear || c.hasTaillights || c.hasExhaust) return false;
          // If explicitly describing side, roof, wheels, or cabin without hood mentions, exclude
          if ((c.hasSide || c.hasRoof || c.hasWheels || c.hasCabin) && !c.normalizedText.includes('hood') && !c.normalizedText.includes('bonnet')) return false;
          // Clause MUST have hood, bonnet, or front lid indicators
          if (!/\b(hood|bonnet|lid|extractor|vent|scoop|bulge|s-duct)\b/i.test(c.normalizedText)) return false;
          return true;

        case 'side':
          // Side features must not be confused with pure front grille or pure rear diffuser
          if (c.hasFront && !c.hasSide && !c.hasIntake) return false;
          if (c.hasRear && !c.hasSide && !c.hasIntake) return false;
          return true;

        case 'roof':
          // Roof/greenhouse must not contain exhaust or lower diffuser cues
          if (c.hasExhaust) return false;
          return true;

        case 'rear_exhaust':
        case 'rear_fascia':
          // Rear features must NEVER contain front headlights, front bumper, or hood
          if (c.hasFront || c.hasHeadlights) return false;
          if (!c.hasRear && !c.hasTaillights && !c.hasExhaust && !/\b(exhaust|tailpipe|diffuser|taillight|strakes?|deck)\b/i.test(c.normalizedText)) return false;
          return true;

        case 'global':
        default:
          return true;
      }
    });

    return eligible.map((c) => c.normalizedText).join(' . ');
  }

  /**
   * Separate mixed lighting observations into distinct front and rear fields
   */
  public separateLightingCues(rawLightingText: string): { headlights: string; taillights: string } {
    if (!rawLightingText) return { headlights: '', taillights: '' };

    const clauses = this.decomposeText(rawLightingText);
    const frontClauses: string[] = [];
    const rearClauses: string[] = [];
    const ambiguousClauses: string[] = [];

    for (const c of clauses) {
      const isRear = c.hasRear || c.hasTaillights;
      const isFront = c.hasFront || c.hasHeadlights;

      if (isRear && !isFront) {
        rearClauses.push(c.rawText);
      } else if (isFront && !isRear) {
        frontClauses.push(c.rawText);
      } else {
        ambiguousClauses.push(c.rawText);
      }
    }

    return {
      headlights: frontClauses.length > 0 ? frontClauses.join('; ') : ambiguousClauses.join('; '),
      taillights: rearClauses.length > 0 ? rearClauses.join('; ') : (ambiguousClauses.length > 0 ? ambiguousClauses.join('; ') : '')
    };
  }

  /**
   * Separate mixed intake/grille/diffuser cues into distinct front and rear aerodynamic fields
   */
  public separateIntakeAndAeroCues(rawIntakeText: string): { frontGrille: string; rearDiffuser: string } {
    if (!rawIntakeText) return { frontGrille: '', rearDiffuser: '' };

    const clauses = this.decomposeText(rawIntakeText);
    const frontClauses: string[] = [];
    const rearClauses: string[] = [];
    const ambiguousClauses: string[] = [];

    for (const c of clauses) {
      const isRear = c.hasRear || c.hasExhaust;
      const isFront = c.hasFront || c.hasIntake;

      if (isRear && !isFront) {
        rearClauses.push(c.rawText);
      } else if (isFront && !isRear) {
        frontClauses.push(c.rawText);
      } else {
        ambiguousClauses.push(c.rawText);
      }
    }

    return {
      frontGrille: frontClauses.length > 0 ? frontClauses.join('; ') : ambiguousClauses.join('; '),
      rearDiffuser: rearClauses.length > 0 ? rearClauses.join('; ') : ''
    };
  }
}

export const evidenceNormalizer = new EvidenceNormalizer();
