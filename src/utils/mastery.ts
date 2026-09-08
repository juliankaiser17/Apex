import type { RarityTier, UserProfile } from '../types/apex';

export type MasteryTier = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface MasteryTierConfig {
  tier: MasteryTier;
  label: string;
  minLevel: number;
  maxLevel: number;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  glowColor: string;
  description: string;
}

export const MASTERY_TIERS: Record<MasteryTier, MasteryTierConfig> = {
  BEGINNER: {
    tier: 'BEGINNER',
    label: 'BEGINNER',
    minLevel: 1,
    maxLevel: 10,
    badgeBg: 'bg-zinc-800/80',
    badgeBorder: 'border-zinc-700/80',
    textColor: 'text-zinc-300',
    glowColor: 'shadow-zinc-900/50',
    description: 'Onboarding & learning the essentials of vehicle identification.'
  },
  INTERMEDIATE: {
    tier: 'INTERMEDIATE',
    label: 'INTERMEDIATE',
    minLevel: 11,
    maxLevel: 30,
    badgeBg: 'bg-blue-950/40',
    badgeBorder: 'border-blue-500/40',
    textColor: 'text-blue-400',
    glowColor: 'shadow-blue-950/50',
    description: 'Regular spotting progression and active city exploration.'
  },
  ADVANCED: {
    tier: 'ADVANCED',
    label: 'ADVANCED',
    minLevel: 31,
    maxLevel: 60,
    badgeBg: 'bg-amber-950/40',
    badgeBorder: 'border-amber-500/40',
    textColor: 'text-amber-400',
    glowColor: 'shadow-amber-950/50',
    description: 'Serious commitment, rare vehicle hunting, and high accuracy.'
  },
  EXPERT: {
    tier: 'EXPERT',
    label: 'EXPERT',
    minLevel: 61,
    maxLevel: 100,
    badgeBg: 'bg-red-950/40',
    badgeBorder: 'border-red-500/50',
    textColor: 'text-red-500',
    glowColor: 'shadow-red-950/60',
    description: 'Prestigious long-term mastery, legendary collector and spotter.'
  }
};

/**
 * Exact XP Required to advance from Level L to Level L + 1
 * Formula: ROUND(250 + 45 * L^1.55)
 */
export function getXPRequired(level: number): number {
  if (level >= 100) return 56026; // Level 100 is max standard level
  const l = Math.max(1, Math.floor(level));
  return Math.round(250 + 45 * Math.pow(l, 1.55));
}

/**
 * Returns Mastery Tier corresponding to current level (1–100)
 */
export function getMasteryTier(level: number): MasteryTier {
  const l = Math.max(1, Math.min(100, Math.floor(level || 1)));
  if (l <= 10) return 'BEGINNER';
  if (l <= 30) return 'INTERMEDIATE';
  if (l <= 60) return 'ADVANCED';
  return 'EXPERT';
}

export function getMasteryTierConfig(level: number): MasteryTierConfig {
  const tier = getMasteryTier(level);
  return MASTERY_TIERS[tier];
}

/**
 * Returns current level progress statistics
 */
export function getProgressToNextLevel(level: number, currentXp: number): {
  level: number;
  tier: MasteryTier;
  tierConfig: MasteryTierConfig;
  currentXp: number;
  requiredXp: number;
  percentage: number;
  isMaxLevel: boolean;
} {
  const safeLevel = Math.max(1, Math.min(100, Math.floor(level || 1)));
  const isMaxLevel = safeLevel >= 100;
  const requiredXp = getXPRequired(safeLevel);
  const safeCurrentXp = isMaxLevel ? requiredXp : Math.max(0, Math.min(requiredXp, Math.floor(currentXp || 0)));
  const percentage = isMaxLevel ? 100 : Math.min(100, Math.max(0, Math.round((safeCurrentXp / requiredXp) * 100)));
  const tier = getMasteryTier(safeLevel);

  return {
    level: safeLevel,
    tier,
    tierConfig: MASTERY_TIERS[tier],
    currentXp: safeCurrentXp,
    requiredXp,
    percentage,
    isMaxLevel
  };
}

// ─── BASE RARITY DISCOVERY XP ───
export const BASE_RARITY_XP: Record<RarityTier, number> = {
  common: 10,
  uncommon: 20,
  rare: 40,
  epic: 80,
  legendary: 160,
  mythic: 300
};

// ─── RARITY DISCOVERY BONUS ───
export const RARITY_BONUS_XP: Record<RarityTier, number> = {
  common: 0,
  uncommon: 0,
  rare: 10,
  epic: 25,
  legendary: 50,
  mythic: 100
};

export interface DiscoveryXpInput {
  rarity: RarityTier;
  isFirstEverDiscovery: boolean; // First time this user ever spotted this model
  previousSpotsOfModel: number; // 0 for 1st, 1 for 2nd, >=2 for 3rd+
  identificationQuality?: {
    hasMake?: boolean;
    hasModel?: boolean;
    hasGeneration?: boolean;
    hasYearRange?: boolean;
    hasTrim?: boolean;
  };
  context?: {
    isNewLocation?: boolean;
    isNight?: boolean;
    isEvent?: boolean;
    isSpecialVehicle?: boolean;
  };
  currentDailyXp?: number;
}

export interface DiscoveryXpBreakdown {
  baseXp: number;
  firstTimeBonusXp: number;
  duplicateMultiplier: number;
  identificationXp: number;
  rarityBonusXp: number;
  contextBonusXp: number;
  rawTotalXp: number;
  efficiencyMultiplier: number;
  finalAwardedXp: number;
  breakdownReasons: string[];
}

