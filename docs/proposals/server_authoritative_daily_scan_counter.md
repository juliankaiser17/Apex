# Proposal: Server-Authoritative Daily Scan Counter Across All Scan Outcomes

**Status:** Proposed (Lane 2 / Post-Beta)  
**Authors:** Apex Engineering Team  
**Reviewers:** Repository Owner  
**Blast-Radius Risk:** Minimal (Postgres RPC, zero schema alterations)  

---

## 1. Problem Statement & Audit Finding

In the current production database architecture:
1. `profiles.daily_scans_count` and `profiles.daily_scans_reset_at` exist on the `profiles` table.
2. The counter is **incremented exclusively server-side** within the `record_car_scan` PostgreSQL transaction (`supabase/schema.sql:842`).
3. Direct client writes (`UPDATE profiles SET daily_scans_count = ...`) are strictly blocked by PostgreSQL Row-Level Security (RLS) policies.
4. **However**, `record_car_scan` is only invoked when a scan successfully yields a recognized in-catalogue vehicle that the user adds to their garage.
5. If a user scans 25 out-of-catalogue commuter cars or captures dark/ambiguous photos where the model abstains (`needs_more_views`), `record_car_scan` is not called, and `profiles.daily_scans_count` is not incremented.
6. In `src/api/analyze.ts`, the server enforces `userDailyScanCap` against `profiles.daily_scans_count`. Because non-collectible scans do not increment this counter in the DB, only collectible saves are tracked against the quota unless an atomic server-side counter increment runs on every analyze request.

---

## 2. Proposed Architecture: `increment_scan_attempt` RPC

To track every vision scan attempt against the free-tier budget without violating atomic concurrency invariants:

### SQL RPC Definition
```sql
CREATE OR REPLACE FUNCTION increment_scan_attempt(
  p_user_id UUID,
  p_daily_cap INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_new_count INTEGER;
BEGIN
  -- 1. Fetch current profile state with row lock
  SELECT daily_scans_count, daily_scans_reset_at
  INTO v_current_count, v_reset_at
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- 2. Evaluate 24-hour reset window
  IF v_reset_at IS NULL OR (v_now - v_reset_at) >= INTERVAL '24 hours' THEN
    v_new_count := 1;
    v_reset_at := v_now;
  ELSE
    IF v_current_count >= p_daily_cap THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'USER_DAILY_LIMIT_EXCEEDED',
        'current_count', v_current_count,
        'daily_cap', p_daily_cap,
        'reset_at', v_reset_at + INTERVAL '24 hours'
      );
    END IF;
    v_new_count := v_current_count + 1;
  END IF;

  -- 3. Persist increment atomically
  UPDATE profiles
  SET daily_scans_count = v_new_count,
      daily_scans_reset_at = v_reset_at,
      last_scan_at = v_now
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'current_count', v_new_count,
    'daily_cap', p_daily_cap,
    'scans_remaining', GREATEST(0, p_daily_cap - v_new_count)
  );
END;
$$;
```

---

## 3. Server Integration in `api/analyze.ts`

When a request arrives at `/api/analyze`:
```typescript
if (authenticatedUserId && supabaseAdmin) {
  const { data, error } = await supabaseAdmin.rpc('increment_scan_attempt', {
    p_user_id: authenticatedUserId,
    p_daily_cap: pipelineConfig.freeTierBudgets.userDailyScanCap
  });

  if (data && !data.success && data.code === 'USER_DAILY_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: `You have reached your daily beta scan limit (${pipelineConfig.freeTierBudgets.userDailyScanCap} scans).`,
      code: 'USER_DAILY_LIMIT_EXCEEDED',
      resetAt: data.reset_at
    });
  }
}
```

---

## 4. Current Pre-Beta Behavior (Without Migration)

Per standing rules: **No schema or database migrations are run during the pre-beta launch**.
During pre-beta:
1. `src/api/analyze.ts` queries `profiles.daily_scans_count` and blocks users who have reached the cap (`userDailyScanCap`, default 10).
2. Global in-memory free-tier counter in `api/analyze.ts` strictly caps total community requests across all users to 500/day.
3. Once the database migration is approved post-beta, the atomic RPC above will track all non-collectible scan attempts seamlessly.
