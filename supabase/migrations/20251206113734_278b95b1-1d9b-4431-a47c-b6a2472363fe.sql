-- Allow authenticated users to insert new exams
-- This enables users to add jobs from the job listings to their exam tracker
-- UPDATE and DELETE remain admin-only for security
CREATE POLICY "Authenticated users can create exams"
ON public.exams
FOR INSERT
TO authenticated
WITH CHECK (true);