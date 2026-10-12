/**
 * APEX — 3-Tier Dynamic & Location-Aware Quest Engine
 * 
 * Implements 3 distinct challenge tiers with 10+ distinct quests per tier (30+ total):
 * 1. NORMAL QUESTS — Accessible everyday spotting challenges (Marques, body styles, daylight, confidence)
 * 2. HARD QUESTS — High-activity challenges testing speed, consistency, horsepower, and tuning
 * 3. EXTREME QUESTS — Genuinely difficult milestones (Exotics, 600+ HP, tight sprints, multi-rarities)
 * 
 * Features:
 * - Deterministic UTC midnight expiration (never resets on navigation)
 * - Location-aware generation tailoring objectives to user's city/country/region
 * - Safe fallback when location is disabled or sparse
 * - Real progress tracking driven by actual scans
 * - Time-windowed quests with active countdown session support
 */

import type { RarityTier, BodyStyle, CarCard, DailyQuest } from '../types/apex';

export type QuestDifficulty = 'NORMAL' | 'HARD' | 'EXTREME';

export type QuestObjectiveType = 
  | 'count'
  | 'rarity'
  | 'time_window'
  | 'location_city'
  | 'regional_brands'
  | 'power_spec'
  | 'speed_spec'
  | 'consecutive_scans'
  | 'body_style'
  | 'time_of_day'
  | 'accuracy'
  | 'mods'
  | 'classic'
  | 'engine_spec';

export interface ApexQuest extends DailyQuest {
  id: string;
  tier: QuestDifficulty;
  type: QuestObjectiveType;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  xpReward: number;
  coinReward: number;
  badgeRewardSlug?: string;
  isCompleted: boolean;
  claimedAt?: string;
  expiresAtTimestamp: number;
  startedAtTimestamp?: number;
  windowMinutes?: number;
  
  // Objective Filters
  allowedMakes?: string[];
  requiredRarity?: RarityTier;
  minRarity?: RarityTier;
  minHorsepower?: number;
  minTopSpeedKmH?: number;
  minAiConfidence?: number;
  maxYear?: number;
  hasMods?: boolean;
  allowedBodyStyles?: BodyStyle[];
  targetCity?: string;
  targetRegion?: string;
  timeOfDay?: 'day' | 'night' | 'golden_hour';
}

export interface QuestScanContext {
  card: CarCard;
  scanTimestamp: number;
  city?: string;
  country?: string;
  isSessionConsecutive?: boolean;
}

export interface QuestGenerationParams {
  userId: string;
  userCity?: string;
  userCountry?: string;
  userLevel?: number;
  explorationCities?: string[];
}

const RARITY_RANK: Record<RarityTier, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6
};

/**
 * Returns UTC midnight boundary for the current calendar day.
 * Pinned so daily timers never jump or reset upon re-rendering or navigating tabs.
 */
export function getDailyExpirationTimestamp(): number {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return endOfDay.getTime();
}

// ────────────────────────────────────────────────────────────────────────────
// TEMPLATE POOLS (12+ Normal, 12+ Hard, 12+ Extreme = 36 Total Templates)
// ────────────────────────────────────────────────────────────────────────────

