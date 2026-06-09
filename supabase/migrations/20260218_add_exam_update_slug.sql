-- ============================================================
-- Migration: Add update_slug column to exams table
-- Purpose: SEO-friendly slugs for /updates/:slug pages
-- ============================================================

-- 1. Add the update_slug column
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS update_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_update_slug ON public.exams(update_slug) WHERE update_slug IS NOT NULL;

-- 2. Create trigger function to auto-generate update slugs
CREATE OR REPLACE FUNCTION generate_exam_update_slug()
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

-- 3. Create trigger
DROP TRIGGER IF EXISTS trg_generate_exam_update_slug ON public.exams;
CREATE TRIGGER trg_generate_exam_update_slug
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION generate_exam_update_slug();

-- 4. Backfill existing exams
UPDATE public.exams SET update_slug = NULL WHERE update_slug IS NULL;
