-- Add missing fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ews_certificate_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ews_issuing_authority text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disability_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disability_certificate_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS caste_issuing_authority text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS caste_issue_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS left_thumb_url text;

-- Create education_qualifications table
CREATE TABLE public.education_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  qualification_type text NOT NULL,
  qualification_name text,
  board_university text,
  institute_name text,
  date_of_passing date,
  marks_obtained numeric,
  maximum_marks numeric,
  percentage numeric,
  cgpa numeric,
  roll_number text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on education_qualifications
ALTER TABLE public.education_qualifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for education_qualifications
CREATE POLICY "Users can view their own education"
ON public.education_qualifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own education"
ON public.education_qualifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own education"
ON public.education_qualifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own education"
ON public.education_qualifications FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_education_qualifications_updated_at
BEFORE UPDATE ON public.education_qualifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();