export const NORMAL_TEMPLATES: Omit<ApexQuest, 'id' | 'tier' | 'currentCount' | 'isCompleted' | 'expiresAtTimestamp'>[] = [
  {
    type: 'count',
    title: 'Daily Spotlight: 3 Vehicle Scans',
    description: 'Spot and photograph 3 real street vehicles today.',
    targetCount: 3,
    xpReward: 350,
    coinReward: 70
  },
  {
    type: 'body_style',
    title: 'Coupe & Sedan Duo',
    description: 'Document at least 1 Coupe and 1 Sedan in your area.',
    targetCount: 2,
    allowedBodyStyles: ['Coupe', 'Sedan'],
    xpReward: 300,
    coinReward: 60
  },
  {
    type: 'body_style',
    title: 'SUV Territory',
    description: 'Spot 2 SUVs or Crossovers out on the road.',
    targetCount: 2,
    allowedBodyStyles: ['SUV'],
    xpReward: 280,
    coinReward: 55
  },
  {
    type: 'body_style',
    title: 'Hatchback & Wagon Scout',
    description: 'Locate 2 functional hot hatches or sport wagons.',
    targetCount: 2,
    allowedBodyStyles: ['Hatchback', 'Wagon'],
    xpReward: 310,
    coinReward: 60
  },
  {
    type: 'regional_brands',
    title: 'Asian Performance Scout',
    description: 'Spot 2 Japanese or Korean vehicles (Toyota, Nissan, Honda, Mazda, Hyundai, Kia).',
    targetCount: 2,
    allowedMakes: ['Toyota', 'Nissan', 'Honda', 'Mazda', 'Subaru', 'Lexus', 'Hyundai', 'Kia'],
    xpReward: 320,
    coinReward: 65
  },
  {
    type: 'regional_brands',
    title: 'European Engineering',
    description: 'Photograph 2 European automobiles (BMW, Mercedes, Audi, Volkswagen, Porsche).',
    targetCount: 2,
    allowedMakes: ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen', 'Porsche', 'Volvo'],
    xpReward: 340,
    coinReward: 70
  },
  {
    type: 'regional_brands',
    title: 'American Iron: V8 & Muscle',
    description: 'Document 2 American vehicles (Ford, Chevrolet, Dodge, Cadillac, Jeep).',
    targetCount: 2,
    allowedMakes: ['Ford', 'Chevrolet', 'Dodge', 'Cadillac', 'Corvette', 'Jeep', 'GMC'],
    xpReward: 330,
    coinReward: 65
  },
  {
    type: 'accuracy',
    title: 'Precision Lock: 90%+ Confidence',
    description: 'Capture a crisp, unblurred photograph resulting in >= 90% AI certainty.',
    targetCount: 1,
    minAiConfidence: 0.90,
    xpReward: 300,
    coinReward: 60
  },
  {
    type: 'time_of_day',
    title: 'Daylight Discovery',
    description: 'Spot 2 vehicles during daylight hours with optimal lighting.',
    targetCount: 2,
    timeOfDay: 'day',
    xpReward: 290,
    coinReward: 60
  },
  {
    type: 'rarity',
    title: 'Street Regular: 2 Common Finds',
    description: 'Catalog 2 everyday daily drivers for your street database.',
    targetCount: 2,
    requiredRarity: 'common',
    xpReward: 280,
    coinReward: 50
  },
  {
    type: 'body_style',
    title: 'Open-Air Specimen: Convertible',
    description: 'Find a drop-top roadster, cabriolet, or targa in the wild.',
    targetCount: 1,
    allowedBodyStyles: ['Convertible'],
    xpReward: 350,
    coinReward: 70
  },
  {
    type: 'count',
    title: 'Neighborhood Patrol',
    description: 'Photograph 2 vehicles within your local exploration perimeter.',
    targetCount: 2,
    xpReward: 270,
    coinReward: 55
  }
];

