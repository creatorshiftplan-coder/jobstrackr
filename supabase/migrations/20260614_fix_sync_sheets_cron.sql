-- Migration: Repair the hourly Google-Sheet → Supabase sync cron.
-- ==============================================================================
-- The original `sync-sheets-hourly` job (20260612_sync_sheets.sql) looked up the
-- project URL and service-role key from `vault.decrypted_secrets`. If either
-- vault entry was missing the cron fired but net.http_post received NULL inputs,
-- so the edge function never ran — and `sheet_sync_runs` never got a row, which
-- is exactly the "auto fetching is not working" symptom in admin.
--
-- This migration rewrites the cron with two changes:
--   1. The project URL is hardcoded — it's the known Supabase project, and no
--      vault decryption can fail on it.
--   2. Auth uses the shared `SHEETS_SYNC_SECRET` via the `x-sync-secret` header
--      (the same secret the Apps Script Web App and the admin proxy use). The
--      edge function already accepts this path. The secret is read from
--      vault.decrypted_secrets under the name `sheets_sync_secret`. If you
--      haven't stored it there yet, run (once, as an admin):
--
--        SELECT vault.create_secret('<your SHEETS_SYNC_SECRET>', 'sheets_sync_secret');
--
--      (or `update_secret` if a row already exists).
--
-- We also keep the platform-level `Authorization: Bearer <anon-or-publishable>`
-- header so Supabase's edge gateway lets the call through without service-role
-- privileges leaking into pg_cron.

DO $outer$
DECLARE
  v_project_url CONSTANT TEXT := 'https://fdxksytpdfgmbkttipdf.supabase.co';
  v_anon_key TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — schedule sync-sheets-hourly manually in the Dashboard.';
    RETURN;
  END IF;

  -- Best-effort lookup of the publishable/anon key from vault. Falls back to a
  -- known publishable key (anon role, safe to embed) if the vault entry isn't
  -- present — the cron must keep working even on a fresh project clone.
  BEGIN
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name IN ('anon_key', 'publishable_key', 'supabase_anon_key')
    ORDER BY name LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_anon_key := NULL;
  END;

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    -- Project publishable (anon) key — same value baked into the frontend bundle.
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkeGtzeXRwZGZnbWJrdHRpcGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM1MTYsImV4cCI6MjA4MDQyOTUxNn0.NocVE7TCJIQgIhbHkxhHWraBRxyCkLIdgUQ3ERCHuKQ';
  END IF;

  PERFORM cron.unschedule('sync-sheets-hourly');

  PERFORM cron.schedule(
    'sync-sheets-hourly',
    '0 * * * *',
    format(
      $inner$
      SELECT net.http_post(
        url := '%s/functions/v1/sync-sheets',
        headers := jsonb_build_object(
          'Authorization', 'Bearer %s',
          'Content-Type', 'application/json',
          'x-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sheets_sync_secret' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
      $inner$,
      v_project_url,
      v_anon_key
    )
  );

  RAISE NOTICE 'pg_cron job sync-sheets-hourly re-scheduled (x-sync-secret auth).';
END $outer$;
