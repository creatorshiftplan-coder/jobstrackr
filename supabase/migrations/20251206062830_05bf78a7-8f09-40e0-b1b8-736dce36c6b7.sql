-- Add display columns for TBD-like values
ALTER TABLE public.jobs ADD COLUMN vacancies_display TEXT;
ALTER TABLE public.jobs ADD COLUMN last_date_display TEXT;