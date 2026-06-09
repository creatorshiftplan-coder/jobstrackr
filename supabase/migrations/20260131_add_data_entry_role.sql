-- Add 'data_entry' role to the app_role enum
-- This role has limited admin access (Jobs, Logos, Bulk, Auto tabs only)

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'data_entry';

-- Create a helper function to check for any admin-level role
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'data_entry')
  )
$$;

-- Create a function to get the user's admin role type
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role IN ('admin', 'data_entry')
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'data_entry' THEN 2 
    END
  LIMIT 1
$$;

-- Update RLS policies to allow data_entry users to manage jobs
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON public.jobs;

-- Recreate policies with support for data_entry role
CREATE POLICY "Admins can insert jobs"
ON public.jobs
FOR INSERT
WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can update jobs"
ON public.jobs
FOR UPDATE
USING (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can delete jobs"
ON public.jobs
FOR DELETE
USING (public.has_any_admin_role(auth.uid()));
