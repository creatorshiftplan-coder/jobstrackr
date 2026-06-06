-- Migration: Create database trigger to auto-invoke telegram-auto-post edge function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trigger_telegram_auto_post()
RETURNS TRIGGER AS $$
BEGIN
  -- Invoke the telegram-auto-post edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := (SELECT CONCAT(decrypted_secret, '/functions/v1/telegram-auto-post')
            FROM vault.decrypted_secrets
            WHERE name = 'supabase_url'),
    headers := jsonb_build_object(
        'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
        'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('job', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to run AFTER INSERT on jobs table
DROP TRIGGER IF EXISTS on_job_inserted ON public.jobs;
CREATE TRIGGER on_job_inserted
    AFTER INSERT ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_telegram_auto_post();
