-- Extend auto_discover_logs with source column for tracking cron vs manual runs

ALTER TABLE auto_discover_logs 
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE auto_discover_logs 
    ADD COLUMN IF NOT EXISTS jobs_failed INTEGER DEFAULT 0;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_auto_discover_logs_source 
    ON auto_discover_logs(source, run_at DESC);
