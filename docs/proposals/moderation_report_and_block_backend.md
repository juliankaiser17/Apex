# Lane 2 Proposal: Server-Side Moderation, User Blocking, and Content Reporting

**Target Component**: `supabase/migrations/` (`user_blocks` and `content_reports` tables & RLS)  
**Classification**: Lane 2 (Database Schema, Moderation Integrity, User Safety)  
**Status**: Proposal for Owner Review (Gate G3)  
**Verification Test**: `scripts/test_moderation_flow.ts`

---

## 1. Cost Transparency Statement (Mandatory Blast Radius Guardrail)

> **"One user action can cause at most 1 database insert (`content_reports` or `user_blocks`), consuming 0 external API calls."**
> - **Expected operation count**: 1 SQL insert per report submission or block toggle.
> - **Worst-case operation count**: 1 SQL transaction (bounded by PostgreSQL transaction timeout).
> - **Failure behavior**: If network fails or user is rate-limited, client shows immediate feedback ("Unable to submit report. Please check connection.") and caches the report locally for retry.
> - **Rollback strategy**: Standard Supabase migration rollback dropping `user_blocks` and `content_reports`.
> - **Regression test**: `scripts/test_moderation_flow.ts` verifying client feed filtering and report serialization.

---

## 2. Problem Statement: Why Client-Side Moderation is Insufficient

Currently:
1. **Reporting is Local-Only**: `ModerationModal.tsx` stores reports in the local browser's `localStorage.getItem('apex_moderation_reports')`. Administrators never receive the report, and malicious content remains live in the global feed.
2. **Blocking is Ephemeral**: `blockUser(targetUserId)` stores the blocked user ID in local Zustand store memory and filters `state.feedPosts`. Upon refreshing the page or switching devices, the blocked user is restored, and their posts and hunt alerts reappear.
3. **Google Play UGC Policy Violation**: Google Play requires apps featuring user-generated content (posts, comments, hunts) to provide:
   - A mechanism for users to report objectionable content with server receipt.
   - A mechanism for users to block abusive users persistently across sessions.
   - An administrator dashboard or review queue to act on reported content within 24 hours.

---

## 3. Proposed Database Schema (`user_blocks` and `content_reports`)

### A. Persistent User Blocks
```sql
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own blocks
CREATE POLICY "Users can view their own blocks"
  ON user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
  ON user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND blocker_id != blocked_id);

CREATE POLICY "Users can remove their own blocks"
  ON user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);
```

### B. Authoritative Content Reports
```sql
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert reports (rate-limited)
CREATE POLICY "Users can submit reports"
  ON content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins / service-role can view reports
CREATE POLICY "Admins can view reports"
  ON content_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

### C. Automatic Server Feed Filtering
Update the feed query or RPC to exclude blocked authors:
```sql
CREATE OR REPLACE FUNCTION get_clean_feed_posts(p_user_id UUID, p_limit INTEGER DEFAULT 30)
RETURNS SETOF posts
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.*
  FROM posts p
  WHERE NOT EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE ub.blocker_id = p_user_id AND ub.blocked_id = p.user_id
  )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;
```

---

## 4. Owner Decision Required (Gate G3)
- [ ] Approve applying migration `20261012_user_blocks_and_reports.sql` to Supabase staging.
- [ ] Confirm administrator email notification address for pending moderation reports.
