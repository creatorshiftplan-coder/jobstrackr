-- Migration: let inserters supply their own job slug
-- ==============================================================================
-- The Sheets sync computes a job's slug from its title up-front (matching this
-- function's algorithm) so it can build the Telegram deep-link before the row is
-- inserted. Previously `generate_job_slug` always regenerated the slug on INSERT
-- (the early-return only fired on UPDATE), so any slug the sync supplied was
-- discarded — and the DB's own collision counter could diverge from the link the
-- sync had already sent.
--
-- Make the trigger respect a non-NULL slug on INSERT. Rows that don't set a slug
-- (admin/scraper inserts) still auto-generate exactly as before. Callers that DO
-- set a slug are responsible for its uniqueness (the sync resolves collisions
-- against existing slugs before inserting); the UNIQUE index remains the backstop.

CREATE OR REPLACE FUNCTION generate_job_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Keep a caller-provided slug on INSERT, and on UPDATE when the title is
  -- unchanged. Only (re)generate when no slug was supplied or the title changed.
  IF NEW.slug IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.title IS NOT DISTINCT FROM OLD.title) THEN
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
