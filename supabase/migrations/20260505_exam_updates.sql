-- Migration: Exam Updates scraper tables, RLS, seed data, and cron setup
-- =======================================================================

-- 1. scraper_sources — admin-managed listing page URLs
CREATE TABLE IF NOT EXISTS scraper_sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    limit_per_run INTEGER NOT NULL DEFAULT 6,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. exam_updates — scraped exam content (upsert on url)
CREATE TABLE IF NOT EXISTS exam_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id UUID REFERENCES scraper_sources(id) ON DELETE SET NULL,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'news',
    status TEXT,
    published_date TEXT,
    summary TEXT,
    important_dates JSONB DEFAULT '[]'::jsonb,
    overview JSONB DEFAULT '[]'::jsonb,
    download_links JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    sections JSONB DEFAULT '[]'::jsonb,
    related_articles JSONB DEFAULT '[]'::jsonb,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. scraper_run_logs — execution logs
CREATE TABLE IF NOT EXISTS scraper_run_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id UUID REFERENCES scraper_sources(id) ON DELETE SET NULL,
    category TEXT,
    articles_found INTEGER DEFAULT 0,
    articles_scraped INTEGER DEFAULT 0,
    articles_new INTEGER DEFAULT 0,
    articles_updated INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_details TEXT,
    latency_ms INTEGER,
    is_cron BOOLEAN DEFAULT false,
    is_manual BOOLEAN DEFAULT false,
    run_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_exam_updates_category ON exam_updates(category);
CREATE INDEX IF NOT EXISTS idx_exam_updates_scraped_at ON exam_updates(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_updates_source_id ON exam_updates(source_id);
CREATE INDEX IF NOT EXISTS idx_scraper_run_logs_run_at ON scraper_run_logs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_sources_active ON scraper_sources(is_active) WHERE is_active = true;

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE scraper_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_run_logs ENABLE ROW LEVEL SECURITY;

-- scraper_sources: admins full access, service role full access
CREATE POLICY "Admins can view scraper_sources" ON scraper_sources
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );
CREATE POLICY "Admins can insert scraper_sources" ON scraper_sources
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Admins can update scraper_sources" ON scraper_sources
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Admins can delete scraper_sources" ON scraper_sources
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- exam_updates: admins can read/update/delete, service role can insert/update
CREATE POLICY "Admins can view exam_updates" ON exam_updates
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );
CREATE POLICY "Admins can update exam_updates" ON exam_updates
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Admins can delete exam_updates" ON exam_updates
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Service role can insert exam_updates" ON exam_updates
    FOR INSERT WITH CHECK (true);

-- scraper_run_logs: admins can read, service role can insert
CREATE POLICY "Admins can view scraper_run_logs" ON scraper_run_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );
CREATE POLICY "Service role can insert scraper_run_logs" ON scraper_run_logs
    FOR INSERT WITH CHECK (true);

-- ─── Seed data: built-in categories ──────────────────────────────────

INSERT INTO scraper_sources (name, url, category, is_active, limit_per_run) VALUES
    ('Admit Cards',  'https://www.freejobalert.com/admit-card/',            'admit_card',  true, 6),
    ('Results',      'https://www.freejobalert.com/exam-results/',          'result',      true, 6),
    ('Answer Keys',  'https://www.freejobalert.com/answer-key/',            'answer_key',  true, 6),
    ('Latest',       'https://www.freejobalert.com/latest-notifications/',  'latest',      true, 6),
    ('Syllabus',     'https://www.freejobalert.com/syllabus/',              'syllabus',    true, 6)
ON CONFLICT (url) DO NOTHING;

-- ─── pg_cron setup (requires pg_net extension) ───────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job: run at midnight IST (18:30 UTC) daily
-- NOTE: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- Run this in the SQL Editor after enabling pg_cron:
/*
SELECT cron.schedule(
    'govtjob-scraper-daily',
    '30 18 * * *',
    $$
    SELECT net.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/govtjob-scraper')
                FROM vault.decrypted_secrets
                WHERE name = 'supabase_url'),
        headers := jsonb_build_object(
            'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
            'Content-Type', 'application/json'
        ),
        body := '{"mode": "cron"}'::jsonb
    );
    $$
);
*/
