-- ===================================================================================
-- DISABLE AUTOMATIC TELEGRAM POSTING AND MATCHING TRIGGERS
-- ===================================================================================
-- Switches completely to manual control panel triggers inside the Admin dashboard.
-- ===================================================================================

DROP TRIGGER IF EXISTS on_job_inserted ON public.jobs;
DROP TRIGGER IF EXISTS on_job_inserted_queue ON public.jobs;
DROP TRIGGER IF EXISTS on_exam_update_inserted ON public.exam_updates;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;
