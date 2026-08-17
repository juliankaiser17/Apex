# APEX Vehicle Data Schema Specification
**Document ID:** `APEX-SPEC-DATA-02`  
**Revision:** `3.2.0-PROD`

---

## 1. Normalized Vehicle Entity Model

The local vehicle dataset represents verified real-world production automobiles across generations, trims, and performance metrics:

```typescript
export interface NormalizedVehicle {
  id: string;                      // Unique slug (e.g. "porsche-911-gt3-rs-992")
  manufacturer: string;            // e.g. "Porsche"
  model: string;                   // e.g. "911 GT3 RS"
  generation: string;              // e.g. "992"
  yearStart: number;               // e.g. 2022
  yearEnd?: number;                // undefined if active production
  trim?: string;                   // e.g. "Weissach Package"
  bodyStyle: 'Coupe' | 'Convertible' | 'Sedan' | 'SUV' | 'Hatchback' | 'Wagon' | 'Targa' | 'Hypercar';
  engine: string;                  // e.g. "4.0L Naturally Aspirated Boxer-6"
  displacementCc?: number;         // e.g. 3996
  aspiration: 'Naturally Aspirated' | 'Turbocharged' | 'Twin-Turbo' | 'Supercharged' | 'Quad-Turbo' | 'Electric' | 'Hybrid';
  cylinders?: number;              // e.g. 6 (or undefined for EV)
  drivetrain: 'RWD' | 'AWD' | 'FWD';
  transmission: string;            // e.g. "7-Speed Dual-Clutch (PDK)"
  horsepower: number;              // e.g. 518
  torqueNm: number;                // e.g. 465
  zeroToHundredSec: number;        // e.g. 3.2
  zeroToSixtyMphSec: number;       // e.g. 3.0
  topSpeedKmH: number;             // e.g. 296
  curbWeightKg: number;            // e.g. 1450
  fuelType: 'Gasoline' | 'Diesel' | 'Hybrid' | 'Plug-in Hybrid' | 'Electric';
  electricRangeKm?: number;        // e.g. 520 (for EV/PHEV)
  batteryCapacityKwh?: number;     // e.g. 93.4 (for EV)
  productionYears: string;         // e.g. "2022–Present"
  productionCount?: number;        // e.g. 1918 (if limited series)
  originCountry: string;           // e.g. "Germany"
  notableFacts: string;            // Key historical or aero feature
  baselineRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  visualSignature: {
    aspectRatio: number;           // Width to height ratio (e.g. 2.1)
    silhouetteClass: 'low_slung_coupe' | 'angular_wedge' | 'widebody_supercar' | 'high_rider_suv' | 'grand_tourer';
    prominentColors: string[];     // Characteristic launch colors
  };
}
```

---

## 2. Backward Compatibility & Scalability Rules
1. **Schema Extensibility:** Fields can be added without breaking existing local records or active user saves.
2. **Missing Spec Handling:** Non-applicable fields (e.g. `electricRangeKm` for gas cars or `cylinders` for EVs) are optional. UI renders only verified non-null specifications.
