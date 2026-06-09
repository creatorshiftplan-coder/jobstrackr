-- ==============================================================================
-- Migration: Disable all automatic Telegram posting and notification triggers
-- ==============================================================================

-- Drop automatic posting triggers (auto-post to public channels on INSERT)
DROP TRIGGER IF EXISTS on_job_inserted ON public.jobs;
DROP TRIGGER IF EXISTS on_exam_update_inserted ON public.exam_updates;

-- Drop automatic user notification triggers (auto-queue match notifications on INSERT)
DROP TRIGGER IF EXISTS on_job_inserted_queue ON public.jobs;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;
