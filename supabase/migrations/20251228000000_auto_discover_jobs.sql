-- Migration: Create auto_discover_logs table for scheduled job discovery
-- Also adds auto_discovered column to jobs table

-- Add auto_discovered flag to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS auto_discovered BOOLEAN DEFAULT false;

-- Create auto_discover_logs table
CREATE TABLE IF NOT EXISTS auto_discover_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    jobs_found INTEGER DEFAULT 0,
    jobs_inserted INTEGER DEFAULT 0,
    jobs_duplicate INTEGER DEFAULT 0,
    raw_response JSONB,
    error TEXT,
    latency_ms INTEGER,
    is_manual BOOLEAN DEFAULT false,
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id)
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_auto_discover_logs_run_at ON auto_discover_logs(run_at DESC);

-- Index for unreviewed jobs (for badge count)
CREATE INDEX IF NOT EXISTS idx_auto_discover_logs_unreviewed ON auto_discover_logs(reviewed) WHERE reviewed = false;

-- Enable RLS
ALTER TABLE auto_discover_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view auto discover logs
CREATE POLICY "Admins can view auto discover logs" ON auto_discover_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Policy: Only admins can update (mark as reviewed)
CREATE POLICY "Admins can update auto discover logs" ON auto_discover_logs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Service role can insert (for edge function)
CREATE POLICY "Service role can insert auto discover logs" ON auto_discover_logs
    FOR INSERT WITH CHECK (true);

-- Function to get count of unreviewed auto-discovered jobs
CREATE OR REPLACE FUNCTION get_unreviewed_auto_discover_count()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(jobs_inserted), 0)::INTEGER
    FROM auto_discover_logs
    WHERE reviewed = false AND jobs_inserted > 0;
$$;
