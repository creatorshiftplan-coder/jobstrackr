-- Migration: Guard against automatic Telegram insert triggers
-- ==========================================================
-- Keep jobs/exam_updates inserts cheap. If a later migration re-creates the
-- automatic Telegram insert triggers, this assertion fails during migration
-- review/deployment instead of letting scraped saves overload Supabase again.

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
