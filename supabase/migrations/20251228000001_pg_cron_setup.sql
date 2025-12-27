-- Migration: Set up pg_cron for midnight job discovery
-- Note: This requires pg_cron and pg_net extensions to be enabled in Supabase

-- Enable pg_net extension (for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the auto-discover-jobs function to run at midnight IST (18:30 UTC)
-- The cron.schedule function may need to be run manually in Supabase Dashboard
-- as pg_cron extension enablement requires dashboard access

-- Uncomment and run this in Supabase SQL Editor after enabling pg_cron:
/*
SELECT cron.schedule(
    'auto-discover-jobs-midnight',
    '30 18 * * *',  -- 18:30 UTC = 00:00 IST (midnight)
    $$
    SELECT net.http_post(
        url := (SELECT CONCAT(decrypted_secret, '/functions/v1/auto-discover-jobs') 
                FROM vault.decrypted_secrets 
                WHERE name = 'supabase_url'),
        headers := jsonb_build_object(
            'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'categories', ARRAY['SSC', 'UPSC', 'Banking', 'Railways', 'State PSC', 'Defence', 'Government Jobs']
        )
    );
    $$
);
*/

-- Alternative: If using Supabase's built-in cron via Dashboard,
-- create this function that can be called by the cron job:
CREATE OR REPLACE FUNCTION trigger_auto_discover_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- This will be called by pg_cron
    -- The actual HTTP call to the edge function should be set up in Supabase Dashboard
    -- under Database > Extensions > pg_cron
    RAISE NOTICE 'Auto-discover jobs triggered at %', NOW();
END;
$$;
