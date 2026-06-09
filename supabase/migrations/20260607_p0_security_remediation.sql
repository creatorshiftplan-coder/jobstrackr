-- ==============================================================================
-- Migration: P0 Security Remediation and Database Hardening
-- ==============================================================================

-- 1. Secure documents storage bucket permissions (Make Private)
UPDATE storage.buckets SET public = false WHERE id = 'documents';
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;

-- 2. Drop insecure FOR INSERT WITH CHECK (true) policies (Service Role automatically bypasses RLS)
DROP POLICY IF EXISTS "Service role can insert exam_updates" ON public.exam_updates;
DROP POLICY IF EXISTS "Service role can insert scraper_run_logs" ON public.scraper_run_logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.update_logs;
DROP POLICY IF EXISTS "System can insert discover logs" ON public.ai_exam_discover_logs;
DROP POLICY IF EXISTS "System can insert job discover logs" ON public.ai_job_discover_logs;
DROP POLICY IF EXISTS "Service role can insert auto discover logs" ON public.auto_discover_logs;

-- 3. Add secure admin insert policy for exam_updates (Prevents breaking Admin manual crawls)
CREATE POLICY "Admins can insert exam_updates" ON public.exam_updates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- 4. Redefine security definer functions with explicit SET search_path = public

-- 4a. trigger_telegram_auto_post
CREATE OR REPLACE FUNCTION public.trigger_telegram_auto_post()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/telegram-auto-post',
      headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('job', row_to_json(NEW)::jsonb)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'telegram auto-post trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4b. trigger_telegram_auto_post_for_update
CREATE OR REPLACE FUNCTION public.trigger_telegram_auto_post_for_update()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/telegram-auto-post',
      headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('exam_update', row_to_json(NEW)::jsonb)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'telegram auto-post (update) trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4c. invoke_telegram_queue_processor
CREATE OR REPLACE FUNCTION public.invoke_telegram_queue_processor()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := CONCAT(supabase_url, '/functions/v1/process-telegram-queue'),
      headers := jsonb_build_object(
          'Authorization', CONCAT('Bearer ', service_role_key),
          'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4d. get_unreviewed_auto_discover_count
CREATE OR REPLACE FUNCTION public.get_unreviewed_auto_discover_count()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(jobs_inserted), 0)::INTEGER
    FROM public.auto_discover_logs
    WHERE reviewed = false AND jobs_inserted > 0;
$$;

-- 5. Recreate decrypted_api_keys_config view with security_invoker = on to enforce table-level RLS policies
CREATE OR REPLACE VIEW public.decrypted_api_keys_config 
WITH (security_invoker = on) AS
SELECT
  id,
  provider,
  model_name,
  is_active,
  priority,
  label,
  last_used_at,
  last_error,
  total_calls,
  total_errors,
  created_at,
  updated_at,
  public.decrypt_api_key(api_key) AS api_key
FROM public.api_keys_config;
