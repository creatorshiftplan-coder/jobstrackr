-- Migration: deterministic slug for exam_updates (+ slug-or-id detail lookup)
-- ==============================================================================
-- The Apps Script Telegram poster builds an in-app deep-link for each update
-- *from the sheet alone* — so it needs a slug it can compute up-front and that the
-- app can resolve. `exam_updates` previously had no slug (the /exam-update/:id
-- route looked rows up by UUID, which Apps Script never sees). This adds a `slug`
-- column the sync stores as-is when the sheet provides one, with a title-based
-- fallback for rows inserted without a slug (admin/scraper paths).
--
-- Note: this is the `exam_updates` table (sync target / id route), distinct from
-- the `exams.update_slug` used by the older /updates/:slug route.

ALTER TABLE public.exam_updates ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_updates_slug
  ON public.exam_updates (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_exam_update_slug()
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
  EXECUTE FUNCTION generate_exam_update_slug();

-- Backfill existing rows (NULL slug triggers generation on UPDATE).
UPDATE public.exam_updates SET slug = NULL WHERE slug IS NULL;
