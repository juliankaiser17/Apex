/**
 * APEX — Authoritative Daily Streak Calculation Engine
 * 
 * Single source of truth for daily spotting streak state, claim eligibility,
 * day numbering, and reward derivation.
 * 
 * Rules:
 * 1. Claims are bounded by calendar day (resilient to both local and UTC boundaries).
 * 2. If claimed today -> isClaimedToday = true, canClaim = false, targetStreak = currentStreak.
 * 3. If claimed yesterday (diffDays === 1) -> isClaimedToday = false, canClaim = true, targetStreak = currentStreak + 1.
 * 4. If never claimed or missed > 1 day -> isClaimedToday = false, canClaim = true, targetStreak = 1 (reset).
 * 5. Display day is 1..7 (cyclic every 7 days).
 */

export interface StreakReward {
  day: number;
  xp: number;
  coins: number;
  label: string;
  isMystery?: boolean;
}

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, xp: 100, coins: 25, label: 'Day 1' },
  { day: 2, xp: 200, coins: 50, label: 'Day 2' },
  { day: 3, xp: 350, coins: 75, label: 'Day 3' },
  { day: 4, xp: 500, coins: 100, label: 'Day 4' },
  { day: 5, xp: 750, coins: 150, label: 'Day 5' },
  { day: 6, xp: 1000, coins: 200, label: 'Day 6' },
  { day: 7, xp: 2500, coins: 500, label: 'Day 7', isMystery: true },
];

export interface AuthoritativeStreakInfo {
  currentStreak: number;       // Current verified streak in database/profile
  targetStreak: number;        // Streak day achieved if claimed today (or current if already claimed)
  displayDayNumber: number;    // Cyclic day number 1..7
  activeTrackIndex: number;    // 0-indexed position in 7-day reward track (0..6)
  isClaimedToday: boolean;     // Whether user already claimed for current date
  canClaim: boolean;           // Whether user can claim right now
  reward: StreakReward;        // Exact reward for targetStreak
  diffDays: number;            // Difference in calendar days between now and last claim
}

export function getAuthoritativeStreak(
  streakDays: number = 0,
  streakLastAt: string | null = null,
  now: Date = new Date()
): AuthoritativeStreakInfo {
  const currentStreak = Math.max(0, streakDays || 0);
  const lastClaim = streakLastAt ? new Date(streakLastAt) : null;

  let isClaimedToday = false;
  let diffDays = 999;

  if (lastClaim && !isNaN(lastClaim.getTime()) && currentStreak > 0) {
    // Check both local date and UTC date to prevent timezone shift false negatives
    const isSameLocalDate = 
      now.getFullYear() === lastClaim.getFullYear() &&
      now.getMonth() === lastClaim.getMonth() &&
      now.getDate() === lastClaim.getDate();

    const isSameUtcDate = 
      now.getUTCFullYear() === lastClaim.getUTCFullYear() &&
      now.getUTCMonth() === lastClaim.getUTCMonth() &&
      now.getUTCDate() === lastClaim.getUTCDate();

    if (isSameLocalDate || isSameUtcDate) {
      isClaimedToday = true;
      diffDays = 0;
    } else {
      // Calculate calendar midnight difference
      const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const midnightLast = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate()).getTime();
      diffDays = Math.round((midnightNow - midnightLast) / (1000 * 60 * 60 * 24));
      
      // If negative diff (clock skew), treat as claimed today
      if (diffDays <= 0) {
        isClaimedToday = true;
        diffDays = 0;
      }
    }
  }

  // Derive target streak
  let targetStreak = 1;
  if (isClaimedToday) {
    targetStreak = Math.max(1, currentStreak);
  } else if (lastClaim && currentStreak > 0) {
    if (diffDays === 1) {
      // Claimed yesterday -> eligible for next day in streak
      targetStreak = currentStreak + 1;
    } else {
      // Missed more than 1 day -> reset to Day 1
      targetStreak = 1;
    }
  } else {
    // First claim ever
    targetStreak = 1;
  }

  // 7-day cyclic track calculations
  // Day 1 -> index 0, Day 2 -> index 1 ... Day 7 -> index 6, Day 8 -> index 0 (Day 1 of next cycle)
  const activeTrackIndex = Math.max(0, Math.min(6, (targetStreak - 1) % 7));
  const displayDayNumber = activeTrackIndex + 1;
  const reward = STREAK_REWARDS[activeTrackIndex] || STREAK_REWARDS[0];

  return {
    currentStreak,
    targetStreak,
    displayDayNumber,
    activeTrackIndex,
    isClaimedToday,
    canClaim: !isClaimedToday,
    reward,
    diffDays
  };
}
