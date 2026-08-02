import type { CarCard, RarityTier } from '../types/apex';

export interface CarPreset {
  id: string;
  make: string;
  model: string;
  generation?: string;
  trim?: string;
  yearEstimate: string;
  releasedYear: string;
  color: string;
  bodyStyle: 'Sedan' | 'Coupe' | 'SUV' | 'Hatchback' | 'Convertible' | 'Wagon' | 'Pickup' | 'Van' | 'Supercar' | 'Hypercar';
  rarity: RarityTier;
  rarityScore: number;
  topSpeedKmH: number;
  horsepower: number;
  engine: string;
  zeroToHundredSec: number;
  torqueNm: number;
  kerbWeightKg: number;
  originCountry: string;
  interestingFact: string;
  briefHistory: string;
  modsDetected: { part: string; description: string; confidence: number }[];
  imageUrl: string;
  marketValueLowUsd: number;
  marketValueHighUsd: number;
  cityRarityNotes: string;
  stateRegion: string;
}

export const CAR_PRESETS: CarPreset[] = [
  {
    id: 'preset-ferrari-488',
    make: 'Ferrari',
    model: '488 GTB',
    generation: 'F142M',
    trim: 'V8 Turbo',
    yearEstimate: '2019',
    releasedYear: '2019',
    color: 'Rosso Corsa',
    bodyStyle: 'Supercar',
    rarity: 'epic',
    rarityScore: 78,
    topSpeedKmH: 330,
    horsepower: 660,
    engine: '3.9L V8 Twin-Turbo',
    zeroToHundredSec: 3.0,
    torqueNm: 760,
    kerbWeightKg: 1475,
    originCountry: 'Italy',
    interestingFact: 'The 488 replaced the iconic 458 Italia and introduced mid-engine twin-turbocharging to Ferrari mainliners for the first time since the legendary F40.',
    briefHistory: 'Named 488 after the engine\'s unitary displacement of 488 cc. It won Red Dot Best of the Best design award in 2016.',
    modsDetected: [
      { part: 'Exhaust System', description: 'Capristo Titanium Valve-Tuned Exhaust', confidence: 0.94 },
      { part: 'Wheels', description: 'HRE P101 Monoblock Forged Alloys in Satin Black', confidence: 0.89 },
      { part: 'Suspension', description: 'Novitec Lowering Springs (-20mm drop)', confidence: 0.82 }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=1200&auto=format&fit=crop',
    marketValueLowUsd: 220000,
    marketValueHighUsd: 290000,
    cityRarityNotes: 'Ferrari 488 GTBs are exceptionally rare in this region. Seen less than once per 500 spots.',
    stateRegion: 'Uttar Pradesh'
  },
  {
    id: 'preset-lamborghini-huracan',
    make: 'Lamborghini',
    model: 'Huracán EVO',
    generation: 'LP 640-4',
    trim: 'V10 All-Wheel Drive',
    yearEstimate: '2019',
    releasedYear: '2019',
    color: 'Verde Mantis',
    bodyStyle: 'Supercar',
    rarity: 'legendary',
    rarityScore: 86,
    topSpeedKmH: 325,
    horsepower: 640,
    engine: '5.2L V10 NA',
    zeroToHundredSec: 3.2,
    torqueNm: 600,
    kerbWeightKg: 1422,
    originCountry: 'Italy',
    interestingFact: 'Named after a fighting bull of the Spanish Conte de la Patilla breed known for its courage in 1892.',
    briefHistory: 'Equipped with LDVI (Lamborghini Dinamica Veicolo Integrata) predictive super-computer controller.',
    modsDetected: [
      { part: 'Exhaust', description: 'Ryft Titanium Race Pipe Exhaust', confidence: 0.92 },
      { part: 'Spoiler', description: 'Vorsteiner Carbon Fiber Wing', confidence: 0.88 }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=1200&auto=format&fit=crop',
    marketValueLowUsd: 260000,
    marketValueHighUsd: 330000,
    cityRarityNotes: 'Epic V10 Supercar! A favorite among local enthusiast collectors.',
    stateRegion: 'Uttar Pradesh'
  },
  {
    id: 'preset-bugatti-chiron',
    make: 'Bugatti',
    model: 'Chiron Super Sport',
    generation: 'Type 57',
    trim: 'W16 Quad-Turbo',
    yearEstimate: '2022',
    releasedYear: '2022',
    color: 'French Racing Blue / Exposed Carbon',
    bodyStyle: 'Hypercar',
    rarity: 'mythic',
    rarityScore: 98,
    topSpeedKmH: 440,
    horsepower: 1578,
    engine: '8.0L W16 Quad-Turbo',
    zeroToHundredSec: 2.4,
    torqueNm: 1600,
    kerbWeightKg: 1995,
    originCountry: 'France',
    interestingFact: 'At top speed, the Chiron empties its 100-liter fuel tank in just 9 minutes and consumes 45,000 liters of air per minute.',
    briefHistory: 'Only 500 units were produced by hand at Molsheim, France. Named after Monegasque driver Louis Chiron.',
    modsDetected: [
      { part: 'Aero', description: 'Exposed Blue Tinted Carbon Fiber Body Weave', confidence: 0.98 },
      { part: 'Brakes', description: 'AP Racing Titanium 3D-Printed Calipers', confidence: 0.91 }
    ],
    imageUrl: '/bugatti-chiron.png',
    marketValueLowUsd: 3800000,
    marketValueHighUsd: 4500000,
    cityRarityNotes: 'MYTHIC FIND! One of only 500 Chiron models in existence worldwide. Ultra-rare spot!',
    stateRegion: 'Delhi NCR'
  },
  {
    id: 'preset-porsche-gt3',
    make: 'Porsche',
    model: '911 GT3 RS',
    generation: '992',
    trim: 'Weissach Package',
    yearEstimate: '2023',
    releasedYear: '2023',
    color: 'Lizard Green',
    bodyStyle: 'Coupe',
    rarity: 'legendary',
    rarityScore: 88,
    topSpeedKmH: 296,
    horsepower: 518,
    engine: '4.0L Flat-6 NA',
    zeroToHundredSec: 3.2,
    torqueNm: 465,
    kerbWeightKg: 1450,
    originCountry: 'Germany',
    interestingFact: 'Features a DRS (Drag Reduction System) hydraulic rear wing inspired by Formula 1 cars that produces 860 kg of downforce at 285 km/h.',
    briefHistory: 'The pinnacle of road-legal track engineering from Weissach. Revs to a screaming 9,000 RPM.',
    modsDetected: [
      { part: 'Package', description: 'Factory Weissach Carbon Fiber Package & Magnesium Wheels', confidence: 0.97 },
      { part: 'Cage', description: 'Titanium Roll Cage Extension', confidence: 0.93 }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=1200&auto=format&fit=crop',
    marketValueLowUsd: 310000,
    marketValueHighUsd: 420000,
    cityRarityNotes: 'Legendary track weapon! Less than 3 active sightings in the metro radius.',
    stateRegion: 'Maharashtra'
  },
  {
    id: 'preset-bmw-m3',
    make: 'BMW',
    model: 'M3 Competition',
    generation: 'G80',
    trim: 'xDrive',
    yearEstimate: '2022',
    releasedYear: '2022',
    color: 'Isle of Man Green',
    bodyStyle: 'Sedan',
    rarity: 'rare',
    rarityScore: 58,
    topSpeedKmH: 290,
    horsepower: 503,
    engine: '3.0L Twin-Turbo I6',
    zeroToHundredSec: 3.5,
    torqueNm: 650,
    kerbWeightKg: 1780,
    originCountry: 'Germany',
    interestingFact: 'The S58 twin-turbo engine uses 3D-printed cylinder head core technology to reduce weight and optimize coolant flow.',
    briefHistory: 'Sixth generation M3 features the bold vertical kidney grille design and M xDrive rear-biased all-wheel-drive.',
    modsDetected: [
      { part: 'Splitter', description: 'M Performance Carbon Front Lip & Air Inlets', confidence: 0.90 }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=1200&auto=format&fit=crop',
    marketValueLowUsd: 82000,
    marketValueHighUsd: 105000,
    cityRarityNotes: 'Rare daily supercar slayer. Distinctive Isle of Man Green spec!',
    stateRegion: 'Karnataka'
  },
  {
    id: 'preset-nissan-gtr',
    make: 'Nissan',
    model: 'GT-R Nismo',
    generation: 'R35',
    trim: 'Track Edition',
    yearEstimate: '2020',
    releasedYear: '2020',
    color: 'Pearl White / Red Accents',
    bodyStyle: 'Coupe',
    rarity: 'legendary',
    rarityScore: 84,
    topSpeedKmH: 315,
    horsepower: 600,
    engine: '3.8L V6 Twin-Turbo',
    zeroToHundredSec: 2.7,
    torqueNm: 652,
    kerbWeightKg: 1703,
    originCountry: 'Japan',
    interestingFact: 'Every GT-R VR38 engine is hand-assembled by one of only five master craftsmen called "Takumi" in a cleanroom in Yokohama.',
    briefHistory: 'Known worldwide as "Godzilla". The Nismo version uses GT3-spec turbochargers and dry-carbon bonnet and wings.',
    modsDetected: [
      { part: 'Braking', description: 'Brembo Carbon Ceramic Brake Rotors', confidence: 0.95 }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop',
    marketValueLowUsd: 210000,
    marketValueHighUsd: 280000,
    cityRarityNotes: 'Legendary JDM Royalty! Extremely rare Takumi hand-built Nismo variant.',
    stateRegion: 'Tamil Nadu'
  }
];

export const INITIAL_GARAGE: CarCard[] = [
  {
    id: 'card-1',
    cardNumber: '#APX-004821',
    make: 'LAMBORGHINI',
    model: 'HURACÁN EVO',
    generation: 'LP 640-4',
    trim: 'V10 All-Wheel Drive',
    yearEstimate: '2019',
    releasedYear: '2019',
    color: 'Verde Mantis',
    bodyStyle: 'Coupe',
    rarity: 'legendary',
    rarityScore: 86,
    topSpeedKmH: 325,
    horsepower: 640,
    engine: '5.2L V10 NA',
    zeroToHundredSec: 3.2,
    torqueNm: 600,
    kerbWeightKg: 1422,
    originCountry: 'Italy',
    interestingFact: 'Named after a fighting bull of the Spanish Conte de la Patilla breed known for its courage in 1892.',
    briefHistory: 'Equipped with LDVI predictive super-computer controller.',
    modsDetected: CAR_PRESETS[1].modsDetected,
    imageUrl: CAR_PRESETS[1].imageUrl,
    latApprox: 22.2950,
    lngApprox: 114.1720,
    city: 'Hong Kong',
    stateRegion: 'Kowloon',
    country: 'Hong Kong',
    xpEarned: 750,
    marketValueLowUsd: 260000,
    marketValueHighUsd: 330000,
    scanValidated: true,
    isPublic: true,
    huntTriggered: false,
    privacyLevel: 'public_blurred',
    aiConfidence: 0.98,
    createdAt: new Date().toISOString(),
    spottedDateFormatted: '12 JUL 2025',
    isFirstCityScan: true
  },
  {
    id: 'card-2',
    cardNumber: '#APX-001294',
    make: 'FERRARI',
    model: '488 GTB',
    generation: 'F142M',
    trim: 'V8 Turbo',
    yearEstimate: '2019',
    releasedYear: '2019',
    color: 'Rosso Corsa',
    bodyStyle: 'Supercar',
    rarity: 'epic',
    rarityScore: 78,
    topSpeedKmH: 330,
    horsepower: 660,
    engine: '3.9L V8 Twin-Turbo',
    zeroToHundredSec: 3.0,
    torqueNm: 760,
    kerbWeightKg: 1475,
    originCountry: 'Italy',
    interestingFact: 'The 488 replaced the iconic 458 Italia and introduced mid-engine twin-turbocharging.',
    briefHistory: 'Named 488 after unitary displacement of 488 cc per cylinder.',
    modsDetected: CAR_PRESETS[0].modsDetected,
    imageUrl: CAR_PRESETS[0].imageUrl,
    latApprox: 22.2940,
    lngApprox: 114.1710,
    city: 'Hong Kong',
    stateRegion: 'Kowloon',
    country: 'Hong Kong',
    xpEarned: 400,
    marketValueLowUsd: 220000,
    marketValueHighUsd: 290000,
    scanValidated: true,
    isPublic: true,
    huntTriggered: false,
    privacyLevel: 'public_blurred',
    aiConfidence: 0.96,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    spottedDateFormatted: '10 JUL 2025',
    isFirstCityScan: true
  },
  {
    id: 'card-3',
    cardNumber: '#APX-000012',
    make: 'BUGATTI',
    model: 'CHIRON SUPER SPORT',
    generation: 'Type 57',
    trim: 'W16 Quad-Turbo',
    yearEstimate: '2022',
    releasedYear: '2022',
    color: 'French Racing Blue',
    bodyStyle: 'Hypercar',
    rarity: 'mythic',
    rarityScore: 98,
    topSpeedKmH: 440,
    horsepower: 1578,
    engine: '8.0L W16 Quad-Turbo',
    zeroToHundredSec: 2.4,
    torqueNm: 1600,
    kerbWeightKg: 1995,
    originCountry: 'France',
    interestingFact: 'At top speed, the Chiron consumes 45,000 liters of air per minute.',
    briefHistory: 'Only 500 units crafted globally.',
    modsDetected: CAR_PRESETS[2].modsDetected,
    imageUrl: CAR_PRESETS[2].imageUrl,
    latApprox: 22.2930,
    lngApprox: 114.1720,
    city: 'Hong Kong',
    stateRegion: 'Kowloon',
    country: 'Hong Kong',
    xpEarned: 1500,
    marketValueLowUsd: 3800000,
    marketValueHighUsd: 4500000,
    scanValidated: true,
    isPublic: true,
    huntTriggered: true,
    privacyLevel: 'public_blurred',
    aiConfidence: 0.99,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    spottedDateFormatted: '02 JUL 2025',
    isFirstGlobalScan: true
  }
];
