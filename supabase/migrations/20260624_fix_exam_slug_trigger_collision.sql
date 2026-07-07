-- Migration: fix slug trigger function-name collision between `exams` and `exam_updates`
-- ==============================================================================
-- Two migrations defined a function named `generate_exam_update_slug()`:
--   * 20260218_add_exam_update_slug.sql — body for the `exams` table (NEW.update_slug),
--     wired to trigger `trg_generate_exam_update_slug` on public.exams.
--   * 20260613_exam_update_slug.sql — `CREATE OR REPLACE` of the SAME name, but a body
--     for the `exam_updates` table (NEW.slug / NEW.title / NEW.category), wired to
--     trigger `set_exam_update_slug` on public.exam_updates.
--
-- Because the second one reused the name with CREATE OR REPLACE, it overwrote the body
-- the `exams` trigger still calls. Every INSERT/UPDATE on `exams` then executed code
-- expecting `NEW.slug`, which does not exist on `exams`, raising:
--   ERROR: record "new" has no field "slug"
-- This broke "Track exam" (JobDetails.handleTrackExam inserts a new row into `exams`).
--
-- Fix: give each table its own dedicated function and repoint its trigger. No shared
-- function name remains, so neither table can clobber the other again.

-- 1. Dedicated function for the `exams` table (restores the update_slug body) ---------
CREATE OR REPLACE FUNCTION public.generate_exams_update_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  status_suffix TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  current_year TEXT;
  ai_data JSONB;
  combined_text TEXT;
BEGIN
  -- Only generate if name changed or slug is null
  IF NEW.update_slug IS NOT NULL AND (TG_OP = 'UPDATE' AND OLD.name = NEW.name AND OLD.ai_cached_response::text = NEW.ai_cached_response::text) THEN
    RETURN NEW;
  END IF;

  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Build base slug from exam name
  base_slug := lower(NEW.name);
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Determine status type from ai_cached_response
  ai_data := NEW.ai_cached_response;
  status_suffix := 'update';

  IF ai_data IS NOT NULL THEN
    combined_text := lower(COALESCE(ai_data->>'current_status', '') || ' ' || COALESCE(ai_data->>'summary', '') || ' ' || COALESCE(ai_data->>'exam_dates', ''));

    IF combined_text ~ '(result out|result declared|result released|results declared|results released|result announced|merit list|cutoff released)' THEN
      status_suffix := 'result';
    ELSIF combined_text ~ '(admit card released|admit card out|hall ticket released|hall ticket out|call letter released|e-admit card)' THEN
      status_suffix := 'admit-card';
    ELSIF combined_text ~ '(exam date released|exam date announced|exam dates released|exam dates announced)' THEN
      status_suffix := 'exam-date';
    ELSIF combined_text ~ '(exam scheduled|exam on|examination on|exam will be held|exam to be conducted)' THEN
      status_suffix := 'exam-scheduled';
    ELSIF combined_text ~ '(postponed|rescheduled|date changed|revised date|exam cancelled)' THEN
      status_suffix := 'date-change';
    ELSIF combined_text ~ '(apply now|apply online|registration started|notification released|notification out|recruitment notification)' THEN
      status_suffix := 'notification';
    ELSIF combined_text ~ '(answer key|answer sheet|response sheet|objection)' THEN
      status_suffix := 'answer-key';
    END IF;
  END IF;

  -- Truncate base slug to keep total under 80 chars
  base_slug := left(base_slug, 80 - length(status_suffix) - length(current_year) - 2);
  base_slug := trim(both '-' from base_slug);

  -- Combine: name-slug + status + year
  final_slug := base_slug || '-' || status_suffix || '-' || current_year;

  -- Handle collisions
  WHILE EXISTS (SELECT 1 FROM public.exams WHERE update_slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || status_suffix || '-' || current_year || '-' || counter;
  END LOOP;

  NEW.update_slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_exam_update_slug ON public.exams;
CREATE TRIGGER trg_generate_exam_update_slug
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_exams_update_slug();

-- 2. Dedicated function for the `exam_updates` table (keeps the slug body) ------------
CREATE OR REPLACE FUNCTION public.generate_exam_updates_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  suffix TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  yr TEXT;
BEGIN
  -- Keep a caller-supplied slug (the sheet poster owns it and resolves its own
  -- collisions). Only generate when none was provided.
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  yr := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  base_slug := lower(regexp_replace(COALESCE(NEW.title, ''), '[^a-zA-Z0-9 ]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Short type suffix so different update types for the same exam don't all
  -- collapse onto one slug (mirrors the poster's mapping).
  suffix := CASE
    WHEN lower(COALESCE(NEW.category,'') || ' ' || COALESCE(NEW.title,'')) ~ '(admit|hall ticket|call letter)' THEN 'admit-card'
    WHEN lower(COALESCE(NEW.category,'') || ' ' || COALESCE(NEW.title,'')) ~ '(result|cutoff|merit|scorecard)' THEN 'result'
    WHEN lower(COALESCE(NEW.category,'') || ' ' || COALESCE(NEW.title,'')) ~ '(answer key|response sheet)' THEN 'answer-key'
    ELSE 'update'
  END;

  base_slug := left(base_slug, 80 - length(suffix) - length(yr) - 2);
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug || '-' || suffix || '-' || yr;

  WHILE EXISTS (SELECT 1 FROM public.exam_updates WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || suffix || '-' || yr || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_exam_update_slug ON public.exam_updates;
CREATE TRIGGER set_exam_update_slug
  BEFORE INSERT OR UPDATE ON public.exam_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_exam_updates_slug();

-- 3. Retire the collided shared function so nothing references it anymore.
DROP FUNCTION IF EXISTS public.generate_exam_update_slug();
