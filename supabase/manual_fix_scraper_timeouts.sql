-- ============================================================================
-- MANUAL FIX: Eliminate Supabase timeouts during job/exam scraping & saving
-- ============================================================================
-- Paste this whole script into: Supabase Dashboard > SQL Editor > New Query > Run.
-- It is IDEMPOTENT and SAFE to run more than once.
--
-- WHAT IT DOES
--   1. Drops the four AFTER INSERT triggers on `jobs` and `exam_updates` that ran
--      heavy per-row work (looping every user with LIKE matching, plus pg_net HTTP
--      calls) inside the insert transaction. Under batch scraping these blocked the
--      inserts and exceeded the statement timeout -> "saving" timed out.
--   2. Speeds up the scraper's pre-insert duplicate-title check with a trigram index.
--
-- WHAT IT DOES NOT DO
--   - It does NOT remove Telegram posting. Manual broadcasting still works: the Admin
--     panel calls the `telegram-auto-post` and `process-telegram-queue` edge functions
--     directly (see src/pages/Admin.tsx), which do not depend on these triggers.
--   - The trigger FUNCTIONS are intentionally left in place (harmless when unbound) so
--     nothing else that references them breaks. Only the INSERT bindings are removed.
-- ============================================================================

BEGIN;

-- ── 1. Drop the heavy automatic insert triggers (jobs) ─────────────────────
-- on_job_inserted        -> trigger_telegram_auto_post()      (pg_net -> telegram-auto-post)
-- on_job_inserted_queue  -> process_job_notification_trigger() (loops all users + LIKE matching)
DROP TRIGGER IF EXISTS on_job_inserted        ON public.jobs;
DROP TRIGGER IF EXISTS on_job_inserted_queue  ON public.jobs;

-- ── 2. Drop the heavy automatic insert triggers (exam_updates) ─────────────
DROP TRIGGER IF EXISTS on_exam_update_inserted        ON public.exam_updates;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue  ON public.exam_updates;

-- ── 3. Speed up the duplicate-title check used before every insert ─────────
-- api/job_insert_helper.py runs `title ILIKE '<exact title>'` before each insert.
-- Without an index this is a sequential scan on a growing table on every saved row.
-- A trigram GIN index lets ILIKE use an index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm
  ON public.jobs USING gin (title gin_trgm_ops);

COMMIT;

-- ============================================================================
-- VERIFICATION — run these after the script; expected results in comments.
-- ============================================================================

-- (a) No automatic insert triggers should remain on jobs/exam_updates.
--     Expected: 0 rows.
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('jobs', 'exam_updates')
  AND trigger_name IN (
    'on_job_inserted', 'on_job_inserted_queue',
    'on_exam_update_inserted', 'on_exam_update_inserted_queue'
  )
ORDER BY event_object_table, trigger_name;

-- (b) The trigram index should exist.
--     Expected: 1 row (idx_jobs_title_trgm).
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'jobs' AND indexname = 'idx_jobs_title_trgm';

-- (c) Optional: list any scheduled cron jobs (confirms nothing auto-posts to Telegram).
--     Expected: only 'process-embeddings-10m' (and any discovery cron you set up
--     manually); NOT telegram-auto-post / process-telegram-queue.
-- SELECT jobid, schedule, jobname, active FROM cron.job ORDER BY jobname;