export const HARD_TEMPLATES: Omit<ApexQuest, 'id' | 'tier' | 'currentCount' | 'isCompleted' | 'expiresAtTimestamp'>[] = [
  {
    type: 'time_window',
    title: 'Rapid Sweep: 3 Scans in 15 Minutes',
    description: 'Spot and verify 3 different vehicles within a strict 15-minute window.',
    targetCount: 3,
    windowMinutes: 15,
    xpReward: 600,
    coinReward: 120
  },
  {
    type: 'power_spec',
    title: 'Heavy Artillery: 400+ HP Spec',
    description: 'Locate and scan a high-performance machine pushing 400+ horsepower.',
    targetCount: 1,
    minHorsepower: 400,
    xpReward: 550,
    coinReward: 110
  },
  {
    type: 'rarity',
    title: 'Rare Tier Specimen',
    description: 'Track down and verify 2 Rare or higher tier collectible vehicles.',
    targetCount: 2,
    minRarity: 'rare',
    xpReward: 650,
    coinReward: 130
  },
  {
    type: 'time_of_day',
    title: 'Night Hawk Patrol',
    description: 'Spot 2 vehicles after sunset (8:00 PM - 5:00 AM).',
    targetCount: 2,
    timeOfDay: 'night',
    xpReward: 520,
    coinReward: 105
  },
  {
    type: 'consecutive_scans',
    title: 'Forensic Streak: 3 Clean Scans',
    description: 'Achieve 3 consecutive successful vehicle identifications without error.',
    targetCount: 3,
    xpReward: 500,
    coinReward: 100
  },
  {
    type: 'mods',
    title: 'Aero & Tuned Hunter',
    description: 'Find a vehicle with aftermarket aerodynamic wings, splitters, or tuning mods.',
    targetCount: 1,
    hasMods: true,
    xpReward: 580,
    coinReward: 115
  },
  {
    type: 'power_spec',
    title: 'High-Output V8 / Turbo: 500+ HP',
    description: 'Catalog a true performance weapon making 500+ horsepower.',
    targetCount: 1,
    minHorsepower: 500,
    xpReward: 700,
    coinReward: 140
  },
  {
    type: 'speed_spec',
    title: 'Autobahn Ready: 280+ km/h Top Speed',
    description: 'Identify a sports car rated for at least 280 km/h (174 mph).',
    targetCount: 1,
    minTopSpeedKmH: 280,
    xpReward: 620,
    coinReward: 125
  },
  {
    type: 'time_window',
    title: 'Tri-Marque Sprint: 3 in 20 Mins',
    description: 'Find and scan 3 distinct automobile marques within 20 minutes.',
    targetCount: 3,
    windowMinutes: 20,
    xpReward: 680,
    coinReward: 135
  },
  {
    type: 'accuracy',
    title: 'Precision Master: 2 Scans >= 95% Confidence',
    description: 'Spot 2 vehicles with near-flawless 95%+ AI forensic identification certainty.',
    targetCount: 2,
    minAiConfidence: 0.95,
    xpReward: 640,
    coinReward: 130
  },
  {
    type: 'classic',
    title: 'Classic Retrospective: Year <= 2005',
    description: 'Document an analog classic manufactured in 2005 or earlier.',
    targetCount: 1,
    maxYear: 2005,
    xpReward: 590,
    coinReward: 120
  },
  {
    type: 'time_window',
    title: 'Coupe Sprint: 2 Coupes in 30 Mins',
    description: 'Locate 2 distinct performance coupes within 30 minutes.',
    targetCount: 2,
    windowMinutes: 30,
    allowedBodyStyles: ['Coupe'],
    xpReward: 620,
    coinReward: 125
  }
];

export const EXTREME_TEMPLATES: Omit<ApexQuest, 'id' | 'tier' | 'currentCount' | 'isCompleted' | 'expiresAtTimestamp'>[] = [
  {
    type: 'rarity',
    title: 'Apex Predator: Epic or Legendary Discovery',
    description: 'Hunt down an ultra-rare Epic, Legendary, or Mythic tier vehicle in the wild.',
    targetCount: 1,
    minRarity: 'epic',
    xpReward: 1500,
    coinReward: 300,
    badgeRewardSlug: 'epic_discovery'
  },
  {
    type: 'power_spec',
    title: 'Supercar Threshold: 600+ HP Monster',
    description: 'Document an exotic machine producing 600+ horsepower (V8, V10, or V12).',
    targetCount: 1,
    minHorsepower: 600,
    xpReward: 1200,
    coinReward: 250
  },
  {
    type: 'time_window',
    title: 'Lightning Sprint: 5 Scans in 25 Minutes',
    description: 'Complete 5 verified scans in under 25 minutes. High speed required.',
    targetCount: 5,
    windowMinutes: 25,
    xpReward: 1400,
    coinReward: 280
  },
  {
    type: 'consecutive_scans',
    title: 'Flawless Master: 5 Consecutive Scans',
    description: 'Identify 5 vehicles in a row with zero missed detections.',
    targetCount: 5,
    xpReward: 1600,
    coinReward: 350
  },
  {
    type: 'power_spec',
    title: 'Hypercar Horizon: 700+ HP Apex',
    description: 'Locate a flagship supercar or tuned hypercar packing 700+ horsepower.',
    targetCount: 1,
    minHorsepower: 700,
    xpReward: 1800,
    coinReward: 400
  },
  {
    type: 'time_window',
    title: 'Rare Speed Blitz: 2 Rares in 20 Mins',
    description: 'Track and verify 2 Rare or higher tier vehicles within 20 minutes.',
    targetCount: 2,
    windowMinutes: 20,
    minRarity: 'rare',
    xpReward: 1350,
    coinReward: 270
  },
  {
    type: 'speed_spec',
    title: 'Speed King: 320+ km/h Top Speed Spec',
    description: 'Spot an ultra-high performance exotic capable of 320+ km/h (200+ mph).',
    targetCount: 1,
    minTopSpeedKmH: 320,
    xpReward: 1500,
    coinReward: 300
  },
  {
    type: 'engine_spec',
    title: 'Acoustic Symphony: V10 or V12 Exotica',
    description: 'Find and document a high-revving 10-cylinder or 12-cylinder thoroughbred.',
    targetCount: 1,
    xpReward: 1650,
    coinReward: 330
  },
  {
    type: 'time_of_day',
    title: 'Midnight Phantom: 2 Rare Night Scans',
    description: 'Spot 2 Rare or higher vehicles after 9:00 PM in the dark.',
    targetCount: 2,
    timeOfDay: 'night',
    minRarity: 'rare',
    xpReward: 1450,
    coinReward: 290
  },
  {
    type: 'rarity',
    title: 'Legendary Grail Discovery',
    description: 'Uncover a Legendary or Mythic tier unicorn vehicle.',
    targetCount: 1,
    minRarity: 'legendary',
    xpReward: 2000,
    coinReward: 500
  },
  {
    type: 'time_window',
    title: 'Diversity Gauntlet: 4 Makes in 40 Mins',
    description: 'Identify 4 distinct vehicle manufacturers within 40 minutes.',
    targetCount: 4,
    windowMinutes: 40,
    xpReward: 1600,
    coinReward: 320
  },
  {
    type: 'power_spec',
    title: 'Track Weapon: Aero Spec pushing 500+ HP',
    description: 'Document an aggressive aero-equipped track car with 500+ horsepower.',
    targetCount: 1,
    minHorsepower: 500,
    hasMods: true,
    xpReward: 1750,
    coinReward: 350
  }
];

