-- Add eligibility_summary and required_skills columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS eligibility_summary TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]'::jsonb;
