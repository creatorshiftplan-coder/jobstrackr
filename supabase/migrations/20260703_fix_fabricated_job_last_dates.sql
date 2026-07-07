-- Fix fabricated job application deadlines ("last_date = scrape date + 365 days").
--
-- ROOT CAUSE: api/lib/job_insert_helper.py parse_date_safe() used to fall back to
-- `today + 365 days` whenever a deadline was missing / "TBD" / unparseable, so the
-- job would still count as "active". That fabricated date was written to `last_date`
-- and then rendered as a REAL application deadline — on the Exam Calendar's
-- Deadlines view, job cards, and the recommendations feed. ~63% of jobs (2,790 of
-- 4,430) ended up with a bogus deadline exactly one year after they were scraped.
-- The Python helper now returns the "TBD" sentinel for last_date and NULL for
-- application_start_date instead of inventing a date.
--
-- This migration does two things:
--   (A) Hardens recommend_jobs_for_user_prefilter so a non-ISO last_date ("TBD" or
--       any free text) is treated as ACTIVE instead of raising on `::DATE`. Without
--       this, replacing fabricated dates with "TBD" would break the RPC — and it
--       already made the ~15 pre-existing "TBD" rows fragile.
--   (B) Backfills the already-corrupted rows: fabricated last_dates → "TBD",
--       fabricated application_start_dates → NULL. Gated tightly (auto-discovered,
--       ISO-formatted, and dated ~1 year after created_at) so genuine deadlines are
--       left untouched. "TBD" keeps these jobs active (isJobActive / the hardened
--       RPC both treat a non-ISO last_date as active) — same visibility as before,
--       but without a false deadline.

-- ─────────────────────────────────────────────────────────────────────────────
-- (A) Harden the prefilter RPC's expiry check (only the last_date predicate on
--     line ~97 changes vs. 20260608_jobs_recommendations_rpc.sql; the rest is a
--     verbatim CREATE OR REPLACE so the signature and behaviour are preserved).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recommend_jobs_for_user_prefilter(
  p_user_id UUID,
  p_limit INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  department TEXT,
  location TEXT,
  qualification TEXT,
  eligibility TEXT,
  description TEXT,
  salary_min INT,
  salary_max INT,
  age_min INT,
  age_max INT,
  vacancies INT,
  last_date TEXT,
  apply_link TEXT,
  created_at TIMESTAMPTZ,
  tags TEXT[],
  vector_distance FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user_age INT;
  v_user_gender TEXT;
  v_user_category TEXT;
  v_user_qual_level NUMERIC;
  v_user_embedding vector(384);
BEGIN
  -- Fetch user profile data
  SELECT
    EXTRACT(YEAR FROM AGE(now(), p.date_of_birth))::INT,
    p.gender,
    p.category,
    p.embedding
  INTO
    v_user_age, v_user_gender, v_user_category, v_user_embedding
  FROM public.profiles p
  WHERE p.user_id = p_user_id; -- Note: user_id is the foreign key reference in profiles table

  -- Fetch user highest qualification level
  SELECT
    CASE qualification_type
      WHEN 'phd' THEN 6.0
      WHEN 'post_graduation' THEN 5.0
      WHEN 'graduation' THEN 4.0
      WHEN 'diploma' THEN 3.5
      WHEN 'iti' THEN 3.0
      WHEN '12th' THEN 3.0
      WHEN '10th' THEN 2.0
      WHEN '8th' THEN 1.0
      ELSE 0.0
    END
  INTO v_user_qual_level
  FROM public.education
  WHERE user_id = p_user_id
  ORDER BY qualification_type DESC -- simple approximation of highest qualification
  LIMIT 1;

  -- Return eligible active jobs
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.department,
    j.location,
    j.qualification,
    j.eligibility,
    j.description,
    j.salary_min,
    j.salary_max,
    j.age_min,
    j.age_max,
    j.vacancies,
    j.last_date::TEXT,
    j.apply_link,
    j.created_at,
    j.tags,
    (CASE
      WHEN v_user_embedding IS NOT NULL AND j.embedding IS NOT NULL
      THEN (j.embedding <=> v_user_embedding)::FLOAT
      ELSE 1.0::FLOAT
     END) as vector_distance
  FROM public.jobs j
  WHERE
    -- Active jobs (not expired). Only ISO YYYY-MM-DD values are date-comparable;
    -- "TBD"/free-text deadlines are unknown, not expired, so treat them as active
    -- (matches the frontend isJobActive). Guarding the cast also stops 'TBD'::DATE
    -- from raising and aborting the whole query.
    (
      j.last_date IS NULL
      OR j.last_date !~ '^\d{4}-\d{2}-\d{2}$'
      OR j.last_date::DATE >= CURRENT_DATE
    )

    -- Hard Age Boundaries (allowing category relaxation: OBC +3 years, SC/ST +5 years)
    AND (
      v_user_age IS NULL
      OR j.age_min IS NULL
      OR v_user_age >= j.age_min
    )
    AND (
      v_user_age IS NULL
      OR j.age_max IS NULL
      OR v_user_age <= (j.age_max + CASE
                                     WHEN v_user_category = 'OBC' THEN 3
                                     WHEN v_user_category IN ('SC','ST') THEN 5
                                     ELSE 0
                                   END)
    )

    -- Hard Gender boundaries (check if job title specifies a gender constraint)
    AND (
      v_user_gender IS NULL
      OR NOT (LOWER(j.title) LIKE '%female only%' AND LOWER(v_user_gender) != 'female')
      OR NOT (LOWER(j.title) LIKE '%male only%' AND LOWER(v_user_gender) != 'male')
    )
  ORDER BY
    -- Sort by vector distance if we have an embedding, otherwise fallback to recency
    (CASE
      WHEN v_user_embedding IS NOT NULL AND j.embedding IS NOT NULL
      THEN (j.embedding <=> v_user_embedding)::FLOAT
      ELSE 1.0::FLOAT
     END) ASC,
    j.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) Backfill the fabricated deadlines already in the table.
--     Signal: auto-discovered row, ISO-formatted last_date, dated ~1 year after
--     it was created (the old `now + 365d` fallback). The 360–372 window absorbs
--     leap-day / timezone drift while staying far from genuine near-term deadlines.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.jobs
SET last_date = 'TBD',
    last_date_display = 'TBD'
WHERE auto_discovered = TRUE
  AND last_date ~ '^\d{4}-\d{2}-\d{2}$'
  AND (last_date::DATE - created_at::DATE) BETWEEN 360 AND 372;

-- application_start_date is a real DATE column — fabricated ones become NULL.
UPDATE public.jobs
SET application_start_date = NULL
WHERE auto_discovered = TRUE
  AND application_start_date IS NOT NULL
  AND (application_start_date - created_at::DATE) BETWEEN 360 AND 372;
