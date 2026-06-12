-- Migration: Guard against automatic Telegram insert triggers
-- ==========================================================
-- Keep jobs/exam_updates inserts cheap. If a later migration re-creates the
-- automatic Telegram insert triggers, this assertion fails during migration
-- review/deployment instead of letting scraped saves overload Supabase again.
--
-- Self-healing: drop the triggers idempotently FIRST so this migration is
-- order-independent. (Filenames sort 'assert_*' before 'disable_*', so without this
-- the assertion could run while an earlier migration's triggers still exist and fail
-- a fresh `supabase db push`.) After the drops the assertion below always passes.

DROP TRIGGER IF EXISTS on_job_inserted              ON public.jobs;
DROP TRIGGER IF EXISTS on_job_inserted_queue        ON public.jobs;
DROP TRIGGER IF EXISTS on_exam_update_inserted      ON public.exam_updates;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table IN ('jobs', 'exam_updates')
      AND trigger_name IN (
        'on_job_inserted',
        'on_job_inserted_queue',
        'on_exam_update_inserted',
        'on_exam_update_inserted_queue'
      )
  ) THEN
    RAISE EXCEPTION 'Unsafe automatic Telegram insert trigger exists on jobs/exam_updates';
  END IF;
END $$;
