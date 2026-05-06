-- Add job_metadata JSONB column to store extra scraped data
-- (vacancy breakdowns, application fees, selection process, important dates, etc.)
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS job_metadata JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN jobs.job_metadata IS 'Stores additional scraped metadata: vacancies_detail, application_fees, selection_process, important_dates, overview, salary_text, age_limit_text, notification_pdf, employment_type, exam_date';
