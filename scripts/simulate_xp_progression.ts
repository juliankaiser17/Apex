/**
 * APEX — XP Inflation & Level Progression Simulation Engine
 * 
 * Simulates player progression under:
 * 1. Current Economy (10 Levels, 20k XP cap, 2,470 XP/day quests)
 * 2. Proposed Rebalanced Economy (30-50 Levels, scaled quest rewards, smooth curve)
 */

import fs from 'fs';
import path from 'path';

// Current baseline constants from PostgreSQL calculate_level_from_xp and calculate_scan_xp
const CURRENT_LEVEL_THRESHOLDS = [
  0,      // Level 1
  500,    // Level 2
  1200,   // Level 3
  2200,   // Level 4
  3500,   // Level 5
  5200,   // Level 6
  7500,   // Level 7
  10500,  // Level 8
  14500,  // Level 9
  20000   // Level 10 (Max)
];

const SCAN_RARITY_WEIGHTS = [
  { tier: 'Common', prob: 0.50, xp: 50 },
  { tier: 'Uncommon', prob: 0.25, xp: 100 },
  { tier: 'Rare', prob: 0.15, xp: 200 },
  { tier: 'Epic', prob: 0.07, xp: 350 },
  { tier: 'Legendary', prob: 0.025, xp: 600 },
  { tier: 'Mythic', prob: 0.005, xp: 1000 }
];

const EXPECTED_XP_PER_SCAN = SCAN_RARITY_WEIGHTS.reduce((acc, curr) => acc + (curr.prob * curr.xp), 0); // 124.5 XP

// Current daily quests: Tier 1 (~310 XP), Tier 2 (~600 XP), Tier 3 (~1560 XP)
const CURRENT_DAILY_QUEST_TIER1_XP = 310;
const CURRENT_DAILY_QUEST_TIER2_XP = 600;
const CURRENT_DAILY_QUEST_TIER3_XP = 1560;

// Archetypes
interface Archetype {
  name: string;
  scansPerDay: number;
  questTier1Prob: number;
  questTier2Prob: number;
  questTier3Prob: number;
}

const ARCHETYPES: Archetype[] = [
  {
    name: 'Casual Player',
    scansPerDay: 1,
    questTier1Prob: 0.5,
    questTier2Prob: 0.1,
    questTier3Prob: 0.0
  },
  {
    name: 'Core Player',
    scansPerDay: 3,
    questTier1Prob: 1.0,
    questTier2Prob: 0.8,
    questTier3Prob: 0.2
  },
  {
    name: 'Hardcore Player',
    scansPerDay: 10,
    questTier1Prob: 1.0,
    questTier2Prob: 1.0,
    questTier3Prob: 0.9
  }
];

function simulateCurrentEconomy() {
  const results: any[] = [];

  for (const arch of ARCHETYPES) {
    const dailyScanXp = arch.scansPerDay * EXPECTED_XP_PER_SCAN;
    const dailyQuestXp = (arch.questTier1Prob * CURRENT_DAILY_QUEST_TIER1_XP) +
                         (arch.questTier2Prob * CURRENT_DAILY_QUEST_TIER2_XP) +
                         (arch.questTier3Prob * CURRENT_DAILY_QUEST_TIER3_XP);
    const totalDailyXp = dailyScanXp + dailyQuestXp;

    // Time to reach each level
    const levelDays: Record<number, number> = {};
    for (let lvl = 2; lvl <= 10; lvl++) {
      const xpNeeded = CURRENT_LEVEL_THRESHOLDS[lvl - 1];
      levelDays[lvl] = parseFloat((xpNeeded / totalDailyXp).toFixed(1));
    }

    results.push({
      archetype: arch.name,
      dailyScanXp: Math.round(dailyScanXp),
      dailyQuestXp: Math.round(dailyQuestXp),
      totalDailyXp: Math.round(totalDailyXp),
      daysToLevel5: levelDays[5],
      daysToLevel10Max: levelDays[10]
    });
  }

  return results;
}

// Proposed 30-Level Rebalanced Curve
// Formula: Cumulative XP for Level L = Math.round(350 * Math.pow(L - 1, 1.85))
function calculateProposedLevelThresholds(maxLevel = 30): number[] {
  const thresholds = [0];
  for (let l = 2; l <= maxLevel; l++) {
    const xp = Math.round(350 * Math.pow(l - 1, 1.85));
    thresholds.push(xp);
  }
  return thresholds;
}

const PROPOSED_LEVEL_THRESHOLDS = calculateProposedLevelThresholds(30);

// Proposed Rebalanced Quests: Tier 1: 50 XP, Tier 2: 140 XP, Tier 3: 350 XP
const PROPOSED_QUEST_TIER1_XP = 50;
const PROPOSED_QUEST_TIER2_XP = 140;
const PROPOSED_QUEST_TIER3_XP = 350;

function simulateProposedEconomy() {
  const results: any[] = [];

  for (const arch of ARCHETYPES) {
    const dailyScanXp = arch.scansPerDay * EXPECTED_XP_PER_SCAN;
    const dailyQuestXp = (arch.questTier1Prob * PROPOSED_QUEST_TIER1_XP) +
                         (arch.questTier2Prob * PROPOSED_QUEST_TIER2_XP) +
                         (arch.questTier3Prob * PROPOSED_QUEST_TIER3_XP);
    const totalDailyXp = dailyScanXp + dailyQuestXp;

    const daysToLvl10 = parseFloat((PROPOSED_LEVEL_THRESHOLDS[9] / totalDailyXp).toFixed(1));
    const daysToLvl20 = parseFloat((PROPOSED_LEVEL_THRESHOLDS[19] / totalDailyXp).toFixed(1));
    const daysToLvl30 = parseFloat((PROPOSED_LEVEL_THRESHOLDS[29] / totalDailyXp).toFixed(1));

    results.push({
      archetype: arch.name,
      dailyScanXp: Math.round(dailyScanXp),
      dailyQuestXp: Math.round(dailyQuestXp),
      totalDailyXp: Math.round(totalDailyXp),
      daysToLevel10: daysToLvl10,
      daysToLevel20: daysToLvl20,
      daysToLevel30Max: daysToLvl30
    });
  }

  return results;
}

const currentSim = simulateCurrentEconomy();
const proposedSim = simulateProposedEconomy();

console.log('=== CURRENT ECONOMY PROGRESSION SIMULATION ===');
console.table(currentSim);

console.log('\n=== PROPOSED REBALANCED PROGRESSION SIMULATION (30 Levels) ===');
console.table(proposedSim);

const exportData = {
  timestamp: new Date().toISOString(),
  expectedXpPerScan: EXPECTED_XP_PER_SCAN,
  currentEconomy: {
    maxLevel: 10,
    thresholds: CURRENT_LEVEL_THRESHOLDS,
    simulations: currentSim
  },
  proposedEconomy: {
    maxLevel: 30,
    thresholds: PROPOSED_LEVEL_THRESHOLDS,
    simulations: proposedSim
  }
};

const outPath = path.resolve(process.cwd(), 'scratch/xp_simulation_results.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));
console.log(`\nSimulation results exported to ${outPath}`);
