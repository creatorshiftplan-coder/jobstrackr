-- Migration: Bookmarked exam updates ("My Countdown Wall")
-- ==============================================================================
-- Lets a signed-in user bookmark exam_updates so they appear on their personal
-- Countdown Wall (/countdown → "My Wall"). Mirrors the saved_jobs pattern.
-- Idempotent and safe to run more than once.

CREATE TABLE IF NOT EXISTS public.saved_exam_updates (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    update_id UUID NOT NULL REFERENCES public.exam_updates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, update_id)
);

-- Fast "list my bookmarks newest-first" lookups.
CREATE INDEX IF NOT EXISTS idx_saved_exam_updates_user_created
    ON public.saved_exam_updates (user_id, created_at DESC);

ALTER TABLE public.saved_exam_updates ENABLE ROW LEVEL SECURITY;

-- Each user can only see and manage their own bookmarks.
DROP POLICY IF EXISTS "Users can view their own saved exam updates" ON public.saved_exam_updates;
CREATE POLICY "Users can view their own saved exam updates" ON public.saved_exam_updates
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved exam updates" ON public.saved_exam_updates;
CREATE POLICY "Users can insert their own saved exam updates" ON public.saved_exam_updates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved exam updates" ON public.saved_exam_updates;
CREATE POLICY "Users can delete their own saved exam updates" ON public.saved_exam_updates
    FOR DELETE USING (auth.uid() = user_id);
