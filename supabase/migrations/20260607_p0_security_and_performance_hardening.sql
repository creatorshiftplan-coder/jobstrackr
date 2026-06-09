-- ==============================================================================
-- Migration: P0 Security and Database Performance Hardening
-- ==============================================================================

-- 1. Remediate P0 Security RLS Defeats
-- Drop policies that accidentally expose write/read access to the PUBLIC role.
-- (Note: The Supabase service_role key bypasses RLS automatically, so no policies are needed for it.)
DROP POLICY IF EXISTS "Service role full access" ON public.api_keys_config;
DROP POLICY IF EXISTS "Service role full access on scrape_queue" ON public.scrape_queue;
DROP POLICY IF EXISTS "Service role can manage syllabus cache" ON public.syllabus_cache;

-- 2. Remediate Performance & Scalability Issues
-- Create missing foreign key indexes to prevent expensive sequential scans during joins and cascade deletions.
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id ON public.saved_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);

-- Create composite index on update_logs to optimize rate-limiting counts checked on every API request.
CREATE INDEX IF NOT EXISTS idx_update_logs_user_reset ON public.update_logs(user_id, created_at);
