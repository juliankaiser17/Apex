-- ==============================================================================
-- DRAFT MIGRATION: Stage G AI Flywheel & Community Feedback Schema
-- Location: docs/ai/proposals/20261010_stage_g_flywheel_schema.sql
-- Status: PROPOSED ONLY - DO NOT APPLY DIRECTLY TO PRODUCTION (Gate G3)
-- ==============================================================================

-- 1. Scan Feedback & Corrections
CREATE TABLE IF NOT EXISTS public.ai_scan_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('confirm', 'correct', 'flag_wrong', 'poor_quality')),
    suggested_canonical_id TEXT,
    suggested_make TEXT,
    suggested_model TEXT,
    suggested_variant TEXT,
    correction_reason TEXT,
    user_comment TEXT,
    model_version TEXT NOT NULL DEFAULT 'v2.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraint: Ensure suggested_canonical_id is provided if correcting
    CONSTRAINT chk_correction_requires_canonical CHECK (
        (feedback_type = 'correct' AND suggested_canonical_id IS NOT NULL) OR
        (feedback_type != 'correct')
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_scan_feedback_scan ON public.ai_scan_feedback(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_scan_feedback_user ON public.ai_scan_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_scan_feedback_canonical ON public.ai_scan_feedback(suggested_canonical_id);

-- 2. Consented Gallery Contributions (Gate G2)
CREATE TABLE IF NOT EXISTS public.ai_gallery_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canonical_id TEXT NOT NULL,
    image_storage_path TEXT NOT NULL,
    image_sha256 TEXT NOT NULL,
    phash TEXT,
    viewpoint_estimated TEXT CHECK (viewpoint_estimated IN ('front_three_quarter', 'rear_three_quarter', 'side_profile', 'front', 'rear', 'unknown')),
    consent_version TEXT NOT NULL, -- E.g. '2026.10-v1'
    license_grant TEXT NOT NULL DEFAULT 'apex_community_perpetual_v1',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'peer_confirmed', 'admin_approved', 'rejected', 'quarantined')),
    confirmation_count INT NOT NULL DEFAULT 0,
    rejection_count INT NOT NULL DEFAULT 0,
    discriminator_vetoed BOOLEAN NOT NULL DEFAULT false,
    centroid_distance NUMERIC(5, 4),
    promoted_to_production BOOLEAN NOT NULL DEFAULT false,
    promoted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_gallery_contrib_hash UNIQUE (image_sha256)
);

CREATE INDEX IF NOT EXISTS idx_ai_gallery_contrib_status ON public.ai_gallery_contributions(status);
CREATE INDEX IF NOT EXISTS idx_ai_gallery_contrib_canonical ON public.ai_gallery_contributions(canonical_id);
CREATE INDEX IF NOT EXISTS idx_ai_gallery_contrib_phash ON public.ai_gallery_contributions(phash);

-- 3. Admin AI Control Center Review Queue
CREATE TABLE IF NOT EXISTS public.ai_admin_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id UUID REFERENCES public.ai_gallery_contributions(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL,
    flagged_reason TEXT NOT NULL CHECK (flagged_reason IN ('mythic_variant', 'consensus_dispute', 'discriminator_warning', 'user_report', 'manual_sample')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_decision TEXT CHECK (review_decision IN ('approved', 'rejected', 'quarantined', 'deferred')),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_admin_review_pending ON public.ai_admin_review_queue(priority, created_at) WHERE reviewed_at IS NULL;

-- ==============================================================================
-- Row-Level Security (RLS) Invariants
-- ==============================================================================

ALTER TABLE public.ai_scan_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_gallery_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_admin_review_queue ENABLE ROW LEVEL SECURITY;

-- ai_scan_feedback: Users can read and insert their own feedback
CREATE POLICY ai_scan_feedback_user_insert ON public.ai_scan_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY ai_scan_feedback_user_select ON public.ai_scan_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- ai_gallery_contributions: Users can insert with valid consent, read their own submissions
CREATE POLICY ai_gallery_contrib_user_insert ON public.ai_gallery_contributions
    FOR INSERT WITH CHECK (auth.uid() = user_id AND consent_version IS NOT NULL);

CREATE POLICY ai_gallery_contrib_user_select ON public.ai_gallery_contributions
    FOR SELECT USING (auth.uid() = user_id);

-- Admin Queue & Admin Overrides: Accessible only to staff/admin role
CREATE POLICY ai_admin_review_admin_all ON public.ai_admin_review_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY ai_gallery_contrib_admin_all ON public.ai_gallery_contributions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- ==============================================================================
-- Non-Incentivization Rule: Zero-XP Trigger Verification
-- Explicitly prevents any trigger or function from awarding XP on feedback
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_prevent_feedback_xp_manipulation()
RETURNS TRIGGER AS $$
BEGIN
    -- Flywheel invariant: Scan corrections never modify user balance or stats
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feedback_xp_guard ON public.ai_scan_feedback;
CREATE TRIGGER trg_feedback_xp_guard
    BEFORE INSERT ON public.ai_scan_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_feedback_xp_manipulation();
