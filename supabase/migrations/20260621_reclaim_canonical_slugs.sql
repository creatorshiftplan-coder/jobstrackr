-- Migration: reclaim canonical job slugs orphaned by the dedupe collapse
-- ==============================================================================
-- 20260620_jobs_dedupe_key.sql collapsed duplicate jobs but kept the NEWEST row
-- per group. When a job had been inserted twice, the newer copy carried the
-- collision-suffixed slug (`…-apply-online-1`) while the older copy held the
-- canonical slug (`…-apply-online`) that was already indexed and deep-linked.
-- Keeping the newer row therefore deleted the canonical-slug row, so every
-- existing URL began returning 406 (the row no longer exists).
--
-- The surviving rows are still here, just under their `-N` slugs. This migration
-- hands each survivor its canonical slug back when that slug is now free. The base
-- is re-derived from the TITLE using the exact `generate_job_slug` algorithm, so a
-- trailing year (…-2026) is part of the base and is never mistaken for a collision
-- counter — only a `-<digits>` tail *beyond* the title-derived base is stripped.
-- Genuine collisions between two different-titled jobs keep their suffix because
-- their base slug is still taken.

WITH raw AS (
  SELECT
    id, slug,
    -- base slug from title: strip non-alphanumerics (keep spaces), lowercase,
    -- spaces → hyphens, collapse repeats, trim leading/trailing hyphens.
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(regexp_replace(title, '[^a-zA-Z0-9 ]', '', 'g')), '\s+', '-', 'g'),
        '-+', '-', 'g'),
      '^-|-$', '', 'g')
    ) AS b
  FROM public.jobs
),
cand AS (
  SELECT
    id, slug,
    -- mirror generate_job_slug's 80-char word-boundary truncation
    CASE
      WHEN length(b) > 80 AND position('-' in reverse(left(b, 80))) > 0
        THEN left(b, 80 - position('-' in reverse(left(b, 80))))
      WHEN length(b) > 80
        THEN left(b, 80)
      ELSE b
    END AS base
  FROM raw
),
match AS (
  SELECT id, base
  FROM cand
  WHERE base <> ''
    AND slug <> base
    AND left(slug, length(base)) = base                       -- slug starts with the canonical base
    AND substring(slug FROM length(base) + 1) ~ '^-[0-9]+$'    -- followed only by a -<counter> tail
    AND NOT EXISTS (SELECT 1 FROM public.jobs o WHERE o.slug = base)  -- canonical slug is free
),
pick AS (
  -- if two suffixed rows could claim the same freed base, give it to exactly one
  SELECT DISTINCT ON (base) id, base FROM match ORDER BY base, id
)
UPDATE public.jobs j
   SET slug = p.base
  FROM pick p
 WHERE j.id = p.id;
