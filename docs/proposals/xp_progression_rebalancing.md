# Lane 2 Proposal: XP Progression & Quest Economy Rebalancing

**Target File / Component**: `supabase/migrations/` (`calculate_level_from_xp`), `src/utils/questEngine.ts`  
**Classification**: Lane 2 (Economy Ledger, Progression Curve, Database RPCs)  
**Status**: Proposal for Owner Review (Gate G3)  
**Simulation Source**: `scratch/xp_simulation_results.json`  
**Simulation SHA-256**: `DC4F150766C58459B7B96EC3117E50D8489997941B4BD5076C58CBEC50B2D94F`

---

## 1. Cost Transparency Statement (Mandatory Blast Radius Guardrail)

> **"One user action can cause at most 1 database RPC operation (`record_car_scan`), consuming 0 external API calls."**
> - **Expected operation count**: 1 SQL transaction updating user XP, level, and writing to `economy_ledger`.
> - **Worst-case operation count**: 1 SQL transaction (bounded by PostgreSQL transaction timeout).
> - **Failure behavior**: If RPC fails, transaction rolls back cleanly; no XP or level state is mutated.
> - **Rollback strategy**: Retain previous `calculate_level_from_xp` SQL function definition or apply reverse migration.
> - **Regression test**: `scripts/simulate_xp_progression.ts` proving mathematical boundedness and monotonic level scaling across archetypes.

---

## 2. Forensic Diagnosis: The Rapid Level Collapse Problem

Under the current production PostgreSQL implementation (`calculate_level_from_xp`), the game curve is artificially capped at **Level 10** requiring merely **20,000 XP**:

