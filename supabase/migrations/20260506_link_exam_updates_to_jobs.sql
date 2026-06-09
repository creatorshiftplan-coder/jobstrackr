-- Migration: Link exam_updates to jobs & exams, add public read, auto-match function
-- ==================================================================================

-- 1. Add job_id FK so scraped articles are linked to job listings
ALTER TABLE exam_updates ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exam_updates_job_id ON exam_updates(job_id);

-- 2. Add exam_id FK so scraped articles can be linked to tracked exams
ALTER TABLE exam_updates ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exam_updates_exam_id ON exam_updates(exam_id);

-- 3. Allow authenticated users to read exam_updates (currently admin-only)
CREATE POLICY "Authenticated users can view exam_updates" ON exam_updates
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Add job_id to exams table so tracked exams reference the source job
ALTER TABLE exams ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exams_job_id ON exams(job_id);

-- 5. DB function: auto-match an exam_update title to a job (called from scraper)
--    Uses simple keyword extraction + ILIKE search
CREATE OR REPLACE FUNCTION match_exam_update_to_job(update_title TEXT)
RETURNS UUID AS $$
DECLARE
    matched_job_id UUID;
    clean_title TEXT;
BEGIN
    -- Normalize the title: lowercase, strip common exam-update suffixes
    clean_title := lower(trim(update_title));
    clean_title := regexp_replace(clean_title, '\s*(admit card|result|answer key|syllabus|exam pattern|notification|recruitment|apply online|released|out now|available|declared|download|hall ticket|call letter|scorecard|cut\s*off|merit list|marks|upcoming|soon|live now)\s*', ' ', 'gi');
    clean_title := trim(regexp_replace(clean_title, '\s+', ' ', 'g'));

    -- If the cleaned title is too short, skip matching
    IF length(clean_title) < 4 THEN
        RETURN NULL;
    END IF;

    -- Try exact substring match first (most reliable)
    SELECT id INTO matched_job_id
    FROM jobs
    WHERE lower(title) ILIKE '%' || clean_title || '%'
    ORDER BY created_at DESC
    LIMIT 1;

    IF matched_job_id IS NOT NULL THEN
        RETURN matched_job_id;
    END IF;

    -- Try matching the other way: job title contained in update title
    SELECT id INTO matched_job_id
    FROM jobs
    WHERE lower(update_title) ILIKE '%' || lower(title) || '%'
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN matched_job_id;
END;
$$ LANGUAGE plpgsql STABLE;
