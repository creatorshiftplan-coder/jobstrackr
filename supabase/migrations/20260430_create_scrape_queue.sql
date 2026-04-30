-- Create scrape_queue table for automated cron-based job discovery
-- Stores URLs to be scraped in batches to stay within Vercel timeout limits

CREATE TABLE IF NOT EXISTS scrape_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    source TEXT DEFAULT 'freejobalert',
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error TEXT,
    job_id UUID REFERENCES jobs(id)
);

-- Index for fast pending lookups ordered by discovery time
CREATE INDEX IF NOT EXISTS idx_scrape_queue_pending 
    ON scrape_queue(status, discovered_at) 
    WHERE status = 'pending';

-- Index for tracking retries
CREATE INDEX IF NOT EXISTS idx_scrape_queue_retry 
    ON scrape_queue(status, retry_count, discovered_at) 
    WHERE status IN ('pending', 'failed');

-- Enable RLS
ALTER TABLE scrape_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access on scrape_queue" 
    ON scrape_queue FOR ALL USING (true) WITH CHECK (true);

-- Admins can read
CREATE POLICY "Admins can read scrape_queue" 
    ON scrape_queue FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
