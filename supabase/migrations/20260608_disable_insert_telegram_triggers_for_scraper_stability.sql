-- Migration: Keep scraper/admin inserts lightweight
-- =================================================
-- The admin Discover and Updates tabs insert jobs and exam_updates one row at a
-- time. Automatic Telegram triggers turn each insert into multiple pg_net edge
-- function calls, and those workers can scan preferences, enqueue messages, and
-- send Telegram batches. Under scraped batches this can overload Postgres/Auth.
--
-- Telegram posting and user matchers are still available from the Admin panel's
-- manual controls; they should not run implicitly from INSERT triggers.

DROP TRIGGER IF EXISTS on_job_inserted ON public.jobs;
DROP TRIGGER IF EXISTS on_job_inserted_queue ON public.jobs;
DROP TRIGGER IF EXISTS on_exam_update_inserted ON public.exam_updates;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;

COMMENT ON FUNCTION public.trigger_telegram_auto_post() IS
  'Not bound to jobs insert by default. Use Admin manual Telegram broadcast controls.';

COMMENT ON FUNCTION public.trigger_telegram_auto_post_for_update() IS
  'Not bound to exam_updates insert by default. Use Admin manual Telegram broadcast controls.';

COMMENT ON FUNCTION public.process_job_notification_trigger() IS
  'Not bound to jobs insert by default. Use Admin manual matcher controls.';

COMMENT ON FUNCTION public.process_exam_update_notification_trigger() IS
  'Not bound to exam_updates insert by default. Use Admin manual matcher controls.';
