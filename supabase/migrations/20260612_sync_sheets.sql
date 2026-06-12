-- Migration: Google-Sheets → Supabase sync (cursor table + hourly pg_cron)
-- ==============================================================================
-- The Apps Script scraper writes jobs/exam_updates rows into a Google Sheet and
-- exposes them via a secret-protected Web App. The `sync-sheets` edge function
-- pulls new rows hourly and bulk-upserts them here, so Supabase only takes one
-- batched import per hour instead of continuous scraping load.

-- 1. Cursor state — one row per feed, holding the newest scraped_at imported.
CREATE TABLE IF NOT EXISTS public.sheet_sync_state (
  feed TEXT PRIMARY KEY,                 -- 'jobs' | 'updates'
  last_scraped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.sheet_sync_state (feed, last_scraped_at)
VALUES ('jobs', NULL), ('updates', NULL)
ON CONFLICT (feed) DO NOTHING;

-- Service-role only (the edge function uses the service key); no anon access.
ALTER TABLE public.sheet_sync_state ENABLE ROW LEVEL SECURITY;

-- 2. Schedule the sync hourly via pg_cron (skips cleanly if pg_cron isn't enabled).
--    Mirrors 20260608_process_embeddings_cron.sql.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('sync-sheets-hourly');

    PERFORM cron.schedule(
      'sync-sheets-hourly',
      '0 * * * *', -- top of every hour
      $inner$
      SELECT net.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/sync-sheets')
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
    RAISE NOTICE 'pg_cron job sync-sheets-hourly scheduled.';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — schedule sync-sheets-hourly manually in the Dashboard.';
  END IF;
END $outer$;
