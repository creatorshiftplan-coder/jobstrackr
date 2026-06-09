-- Function to get API call counts for all users (for admin stats)
-- This is more efficient than fetching all logs and counting in JS
CREATE OR REPLACE FUNCTION public.get_user_api_call_counts()
RETURNS TABLE (user_id UUID, api_call_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    combined.user_id,
    COUNT(*)::BIGINT as api_call_count
  FROM (
    -- AI Job Search logs
    SELECT ajl.user_id FROM ai_job_discover_logs ajl WHERE ajl.user_id IS NOT NULL
    UNION ALL
    -- AI Exam Search logs
    SELECT ael.user_id FROM ai_exam_discover_logs ael WHERE ael.user_id IS NOT NULL
    UNION ALL
    -- OCR API calls from update_logs
    SELECT ul.user_id FROM update_logs ul WHERE ul.source = 'ocr' AND ul.user_id IS NOT NULL
  ) combined
  GROUP BY combined.user_id;
END;
$$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION public.get_user_api_call_counts() TO authenticated;
