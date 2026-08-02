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
    label: 'COMMON',
    color: '#787878',
    glow: '0 0 12px rgba(120, 120, 120, 0.3)',
    borderClass: 'border-[#787878]/50',
    bgGradient: 'from-[#1A1A1A] to-[#111111]',
    badgeBg: 'bg-[#2C2C2C] text-[#9A9088] border-[#383838]',
    xpBase: 50
  },
  uncommon: {
    label: 'UNCOMMON',
    color: '#3DAA6A',
    glow: '0 0 16px rgba(61, 170, 106, 0.4)',
    borderClass: 'border-[#3DAA6A]/60',
    bgGradient: 'from-[#0A1F12] to-[#111111]',
    badgeBg: 'bg-[#0A1F12] text-[#3DAA6A] border-[#3DAA6A]/40',
    xpBase: 100
  },
  rare: {
    label: 'RARE',
    color: '#E8A020',
    glow: '0 0 20px rgba(232, 160, 32, 0.5)',
    borderClass: 'border-[#E8A020]/60',
    bgGradient: 'from-[#1F1508] to-[#111111]',
    badgeBg: 'bg-[#1F1508] text-[#E8A020] border-[#E8A020]/40',
    xpBase: 200
  },
  epic: {
    label: 'EPIC',
    color: '#C85000',
    glow: '0 0 24px rgba(200, 80, 0, 0.6)',
    borderClass: 'border-[#C85000]/60',
    bgGradient: 'from-[#1F0E00] to-[#111111]',
    badgeBg: 'bg-[#1F0E00] text-[#FF6A00] border-[#C85000]/50',
    xpBase: 400
  },
  legendary: {
    label: 'LEGENDARY',
    color: '#FFA500',
    glow: '0 0 0 1px rgba(255,165,0,0.18), 0 0 20px rgba(255,165,0,0.25), 0 0 48px rgba(255,165,0,0.12)',
    borderClass: 'border-[#FFA500]/70',
    bgGradient: 'from-[#1F1500] to-[#111111]',
    badgeBg: 'bg-[#1F1500] text-[#FFA500] border-[#FFA500]/50',
    xpBase: 750
  },
  mythic: {
    label: 'MYTHIC',
    color: '#FF2200',
    glow: '0 0 0 1px rgba(255,34,0,0.18), 0 0 24px rgba(255,34,0,0.3), 0 0 60px rgba(255,34,0,0.15)',
    borderClass: 'border-[#FF2200]/70',
    bgGradient: 'from-[#1F0500] to-[#111111]',
    badgeBg: 'bg-[#1F0500] text-[#FF2200] border-[#FF2200]/60',
    xpBase: 1500
  }
};

export function getRarityFromScore(score: number): RarityTier {
  if (score < 20) return 'common';
  if (score < 40) return 'uncommon';
  if (score < 60) return 'rare';
  if (score < 75) return 'epic';
  if (score < 90) return 'legendary';
  return 'mythic';
}

export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round((200 * Math.pow(level, 1.8)) / 50) * 50;
}

export function getLevelFromXp(xp: number): { level: number; currentXp: number; nextLevelXp: number; progressPercent: number } {
  let level = 1;
  while (calculateXpForLevel(level + 1) <= xp && level < 50) {
    level++;
  }
  const currentLevelXp = calculateXpForLevel(level);
  const nextLevelXp = calculateXpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForNext) * 100)));

  return {
    level,
    currentXp: xp,
    nextLevelXp,
    progressPercent
  };
}

export function calculateScanXp(rarity: RarityTier, isFirstGlobal: boolean = false, isFirstCity: boolean = false): number {
  let xp = RARITY_CONFIG[rarity].xpBase;
  if (isFirstGlobal) xp += 500;
  if (isFirstCity) xp += 250;
  return xp;
}
