import type { RarityTier } from '../types/apex';

export const RARITY_CONFIG: Record<RarityTier, {
  label: string;
  color: string;
  glow: string;
  borderClass: string;
  bgGradient: string;
  badgeBg: string;
  xpBase: number;
}> = {
  common: {
    label: 'Common',
    color: '#8E8E93',
    glow: 'none',
    borderClass: 'border-white/10',
    bgGradient: 'from-[#141414] to-[#0A0A0A]',
    badgeBg: 'bg-white/10 text-white/70 border-white/10',
    xpBase: 50
  },
  uncommon: {
    label: 'Uncommon',
    color: '#A1A1AA',
    glow: 'none',
    borderClass: 'border-white/15',
    bgGradient: 'from-[#161616] to-[#0A0A0A]',
    badgeBg: 'bg-white/10 text-white/80 border-white/15',
    xpBase: 100
  },
  rare: {
    label: 'Rare',
    color: '#E4E4E7',
    glow: 'none',
    borderClass: 'border-white/20',
    bgGradient: 'from-[#181818] to-[#0A0A0A]',
    badgeBg: 'bg-white/15 text-white border-white/20',
    xpBase: 200
  },
  epic: {
    label: 'Epic',
    color: '#F87171',
    glow: 'none',
    borderClass: 'border-red-500/30',
    bgGradient: 'from-[#1C1212] to-[#0A0A0A]',
    badgeBg: 'bg-red-500/15 text-red-300 border-red-500/30',
    xpBase: 400
  },
  legendary: {
    label: 'Legendary',
    color: '#EF4444',
    glow: 'none',
    borderClass: 'border-red-500/40',
    bgGradient: 'from-[#201010] to-[#0A0A0A]',
    badgeBg: 'bg-red-500/20 text-red-400 border-red-500/40',
    xpBase: 750
  },
  mythic: {
    label: 'Mythic',
    color: '#DC2626',
    glow: 'none',
    borderClass: 'border-red-600/50',
    bgGradient: 'from-[#240C0C] to-[#0A0A0A]',
    badgeBg: 'bg-red-600/25 text-red-500 border-red-600/50',
    xpBase: 1500
  }
};

export function calculateScanXp(rarity: RarityTier, isFirstGlobal: boolean = true, isFirstCity: boolean = false): number {
  const base = RARITY_CONFIG[rarity]?.xpBase || 100;
  let xp = base;
  if (isFirstGlobal) xp += 300;
  else if (isFirstCity) xp += 150;
  return xp;
}

export function getRarityFromScore(score: number): RarityTier {
  if (score < 20) return 'common';
  if (score < 40) return 'uncommon';
  if (score < 60) return 'rare';
  if (score < 75) return 'epic';
  if (score < 90) return 'legendary';
  return 'mythic';
}

import { getProgressToNextLevel, getXPRequired } from './mastery';

export function calculateXpForLevel(level: number): number {
  return getXPRequired(level);
}

export function getLevelFromXp(xp: number, userLevel: number = 1): { level: number; currentXp: number; nextLevelXp: number; progressPercent: number } {
  const p = getProgressToNextLevel(userLevel, xp);
  return {
    level: p.level,
    currentXp: p.currentXp,
    nextLevelXp: p.requiredXp,
    progressPercent: p.percentage
  };
}
