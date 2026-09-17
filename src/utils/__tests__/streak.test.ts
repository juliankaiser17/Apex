import { getAuthoritativeStreak } from '../streak';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

export function runStreakTests() {
  console.log('\n=== RUNNING AUTHORITATIVE STREAK ENGINE TESTS ===\n');

  const now = new Date('2026-09-06T12:00:00Z');

  // 1. First-ever claim (streakDays = 0, streakLastAt = null)
  {
    const res = getAuthoritativeStreak(0, null, now);
    assert(res.currentStreak === 0, 'First-ever claim: currentStreak is 0');
    assert(res.targetStreak === 1, 'First-ever claim: targetStreak is 1');
    assert(res.displayDayNumber === 1, 'First-ever claim: displayDayNumber is 1');
    assert(res.activeTrackIndex === 0, 'First-ever claim: activeTrackIndex is 0');
    assert(res.isClaimedToday === false, 'First-ever claim: isClaimedToday is false');
    assert(res.canClaim === true, 'First-ever claim: canClaim is true');
    assert(res.reward.xp === 100 && res.reward.coins === 25, 'First-ever claim: awards Day 1 reward (100 XP, 25 coins)');
  }

  // 2. Yesterday claimed (Day 1 was yesterday -> Day 2 available today)
  {
    const yesterday = new Date('2026-09-05T14:30:00Z');
    const res = getAuthoritativeStreak(1, yesterday.toISOString(), now);
    assert(res.currentStreak === 1, 'Yesterday claimed: currentStreak is 1');
    assert(res.targetStreak === 2, 'Yesterday claimed: targetStreak advances to 2');
    assert(res.displayDayNumber === 2, 'Yesterday claimed: displayDayNumber is 2 (FIXES Day 1 bug!)');
    assert(res.activeTrackIndex === 1, 'Yesterday claimed: activeTrackIndex is 1');
    assert(res.isClaimedToday === false, 'Yesterday claimed: isClaimedToday is false');
    assert(res.canClaim === true, 'Yesterday claimed: canClaim is true');
    assert(res.reward.xp === 200 && res.reward.coins === 50, 'Yesterday claimed: awards Day 2 reward (200 XP, 50 coins)');
  }

  // 3. Today already claimed (Day 2 claimed today)
  {
    const todayMorning = new Date('2026-09-06T08:15:00Z');
    const res = getAuthoritativeStreak(2, todayMorning.toISOString(), now);
    assert(res.currentStreak === 2, 'Today already claimed: currentStreak is 2');
    assert(res.targetStreak === 2, 'Today already claimed: targetStreak remains 2');
    assert(res.displayDayNumber === 2, 'Today already claimed: displayDayNumber is 2');
    assert(res.activeTrackIndex === 1, 'Today already claimed: activeTrackIndex is 1');
    assert(res.isClaimedToday === true, 'Today already claimed: isClaimedToday is true');
    assert(res.canClaim === false, 'Today already claimed: cannot claim again');
  }

  // 4. Missed > 1 day (streak was 5, last claim was 3 days ago -> resets to Day 1)
  {
    const threeDaysAgo = new Date('2026-09-03T10:00:00Z');
    const res = getAuthoritativeStreak(5, threeDaysAgo.toISOString(), now);
    assert(res.currentStreak === 5, 'Missed days: currentStreak was 5');
    assert(res.targetStreak === 1, 'Missed days: targetStreak resets to 1');
    assert(res.displayDayNumber === 1, 'Missed days: displayDayNumber resets to 1');
    assert(res.activeTrackIndex === 0, 'Missed days: activeTrackIndex resets to 0');
    assert(res.isClaimedToday === false, 'Missed days: isClaimedToday is false');
    assert(res.canClaim === true, 'Missed days: canClaim is true');
    assert(res.reward.xp === 100, 'Missed days: awards Day 1 reward');
  }

  // 5. Day 7 -> Next cycle Day 1 (Day 7 claimed yesterday -> Day 8 targetStreak loops to Day 1 display)
  {
    const yesterday = new Date('2026-09-05T18:00:00Z');
    const res = getAuthoritativeStreak(7, yesterday.toISOString(), now);
    assert(res.currentStreak === 7, 'Day 7 -> 8: currentStreak is 7');
    assert(res.targetStreak === 8, 'Day 7 -> 8: targetStreak is 8');
    assert(res.displayDayNumber === 1, 'Day 7 -> 8: displayDayNumber loops back to 1');
    assert(res.activeTrackIndex === 0, 'Day 7 -> 8: activeTrackIndex is 0');
    assert(res.isClaimedToday === false, 'Day 7 -> 8: isClaimedToday is false');
    assert(res.canClaim === true, 'Day 7 -> 8: canClaim is true');
    assert(res.reward.xp === 100, 'Day 7 -> 8: awards Day 1 reward of new cycle');
  }

  // 6. Day 6 claimed yesterday -> Day 7 Mythic Crate available today
  {
    const yesterday = new Date('2026-09-05T18:00:00Z');
    const res = getAuthoritativeStreak(6, yesterday.toISOString(), now);
    assert(res.targetStreak === 7, 'Day 6 -> 7: targetStreak is 7');
    assert(res.displayDayNumber === 7, 'Day 6 -> 7: displayDayNumber is 7');
    assert(res.activeTrackIndex === 6, 'Day 6 -> 7: activeTrackIndex is 6');
    assert(res.reward.isMystery === true, 'Day 6 -> 7: reward is Mystery Mythic Crate');
    assert(res.reward.xp === 2500, 'Day 6 -> 7: awards 2500 XP');
  }

  // 7. Missed 1 day (diffDays === 2) with Streak Freeze Active -> streak preserved!
  {
    const twoDaysAgo = new Date('2026-09-04T12:00:00Z');
    // Without freeze: resets to 1
    const resNoFreeze = getAuthoritativeStreak(4, twoDaysAgo.toISOString(), now, { hasStreakFreeze: false });
    assert(resNoFreeze.targetStreak === 1, 'Missed day without freeze: targetStreak resets to 1');
    assert(resNoFreeze.streakFreezeUsed === false, 'Streak freeze was not used');

    // With freeze: preserves streak and consumes freeze
    const resWithFreeze = getAuthoritativeStreak(4, twoDaysAgo.toISOString(), now, { hasStreakFreeze: true });
    assert(resWithFreeze.targetStreak === 5, 'Missed day with freeze: targetStreak preserves to 5');
    assert(resWithFreeze.streakFreezeUsed === true, 'Streak freeze was consumed');
  }

  console.log('\n=== ALL STREAK TESTS PASSED SUCCESSFULLY ===\n');
}

runStreakTests();
