-- ===================================================================================
-- EMERGENCY FIX: Disable heavy triggers causing statement timeouts and DB lockup
-- ===================================================================================
-- Run this IMMEDIATELY in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ===================================================================================

-- ============================================================
-- STEP 1: DROP the heavy triggers causing cascading timeouts
-- ============================================================

-- These triggers fire on EVERY job insert and loop through ALL users
-- doing complex LIKE matching, which is extremely expensive
DROP TRIGGER IF EXISTS on_job_inserted ON public.jobs;
DROP TRIGGER IF EXISTS on_job_inserted_queue ON public.jobs;

-- Same for exam_updates
DROP TRIGGER IF EXISTS on_exam_update_inserted ON public.exam_updates;
DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;

-- ============================================================
-- STEP 2: FIX numeric field overflow (age columns)
-- ============================================================
-- Current: NUMERIC(4,1) = max 999.9 → AI sometimes returns garbage values >= 1000
-- Fix: Widen to NUMERIC(5,1) = max 9999.9 AND add CHECK constraints for valid age range

ALTER TABLE public.jobs ALTER COLUMN age_min TYPE NUMERIC(5,1);
ALTER TABLE public.jobs ALTER COLUMN age_max TYPE NUMERIC(5,1);

-- Add constraint to reject nonsensical age values (must be between 1 and 100)
-- Drop if exists first to avoid conflict
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_age_min_range;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_age_max_range;
ALTER TABLE public.jobs ADD CONSTRAINT chk_age_min_range CHECK (age_min IS NULL OR (age_min >= 1 AND age_min <= 100));
ALTER TABLE public.jobs ADD CONSTRAINT chk_age_max_range CHECK (age_max IS NULL OR (age_max >= 1 AND age_max <= 100));

-- ============================================================
-- STEP 3: FIX integer overflow for salary and vacancies
-- ============================================================
-- "39915963395" is out of range for INTEGER (max 2,147,483,647)
-- Salary columns can receive large values from AI (annual salary, etc.)
-- Change salary columns to BIGINT to handle any value

ALTER TABLE public.jobs ALTER COLUMN salary_min TYPE BIGINT;
ALTER TABLE public.jobs ALTER COLUMN salary_max TYPE BIGINT;

-- Vacancies column: keep as INTEGER but add a sanity check
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_vacancies_range;
ALTER TABLE public.jobs ADD CONSTRAINT chk_vacancies_range CHECK (vacancies IS NULL OR (vacancies >= 0 AND vacancies <= 10000000));

-- ============================================================
-- STEP 4: RE-CREATE LIGHTWEIGHT TRIGGERS (async-only, no loops)
-- ============================================================
-- These triggers ONLY fire a single async HTTP call via pg_net.
-- They do NOT loop through users or do complex matching.
-- The edge function handles all logic asynchronously.

-- 4a. Lightweight job insert trigger (auto-post to public channels only)
CREATE OR REPLACE FUNCTION public.trigger_telegram_auto_post()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Only fire if vault secrets are configured; fail silently otherwise
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
  -- Never let a trigger failure block the INSERT
  RAISE WARNING 'telegram auto-post trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_job_inserted
    AFTER INSERT ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_telegram_auto_post();

-- 4b. Lightweight exam update insert trigger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_exam_update_inserted
    AFTER INSERT ON public.exam_updates
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_telegram_auto_post_for_update();

-- ============================================================
-- STEP 5: RE-CREATE USER NOTIFICATION TRIGGERS (LIGHTWEIGHT)
-- ============================================================
-- The old trigger did ALL matching inside PL/pgSQL with nested loops.
-- New approach: just fire a single async HTTP call to the edge function
-- which will handle user matching efficiently in Deno.

CREATE OR REPLACE FUNCTION public.process_job_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-telegram-queue',
      headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'job',
        'job_id', NEW.id,
        'title', NEW.title,
        'department', NEW.department,
        'location', NEW.location,
        'qualification', NEW.qualification,
        'vacancies_display', COALESCE(NEW.vacancies_display, NEW.vacancies::TEXT, 'Not Published'),
        'last_date_display', COALESCE(NEW.last_date_display, NEW.last_date::TEXT, 'Check Website'),
        'slug', NEW.slug
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'job notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_job_inserted_queue
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.process_job_notification_trigger();

-- Exam update notification trigger (lightweight)
CREATE OR REPLACE FUNCTION public.process_exam_update_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-telegram-queue',
      headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'exam_update',
        'update_id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'summary', NEW.summary
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'exam update notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_exam_update_inserted_queue
  AFTER INSERT ON public.exam_updates
  FOR EACH ROW EXECUTE FUNCTION public.process_exam_update_notification_trigger();
