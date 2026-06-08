-- Migration: Set up RPC for pre-filtering eligible jobs for recommendations and add embedding status columns
-- ==================================================================================================

-- 1. Add tracking columns to jobs table to handle deferred embeddings and retry safety
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS embedding_attempts INT DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS embedding_error TEXT;

-- 2. Create RPC function for pre-filtering eligible jobs
CREATE OR REPLACE FUNCTION public.recommend_jobs_for_user_prefilter(
  p_user_id UUID,
  p_limit INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  department TEXT,
  location TEXT,
  qualification TEXT,
  eligibility TEXT,
  description TEXT,
  salary_min INT,
  salary_max INT,
  age_min INT,
  age_max INT,
  vacancies INT,
  last_date TEXT,
  apply_link TEXT,
  created_at TIMESTAMPTZ,
  tags TEXT[],
  vector_distance FLOAT
) 
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user_age INT;
  v_user_gender TEXT;
  v_user_category TEXT;
  v_user_qual_level NUMERIC;
  v_user_embedding vector(384);
BEGIN
  -- Fetch user profile data
  SELECT 
    EXTRACT(YEAR FROM AGE(now(), p.date_of_birth))::INT,
    p.gender,
    p.category,
    p.embedding
  INTO 
    v_user_age, v_user_gender, v_user_category, v_user_embedding
  FROM public.profiles p
  WHERE p.user_id = p_user_id; -- Note: user_id is the foreign key reference in profiles table

  -- Fetch user highest qualification level
  SELECT 
    CASE qualification_type
      WHEN 'phd' THEN 6.0
      WHEN 'post_graduation' THEN 5.0
      WHEN 'graduation' THEN 4.0
      WHEN 'diploma' THEN 3.5
      WHEN 'iti' THEN 3.0
      WHEN '12th' THEN 3.0
      WHEN '10th' THEN 2.0
      WHEN '8th' THEN 1.0
      ELSE 0.0
    END
  INTO v_user_qual_level
  FROM public.education
  WHERE user_id = p_user_id
  ORDER BY qualification_type DESC -- simple approximation of highest qualification
  LIMIT 1;

  -- Return eligible active jobs
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.department,
    j.location,
    j.qualification,
    j.eligibility,
    j.description,
    j.salary_min,
    j.salary_max,
    j.age_min,
    j.age_max,
    j.vacancies,
    j.last_date::TEXT,
    j.apply_link,
    j.created_at,
    j.tags,
    (CASE 
      WHEN v_user_embedding IS NOT NULL AND j.embedding IS NOT NULL 
      THEN (j.embedding <=> v_user_embedding)::FLOAT
      ELSE 1.0::FLOAT
     END) as vector_distance
  FROM public.jobs j
  WHERE 
    -- Active jobs (not expired)
    (j.last_date IS NULL OR j.last_date::DATE >= CURRENT_DATE)
    
    -- Hard Age Boundaries (allowing category relaxation: OBC +3 years, SC/ST +5 years)
    AND (
      v_user_age IS NULL 
      OR j.age_min IS NULL 
      OR v_user_age >= j.age_min
    )
    AND (
      v_user_age IS NULL 
      OR j.age_max IS NULL 
      OR v_user_age <= (j.age_max + CASE 
                                     WHEN v_user_category = 'OBC' THEN 3 
                                     WHEN v_user_category IN ('SC','ST') THEN 5 
                                     ELSE 0 
                                   END)
    )
    
    -- Hard Gender boundaries (check if job title specifies a gender constraint)
    AND (
      v_user_gender IS NULL
      OR NOT (LOWER(j.title) LIKE '%female only%' AND LOWER(v_user_gender) != 'female')
      OR NOT (LOWER(j.title) LIKE '%male only%' AND LOWER(v_user_gender) != 'male')
    )
  ORDER BY 
    -- Sort by vector distance if we have an embedding, otherwise fallback to recency
    (CASE 
      WHEN v_user_embedding IS NOT NULL AND j.embedding IS NOT NULL 
      THEN (j.embedding <=> v_user_embedding)::FLOAT
      ELSE 1.0::FLOAT
     END) ASC,
    j.created_at DESC
  LIMIT p_limit;
END;
$$;
