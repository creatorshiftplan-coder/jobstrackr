-- Migration: Allow public/anonymous users to read exam_updates table
-- This is necessary because exam updates are fetched by the public Trending page and by cache API endpoints anonymously.

DROP POLICY IF EXISTS "Authenticated users can view exam_updates" ON exam_updates;
DROP POLICY IF EXISTS "Admins can view exam_updates" ON exam_updates;

CREATE POLICY "Exam updates are viewable by everyone" ON exam_updates
    FOR SELECT USING (true);