/**
 * Calculates accurate Discovery XP with first-time bonuses, duplicate decay,
 * verified identification, rarity bonuses, and soft daily caps.
 */
export function calculateDiscoveryXp(input: DiscoveryXpInput): DiscoveryXpBreakdown {
  const {
    rarity,
    isFirstEverDiscovery,
    previousSpotsOfModel = 0,
    identificationQuality = {},
    context = {},
    currentDailyXp = 0
  } = input;

  const base = BASE_RARITY_XP[rarity] || 10;
  const reasons: string[] = [`${rarity.toUpperCase()} Discovery (+${base} XP)`];

  // 1. Duplicate decay & First-Time Discovery Bonus
  let duplicateMultiplier = 1.0;
  let firstTimeBonusXp = 0;

  if (isFirstEverDiscovery || previousSpotsOfModel === 0) {
    firstTimeBonusXp = base; // +100% bonus
    reasons.push(`First Discovery (+${firstTimeBonusXp} XP)`);
  } else if (previousSpotsOfModel === 1) {
    duplicateMultiplier = 0.25; // 2nd spot: 25%
  } else {
    duplicateMultiplier = 0.10; // 3rd+ spot: 10%
  }

  const effectiveBaseXp = Math.round(base * duplicateMultiplier);

  // 2. Identification Quality Bonus
  let identificationXp = 0;
  if (identificationQuality.hasMake) { identificationXp += 5; }
  if (identificationQuality.hasModel) { identificationXp += 10; }
  if (identificationQuality.hasGeneration) { identificationXp += 10; }
  if (identificationQuality.hasYearRange) { identificationXp += 10; }
  if (identificationQuality.hasTrim) { identificationXp += 15; }

  if (identificationXp > 0) {
    reasons.push(`Verified Identification (+${identificationXp} XP)`);
  }

  // 3. Rarity Discovery Bonus
  const rarityBonusXp = RARITY_BONUS_XP[rarity] || 0;
  if (rarityBonusXp > 0) {
    reasons.push(`Rarity Bonus (+${rarityBonusXp} XP)`);
  }

  // 4. Location / Context Bonus
  let contextBonusXp = 0;
  if (context.isNewLocation) contextBonusXp += 10;
  if (context.isNight) contextBonusXp += 5;
  if (context.isEvent) contextBonusXp += 15;
  if (context.isSpecialVehicle) contextBonusXp += 25;

  if (contextBonusXp > 0) {
    reasons.push(`Context Bonus (+${contextBonusXp} XP)`);
  }

  // Raw Total before daily soft cap
  const rawTotalXp = effectiveBaseXp + firstTimeBonusXp + identificationXp + rarityBonusXp + contextBonusXp;

  // 5. Soft Daily Cap Efficiency
  // 0–1000 XP: 100%, 1000–1500 XP: 50%, 1500–2000 XP: 25%, 2000+ XP: 10%
  let efficiencyMultiplier = 1.0;
  if (currentDailyXp >= 2000) {
    efficiencyMultiplier = 0.10;
  } else if (currentDailyXp >= 1500) {
    efficiencyMultiplier = 0.25;
  } else if (currentDailyXp >= 1000) {
    efficiencyMultiplier = 0.50;
  }

  const finalAwardedXp = Math.max(5, Math.round(rawTotalXp * efficiencyMultiplier));

  return {
    baseXp: effectiveBaseXp,
    firstTimeBonusXp,
    duplicateMultiplier,
    identificationXp,
    rarityBonusXp,
    contextBonusXp,
    rawTotalXp,
    efficiencyMultiplier,
    finalAwardedXp,
    breakdownReasons: reasons
  };
}

/**
 * Streak milestone bonus rewards
 */
export function getStreakMilestoneBonus(streakDays: number): number {
  if (streakDays === 30) return 300;
  if (streakDays === 14) return 150;
  if (streakDays === 7) return 75;
  if (streakDays === 3) return 25;
  return 0;
}

/**
 * Centralized XP Processor:
 * Applies XP gain, calculates sequential level-ups, carries over leftover XP,
 * and updates user profile state without skips or glitches.
 */
export function processXpGain(
  user: UserProfile,
  amount: number,
  _reason?: string
): {
  updatedUser: UserProfile;
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
  newLevel: number;
  oldTier: MasteryTier;
  newTier: MasteryTier;
  tierChanged: boolean;
  awardedXp: number;
} {
  const safeAmount = Math.max(0, Math.floor(amount || 0));
  let currentLevel = Math.max(1, Math.min(100, Math.floor(user.level || 1)));
  let currentXp = Math.max(0, Math.floor(user.xp || 0)) + safeAmount;

  const oldLevel = currentLevel;
  const oldTier = getMasteryTier(oldLevel);
  let levelsGained = 0;

  // Sequentially process level ups
  while (currentLevel < 100) {
    const needed = getXPRequired(currentLevel);
    if (currentXp >= needed) {
      currentXp -= needed;
      currentLevel += 1;
      levelsGained += 1;
    } else {
      break;
    }
  }

  // At Level 100, cap level and keep XP bounded
  if (currentLevel >= 100) {
    currentLevel = 100;
    const maxReq = getXPRequired(100);
    if (currentXp > maxReq) {
      currentXp = maxReq;
    }
  }

  const newTier = getMasteryTier(currentLevel);
  const leveledUp = levelsGained > 0;
  const tierChanged = oldTier !== newTier;

  const updatedUser: UserProfile = {
    ...user,
    level: currentLevel,
    xp: currentXp
  };

  return {
    updatedUser,
    leveledUp,
    levelsGained,
    oldLevel,
    newLevel: currentLevel,
    oldTier,
    newTier,
    tierChanged,
    awardedXp: safeAmount
  };
}
