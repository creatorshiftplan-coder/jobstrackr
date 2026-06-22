-- Repair job last-dates corrupted by the Google Sheet -> Apps Script sync.
--
-- The Apps Script feed used to blanket-serialize every date *cell* with
-- toISOString(), so a date typed as "2026-06-30" (midnight in the sheet's IST
-- timezone) came across as "2026-06-29T18:30:00.000Z" -- the wrong calendar day
-- and an ugly value to display. Those raw ISO strings were stored verbatim in the
-- TEXT columns. The feed (apps-script/Sheets.gs) and the sync function
-- (supabase/functions/sync-sheets) now emit/repair plain "YYYY-MM-DD"; this fixes
-- the rows already written.
--
-- 1. Collapse any full ISO datetime back to its IST calendar date.
-- 2. Backfill missing last_date from last_date_display (and vice versa), defaulting
--    to the scraper's "TBD" marker only when neither column has a real value.
--
-- The LIKE pattern '____-__-__T%' matches an ISO datetime ("YYYY-MM-DDThh:..."):
-- each underscore is one character, so it fires only on values that carry a "T"
-- time portion and leaves plain "2026-06-30" / "TBD" / "30 Jun 2026" untouched.

UPDATE public.jobs
SET last_date = to_char((last_date::timestamptz AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')
WHERE last_date LIKE '____-__-__T%';

UPDATE public.jobs
SET last_date_display = to_char((last_date_display::timestamptz AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')
WHERE last_date_display LIKE '____-__-__T%';

-- application_start_date is a real `date` column, so it never held the jumbled ISO
-- text and needs no repair here (only last_date / last_date_display are TEXT).

-- Backfill missing last_date from the display column, else mark TBD.
UPDATE public.jobs
SET last_date = COALESCE(NULLIF(TRIM(last_date_display), ''), 'TBD')
WHERE last_date IS NULL OR TRIM(last_date) = '';

-- Mirror a present last_date into an empty display column so cards have something to show.
UPDATE public.jobs
SET last_date_display = last_date
WHERE (last_date_display IS NULL OR TRIM(last_date_display) = '')
  AND last_date IS NOT NULL AND TRIM(last_date) <> '';
