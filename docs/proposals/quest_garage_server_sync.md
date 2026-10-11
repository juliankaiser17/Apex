# Lane 2 Proposal: Server-Authoritative Quest Tracking & Garage Synchronization

**Target Component**: `supabase/migrations/` (`user_quests` table & `record_car_scan` RPC integration)  
**Classification**: Lane 2 (Database Transactions, Quest Persistence, Economy Integrity)  
**Status**: Proposal for Owner Review (Gate G3)  
**Regression Test**: `scripts/test_quest_garage_mismatch.ts`

---

## 1. Cost Transparency Statement (Mandatory Blast Radius Guardrail)

> **"One user action can cause at most 1 database RPC call (`record_car_scan`), consuming 0 external API calls."**
> - **Expected operation count**: 1 atomic PostgreSQL transaction writing to `garage`, updating `profiles`, and updating `user_quests`.
> - **Worst-case operation count**: 1 SQL transaction (bounded by PostgreSQL transaction timeout).
> - **Failure behavior**: If any table insert/update fails, PostgreSQL rolls back the entire transaction. No partial states, unminted cards with awarded XP, or phantom quest progress can occur.
> - **Rollback strategy**: Standard Supabase database migration rollback.
> - **Regression test**: `scripts/test_quest_garage_mismatch.ts` verifying that garage cards, user XP, and quest states remain in 1:1 atomic lockstep.

---

## 2. Forensic Investigation & Root Cause

### Can a scan award XP and quest progress without saving a card?
**YES, under the original codebase architecture:**
1. **Asynchronous Lifecycle Decoupling**:
   When vehicle scanning succeeded in `ScannerModal.tsx`, the model called `onScanCompleted(newCard)`.
   - `onScanCompleted` invoked the server RPC `record_car_scan` (or caught network errors), awarded user XP, and evaluated `processQuestScan(dailyQuests, ...)`, persisting updated quest counts to `localStorage`.
   - **Crucially, `onScanCompleted` omitted adding the card to the client store's `state.garage` array.**
   - Adding to client `state.garage` was deferred to `DiscoveryReveal.tsx` when/if the user manually pressed "Save to Garage" (`addCardToGarage`).
2. **Failure Vectors**:
   - **User Exits / Continues Hunting**: If the user tapped "Continue Scanning" or closed the modal, the card was never added to `state.garage`.
   - **Offline Scanning**: If offline, `onScanCompleted` advanced daily quests locally, but the scan was never recorded to the database and never added to `state.garage`. The user progressed quests without owning any card!
   - **Double-Progression**: When the user did press "Save to Garage", `addCardToGarage` invoked `processXpGain` and `processQuestScan` a second time, granting double XP on the client and incrementing quest counters twice per scan.

---

## 3. Lane 1 Client Resolution (Applied & Verified)

In `src/store/useApexStore.ts`:
1. **Atomic Local Mutation**: `onScanCompleted` now atomically adds `card` to `state.garage` (and syncs to `persistLightweightGarage`) in the exact same state update transaction as `dailyQuests` and `user.xp`.
2. **Idempotency Guard**: `addCardToGarage` checks `alreadyInGarage`. If the card is already present or was recorded by `onScanCompleted`, duplicate XP grants (`processXpGain`) and duplicate quest evaluations (`processQuestScan`) are strictly bypassed.

---

## 4. Proposed Lane 2 Database Architecture (`user_quests`)

Currently, quests exist solely in client `localStorage`. If a user logs in on a new device or reinstalls the app, all quest progress is lost.

### Draft SQL Migration:
```sql
-- 1. Create Server-Authoritative Daily Quests Table
CREATE TABLE IF NOT EXISTS user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quest_id TEXT NOT NULL,
  category TEXT NOT NULL, -- 'daily', 'brand', 'tier'
  current_count INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, quest_date, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_date ON user_quests(user_id, quest_date);

-- Enable RLS
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quests"
  ON user_quests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Integrate Quest Advancement Atomically into record_car_scan
-- Inside record_car_scan transaction:
-- UPDATE user_quests
-- SET current_count = LEAST(target_count, current_count + 1),
--     completed = (current_count + 1 >= target_count),
--     updated_at = now()
-- WHERE user_id = v_user_id
--   AND quest_date = CURRENT_DATE
--   AND (target_make IS NULL OR target_make = p_make);
```

---

## 5. Owner Decision Required (Gate G3)
- [ ] Approve migration to server-authoritative `user_quests` table during next database maintenance window.