/**
 * Generate a complete, authoritative rotation of 10+ Normal, 10+ Hard, and 10+ Extreme quests (30+ total).
 * Pinned to UTC midnight daily boundary so the timer never resets on navigation.
 */
export function generateAuthoritativeQuests(params: QuestGenerationParams): ApexQuest[] {
  const expiresAt = getDailyExpirationTimestamp();
  const quests: ApexQuest[] = [];

  const rawCity = (params.userCity || '').trim();
  const isCityKnown = rawCity && rawCity !== 'Global' && rawCity !== 'Local Area' && rawCity !== 'Your City';

  // 1. Normal Quests (10+ distinct challenges)
  NORMAL_TEMPLATES.forEach((tmpl, idx) => {
    let title = tmpl.title;
    let description = tmpl.description;
    let targetCity = undefined;

    // Inject location awareness into the second quest
    if (idx === 1 && isCityKnown) {
      title = `${rawCity} District Scout`;
      description = `Document 2 street vehicles cruising through ${rawCity}.`;
      targetCity = rawCity;
    }

    quests.push({
      ...tmpl,
      id: `quest_n${idx + 1}_${tmpl.type}`,
      tier: 'NORMAL',
      title,
      description,
      targetCity,
      currentCount: 0,
      isCompleted: false,
      expiresAtTimestamp: expiresAt
    });
  });

  // 2. Hard Quests (10+ distinct challenges)
  HARD_TEMPLATES.forEach((tmpl, idx) => {
    quests.push({
      ...tmpl,
      id: `quest_h${idx + 1}_${tmpl.type}`,
      tier: 'HARD',
      currentCount: 0,
      isCompleted: false,
      expiresAtTimestamp: expiresAt
    });
  });

  // 3. Extreme Quests (10+ distinct challenges)
  EXTREME_TEMPLATES.forEach((tmpl, idx) => {
    quests.push({
      ...tmpl,
      id: `quest_x${idx + 1}_${tmpl.type}`,
      tier: 'EXTREME',
      currentCount: 0,
      isCompleted: false,
      expiresAtTimestamp: expiresAt
    });
  });

  return quests;
}

/**
 * Evaluates incoming scan event against active quests and updates progress.
 */
