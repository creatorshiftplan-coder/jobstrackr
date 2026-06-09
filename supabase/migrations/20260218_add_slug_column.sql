-- Migration: Add SEO slug column to jobs table
-- Auto-generates URL-friendly slugs from job titles

-- 1. Add slug column
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Create slug generation function
CREATE OR REPLACE FUNCTION generate_job_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Only generate if slug is null or title changed
  IF NEW.slug IS NOT NULL AND (TG_OP = 'UPDATE' AND NEW.title IS NOT DISTINCT FROM OLD.title) THEN
    RETURN NEW;
  END IF;

  -- Build slug: lowercase, strip non-alphanumeric (keep spaces), replace spaces with hyphens
  base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9 ]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  -- Truncate to 80 chars at a word boundary
  IF length(base_slug) > 80 THEN
    base_slug := left(base_slug, 80);
    -- Don't cut mid-word: trim trailing partial word
    IF position('-' in reverse(base_slug)) > 0 THEN
      base_slug := left(base_slug, length(base_slug) - position('-' in reverse(base_slug)));
    END IF;
  END IF;

  final_slug := base_slug;

  -- Handle collisions by appending a counter
  WHILE EXISTS (SELECT 1 FROM public.jobs WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger (fires on INSERT or when title changes on UPDATE)
DROP TRIGGER IF EXISTS set_job_slug ON public.jobs;
CREATE TRIGGER set_job_slug
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_job_slug();

-- 4. Backfill existing jobs that don't have slugs
-- Setting slug to NULL triggers the function to auto-generate
UPDATE public.jobs SET slug = NULL WHERE slug IS NULL;
