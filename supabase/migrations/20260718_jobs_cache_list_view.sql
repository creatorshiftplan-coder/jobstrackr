-- Slim jobs view for the cached public list endpoints (api/cache/jobs + homepage).
--
-- The list/card views only use a couple of small job_metadata fields
-- (salary_text, age_limit_text, ...). The heavy sub-objects — eligibility_profile
-- (parsed eligibility incl. raw source text), overview, selection_process,
-- vacancies_detail, important_dates — are never rendered in the list, yet the
-- cache refills were pulling the *entire* job_metadata (~96 full-table reads/day
-- across the jobs + homepage refills) and stripping those blobs in JS *after*
-- download. That download-then-discard was the dominant recurring PostgREST
-- egress source.
--
-- This view drops those same five sub-objects at the DB layer, so PostgREST
-- never ships them. Behaviour matches the previous in-JS strip exactly.
-- security_invoker = true → the view honours the querying role's RLS on jobs
-- (the existing "Jobs are viewable by everyone" SELECT policy), so anon reads
-- keep working without widening exposure.

CREATE OR REPLACE VIEW public.jobs_cache_list
WITH (security_invoker = true)
AS
SELECT
  id, slug, title, department, location,
  last_date, last_date_display, vacancies, vacancies_display,
  qualification, eligibility, experience,
  salary_min, salary_max, age_min, age_max,
  application_fee, is_featured, admin_refreshed_at,
  created_at, updated_at, tags, eligibility_summary, required_skills,
  official_website, apply_link, application_start_date,
  CASE
    WHEN job_metadata IS NULL THEN NULL
    ELSE job_metadata
      - 'eligibility_profile'
      - 'overview'
      - 'selection_process'
      - 'vacancies_detail'
      - 'important_dates'
  END AS job_metadata
FROM public.jobs;

GRANT SELECT ON public.jobs_cache_list TO anon, authenticated;
