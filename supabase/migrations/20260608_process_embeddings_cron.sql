-- Migration: Set up pg_cron for periodic job embedding generation (every 10 minutes)
-- ==============================================================================

-- Schedule the process-embeddings function to run every 10 minutes
-- Note: cron.schedule must be run in the local database. If pg_cron is not fully enabled,
-- it will skip and can be run manually via the Supabase Dashboard SQL Editor.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedules existing one if any
    PERFORM cron.unschedule('process-embeddings-10m');
    
    PERFORM cron.schedule(
      'process-embeddings-10m',
      '*/10 * * * *', -- Every 10 minutes
      $inner$
      SELECT net.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/process-embeddings') 
                FROM vault.decrypted_secrets 
                WHERE name = 'supabase_url'),
        headers := jsonb_build_object(
          'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $inner$
    );
    RAISE NOTICE 'pg_cron job process-embeddings-10m scheduled successfully.';
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled. Skip schedule. Setup can be completed manually.';
  END IF;
END $outer$;
