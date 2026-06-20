-- Migration: database-level duplicate-job guard
-- ==============================================================================
-- The Sheets sync (supabase/functions/sync-sheets) deduped new jobs with a
-- case-SENSITIVE, exact `.in("title", …)` lookup, so any listing whose stored
-- title differed only by casing, punctuation or spacing slipped through — and the
-- slug-collision resolver then appended -1/-2 and inserted it as a "new" row.
-- There was no DB-level uniqueness on title (only `slug` is UNIQUE), so nothing
-- stopped duplicates, and two overlapping runs (cron + manual) could both insert
-- the same rows.
--
-- Fix: add a generated `dedupe_key` (the SAME normalization the admin "Find
-- Duplicates" tool uses — lowercase, non-alphanumerics → single space, trimmed,
-- title + department) and a UNIQUE index on it. The sync upserts ON CONFLICT
-- DO NOTHING against this key, so duplicates are rejected by the database under
-- any code path or race. Two listings that share a normalized title + department
-- are treated as the same job (matching the product's existing dedupe definition).

-- 1. Normalized dedupe key, kept in sync by the database. All functions used are
--    IMMUTABLE, which a STORED generated column requires.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT
  GENERATED ALWAYS AS (
    trim(regexp_replace(lower(coalesce(title,      '')), '[^a-z0-9]+', ' ', 'g')) || '||' ||
    trim(regexp_replace(lower(coalesce(department, '')), '[^a-z0-9]+', ' ', 'g'))
  ) STORED;

-- 2. Collapse the existing backlog of duplicates so the unique index can build.
--    Keep the newest listing per key (tie-break by id); the rest are "losers".
--    scrape_queue.job_id is a NO ACTION FK (unlike the CASCADE/SET NULL refs), so
--    null those references first or the delete fails.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC, id DESC) AS rn
  FROM public.jobs
)
UPDATE public.scrape_queue
   SET job_id = NULL
 WHERE job_id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC, id DESC) AS rn
  FROM public.jobs
)
DELETE FROM public.jobs
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. The backstop: one job per normalized title + department.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_key_uniq ON public.jobs (dedupe_key);