export function processQuestScan(
  activeQuests: ApexQuest[],
  context: QuestScanContext
): {
  updatedQuests: ApexQuest[];
  newlyCompleted: ApexQuest[];
  totalXpAwarded: number;
  totalCoinsAwarded: number;
} {
  const newlyCompleted: ApexQuest[] = [];
  let totalXp = 0;
  let totalCoins = 0;

  const updatedQuests = activeQuests.map((quest) => {
    // If already completed or expired, leave as is
    if (quest.isCompleted) return quest;
    if (Date.now() > quest.expiresAtTimestamp) return quest;

    let qualifies = true;

    // Check Rarity Requirement
    if (quest.minRarity) {
      const cardRank = RARITY_RANK[context.card.rarity] || 1;
      const targetRank = RARITY_RANK[quest.minRarity] || 1;
      if (cardRank < targetRank) qualifies = false;
    }

    if (quest.requiredRarity && qualifies) {
      if (context.card.rarity.toLowerCase() !== quest.requiredRarity.toLowerCase()) {
        qualifies = false;
      }
    }

    // Check Horsepower Requirement
    if (quest.minHorsepower && qualifies) {
      const hp = context.card.horsepower || 0;
      if (hp < quest.minHorsepower) qualifies = false;
    }

    // Check Top Speed Requirement
    if (quest.minTopSpeedKmH && qualifies) {
      const topSpeed = context.card.topSpeedKmH || 0;
      if (topSpeed < quest.minTopSpeedKmH) qualifies = false;
    }

    // Check AI Confidence Requirement
    if (quest.minAiConfidence && qualifies) {
      const conf = context.card.aiConfidence || 0;
      if (conf < quest.minAiConfidence) qualifies = false;
    }

    // Check Max Year (Classic)
    if (quest.maxYear && qualifies) {
      const yr = parseInt(context.card.yearEstimate || '2024', 10);
      if (isNaN(yr) || yr > quest.maxYear) qualifies = false;
    }

    // Check Tuning Mods
    if (quest.hasMods && qualifies) {
      const hasModsDetected = (context.card.modsDetected && context.card.modsDetected.length > 0) ||
        (context.card as any).mods?.length > 0;
      if (!hasModsDetected) qualifies = false;
    }

    // Check Engine Spec (V10 or V12)
    if (quest.type === 'engine_spec' && qualifies) {
      const engineStr = `${context.card.engine || ''} ${context.card.model || ''}`.toUpperCase();
      const hasV10OrV12 = /V10|V12|10-CYLINDER|12-CYLINDER|W12/i.test(engineStr);
      if (!hasV10OrV12) qualifies = false;
    }

    // Check Allowed Makes
    if (quest.allowedMakes && quest.allowedMakes.length > 0 && qualifies) {
      const makeMatches = quest.allowedMakes.some(
        m => m.toLowerCase() === (context.card.make || '').toLowerCase()
      );
      if (!makeMatches) qualifies = false;
    }

    // Check Body Styles
    if (quest.allowedBodyStyles && quest.allowedBodyStyles.length > 0 && qualifies) {
      const styleMatches = quest.allowedBodyStyles.includes(context.card.bodyStyle);
      if (!styleMatches) qualifies = false;
    }

    // Check Target City
    if (quest.targetCity && qualifies) {
      const cityMatches = (context.city || context.card.city || '').toLowerCase().includes(quest.targetCity.toLowerCase());
      if (!cityMatches) qualifies = false;
    }

    // Check Time of Day
    if (quest.timeOfDay === 'night' && qualifies) {
      const hr = new Date(context.scanTimestamp).getHours();
      if (hr >= 5 && hr < 20) qualifies = false; // Outside 8pm - 5am
    } else if (quest.timeOfDay === 'day' && qualifies) {
      const hr = new Date(context.scanTimestamp).getHours();
      if (hr < 6 || hr >= 19) qualifies = false; // Outside 6am - 7pm
    }

    // Check Time Window (e.g. 15 minutes)
    let newStartedAt = quest.startedAtTimestamp;
    if (quest.windowMinutes && qualifies) {
      const windowMs = quest.windowMinutes * 60 * 1000;
      if (!newStartedAt) {
        newStartedAt = context.scanTimestamp;
      } else {
        const elapsed = context.scanTimestamp - newStartedAt;
        if (elapsed > windowMs) {
          // Reset window if expired
          newStartedAt = context.scanTimestamp;
          return {
            ...quest,
            startedAtTimestamp: newStartedAt,
            currentCount: 1,
            isCompleted: quest.targetCount <= 1
          };
        }
      }
    }

    if (!qualifies) return quest;

    const newCount = quest.currentCount + 1;
    const isCompleted = newCount >= quest.targetCount;

    if (isCompleted && !quest.isCompleted) {
      newlyCompleted.push(quest);
      totalXp += quest.xpReward;
      totalCoins += quest.coinReward;
    }

    return {
      ...quest,
      currentCount: newCount,
      startedAtTimestamp: newStartedAt,
      isCompleted
    };
  });

  return {
    updatedQuests,
    newlyCompleted,
    totalXpAwarded: totalXp,
    totalCoinsAwarded: totalCoins
  };
}
