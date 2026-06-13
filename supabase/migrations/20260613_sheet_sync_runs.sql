-- Migration: Google-Sheets sync run history (health + per-run counts)
-- ==============================================================================
-- The `sync-sheets` edge function pulls jobs/exam_updates from the Apps Script
-- Web App on an hourly cron (and on demand from the admin panel). `sheet_sync_state`
-- only holds the *cursor* per feed; it can't answer "when did we last fetch?" or
-- "how many jobs/updates came in by date?". This table logs one row per run so the
-- admin panel can show last-fetch time, health, and a per-date breakdown.

CREATE TABLE IF NOT EXISTS public.sheet_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger TEXT NOT NULL DEFAULT 'cron',   -- 'cron' | 'manual'
  success BOOLEAN NOT NULL DEFAULT TRUE,
  since_cursor TIMESTAMPTZ,               -- the cursor the run started from
  jobs_received INTEGER NOT NULL DEFAULT 0,
  jobs_inserted INTEGER NOT NULL DEFAULT 0,
  updates_received INTEGER NOT NULL DEFAULT 0,
  updates_upserted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sheet_sync_runs_ran_at
  ON public.sheet_sync_runs (ran_at DESC);

-- The edge function writes with the service-role key (bypasses RLS). Admins need
-- to read the history from the browser, so allow any admin role to SELECT.
ALTER TABLE public.sheet_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sheet sync runs" ON public.sheet_sync_runs;
CREATE POLICY "Admins can read sheet sync runs"
  ON public.sheet_sync_runs
  FOR SELECT
  USING (public.has_any_admin_role(auth.uid()));
