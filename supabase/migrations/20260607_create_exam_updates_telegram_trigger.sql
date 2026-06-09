-- Migration: Create database trigger to auto-invoke telegram-auto-post edge function for exam updates
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.trigger_telegram_auto_post_for_update()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Retrieve Supabase parameters from Vault
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    -- Invoke the telegram-auto-post edge function asynchronously via pg_net
    PERFORM net.http_post(
      url := CONCAT(supabase_url, '/functions/v1/telegram-auto-post'),
      headers := jsonb_build_object(
          'Authorization', CONCAT('Bearer ', service_role_key),
          'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('exam_update', row_to_json(NEW)::jsonb)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to run AFTER INSERT on exam_updates table
DROP TRIGGER IF EXISTS on_exam_update_inserted ON public.exam_updates;
CREATE TRIGGER on_exam_update_inserted
    AFTER INSERT ON public.exam_updates
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_telegram_auto_post_for_update();
