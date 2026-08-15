/**
 * APEX V3 "ASPHALT" — Animation Physics Constants
 * 
 * Centralized spring configs for Framer Motion.
 * Reference: Pokémon GO weight + Duolingo feedback + Racing game rewards
 */

// ─── SPRING CONFIGS ───
// Heavy Drop — cards materialising, celebration screens
export const SPRING_HEAVY = { type: 'spring' as const, damping: 18, stiffness: 90, mass: 1.4 };

// Snappy Pop — badges unlocking, XP gain, correct answers
export const SPRING_POP = { type: 'spring' as const, damping: 10, stiffness: 280, mass: 0.8 };

// Natural Settle — bottom sheets, tooltips
export const SPRING_SETTLE = { type: 'spring' as const, damping: 22, stiffness: 200, mass: 1.0 };

// Jelly — streak counter, daily mission completion
export const SPRING_JELLY = { type: 'spring' as const, damping: 7, stiffness: 350, mass: 0.7 };

// ─── TIMING CURVES ───
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ─── GLOW SYSTEM ───
export const GLOW_ORANGE = '0 0 0 1px rgba(255,69,0,0.12), 0 0 16px rgba(255,69,0,0.2), 0 0 40px rgba(255,69,0,0.09)';
export const GLOW_GOLD = '0 0 0 1px rgba(255,165,0,0.19), 0 0 20px rgba(255,165,0,0.25), 0 0 48px rgba(255,165,0,0.12)';
export const GLOW_FIRE = '0 0 0 1px rgba(255,34,0,0.19), 0 0 24px rgba(255,34,0,0.31), 0 0 60px rgba(255,34,0,0.15)';

// ─── RARITY GLOW MAP ───
export const RARITY_GLOW: Record<string, string> = {
  common: 'none',
  uncommon: '0 0 12px rgba(61,170,106,0.2)',
  rare: '0 0 16px rgba(232,160,32,0.25)',
  epic: '0 0 20px rgba(200,80,0,0.3)',
  legendary: GLOW_GOLD,
  mythic: GLOW_FIRE,
};