```sql
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_xp INTEGER) RETURNS INTEGER AS $$
BEGIN
  IF p_xp < 500 THEN RETURN 1;
  ELSIF p_xp < 1200 THEN RETURN 2;
  ELSIF p_xp < 2200 THEN RETURN 3;
  ELSIF p_xp < 3500 THEN RETURN 4;
  ELSIF p_xp < 5200 THEN RETURN 5;
  ELSIF p_xp < 7500 THEN RETURN 6;
  ELSIF p_xp < 10500 THEN RETURN 7;
  ELSIF p_xp < 14500 THEN RETURN 8;
  ELSIF p_xp < 20000 THEN RETURN 9;
  ELSE RETURN 10;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

Concurrently, daily quest rewards in `src/utils/questEngine.ts` grant:
- **Tier 1 Quest**: 270 – 350 XP (avg 310 XP)
- **Tier 2 Quest**: 500 – 700 XP (avg 600 XP)
- **Tier 3 Quest**: 1,200 – 2,000 XP (avg 1,560 XP)
- **Daily Quest Pool**: ~2,470 XP per day.

### Empirical Progression Timeline (Current System)
Simulated via `scripts/simulate_xp_progression.ts`:
| Archetype | Daily Spots | Daily Scan XP | Daily Quest XP | Total Daily XP | Days to Level 5 | Days to Level 10 (MAX) |
|---|---|---|---|---|---|---|
| **Casual Player** | 1 | 125 XP | 215 XP | 340 XP | 10.3 days | **58.9 days** (< 2 months) |
| **Core Player** | 3 | 374 XP | 1,102 XP | 1,476 XP | 2.4 days | **13.6 days** (< 2 weeks) |
| **Hardcore Player** | 10 | 1,245 XP | 2,314 XP | 3,559 XP | 1.0 day | **5.6 days** (< 1 week) |

### Key Vulnerabilities:
1. **Progression Burnout**: An enthusiastic player reaches the absolute level cap in under 6 days. Post-Level 10, XP accumulates as an unrewarded vanity integer.
2. **Quest Inversion**: Quests currently provide 65%–75% of total XP, making car spotting mathematically inferior to checking quest checkboxes.

---

## 3. Proposed Rebalanced Progression Model

### A. Extended 30-Level Power Curve
Formula for cumulative XP needed for Level $L$:
$$\text{XP}(L) = \mathrm{round}\left(350 \cdot (L - 1)^{1.85}\right)$$

| Level | Required Cumulative XP | Delta From Previous |
|---|---|---|
| Level 1 | 0 XP | 0 |
| Level 5 | 4,551 XP | ~1,400 |
| Level 10 | 20,296 XP | ~3,000 |
| Level 15 | 43,410 XP | ~4,500 |
| Level 20 | 73,812 XP | ~6,000 |
| Level 25 | 111,289 XP | ~7,500 |
| Level 30 (Apex Master) | 155,703 XP | ~9,000 |

### B. Scaled Quest Rewards
Rebalance quest rewards so vehicle spotting remains primary (65–70% of progression):
- **Tier 1 (Warmup)**: 40 – 60 XP (avg 50 XP)
- **Tier 2 (Focus)**: 120 – 160 XP (avg 140 XP)
- **Tier 3 (Mastery)**: 300 – 400 XP (avg 350 XP)
- **Total Daily Quest Reward Pool**: ~540 XP per day.

### C. Empirical Progression Timeline (Rebalanced System)
| Archetype | Daily Spots | Daily Scan XP | Daily Quest XP | Total Daily XP | Days to Level 10 | Days to Level 20 | Days to Level 30 (MAX) |
|---|---|---|---|---|---|---|
| **Casual Player** | 1 | 125 XP | 39 XP | 164 XP | 124.7 days | 496.9 days | **1,086.4 days** (~3 years) |
| **Core Player** | 3 | 374 XP | 232 XP | 606 XP | 33.7 days | 134.2 days | **293.4 days** (~10 months) |
| **Hardcore Player** | 10 | 1,245 XP | 505 XP | 1,750 XP | 11.7 days | 46.4 days | **101.5 days** (~3.3 months) |

---

## 4. Draft Migration (`supabase/migrations/20261012_rebalance_xp_progression.sql`)

```sql
-- Rebalance XP progression to 30 levels with smooth power-curve pacing
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_xp < 350 THEN RETURN 1;
  ELSIF p_xp < 1261 THEN RETURN 2;
  ELSIF p_xp < 2650 THEN RETURN 3;
  ELSIF p_xp < 4455 THEN RETURN 4;
  ELSIF p_xp < 6650 THEN RETURN 5;
  ELSIF p_xp < 9217 THEN RETURN 6;
  ELSIF p_xp < 12143 THEN RETURN 7;
  ELSIF p_xp < 15416 THEN RETURN 8;
  ELSIF p_xp < 19027 THEN RETURN 9;
  ELSIF p_xp < 22967 THEN RETURN 10;
  ELSIF p_xp < 27228 THEN RETURN 11;
  ELSIF p_xp < 31804 THEN RETURN 12;
  ELSIF p_xp < 36688 THEN RETURN 13;
  ELSIF p_xp < 41873 THEN RETURN 14;
  ELSIF p_xp < 47355 THEN RETURN 15;
  ELSIF p_xp < 53127 THEN RETURN 16;
  ELSIF p_xp < 59186 THEN RETURN 17;
  ELSIF p_xp < 65526 THEN RETURN 18;
  ELSIF p_xp < 72144 THEN RETURN 19;
  ELSIF p_xp < 79034 THEN RETURN 20;
  ELSIF p_xp < 86193 THEN RETURN 21;
  ELSIF p_xp < 93617 THEN RETURN 22;
  ELSIF p_xp < 101302 THEN RETURN 23;
  ELSIF p_xp < 109245 THEN RETURN 24;
  ELSIF p_xp < 117441 THEN RETURN 25;
  ELSIF p_xp < 125889 THEN RETURN 26;
  ELSIF p_xp < 134583 THEN RETURN 27;
  ELSIF p_xp < 143521 THEN RETURN 28;
  ELSIF p_xp < 152701 THEN RETURN 29;
  ELSE RETURN 30;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 5. Owner Decision Required (Gate G3)
- [ ] Approve proposed 30-level power curve for execution during database migration cycle.
- [ ] Approve calibrated quest XP rewards in `src/utils/questEngine.ts`.
