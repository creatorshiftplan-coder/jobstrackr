-- Cache AI-generated syllabus search results
CREATE TABLE IF NOT EXISTS public.syllabus_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_name text NOT NULL UNIQUE,
  syllabus_data jsonb NOT NULL,
  source_urls text[] DEFAULT '{}',
  year integer,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.syllabus_cache ENABLE ROW LEVEL SECURITY;

-- Public can read cached syllabus results, but writes happen through service role edge functions.
CREATE POLICY "Anyone can read syllabus cache"
  ON public.syllabus_cache
  FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Service role can manage syllabus cache"
  ON public.syllabus_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_syllabus_cache_exam_name
  ON public.syllabus_cache (exam_name);

CREATE INDEX IF NOT EXISTS idx_syllabus_cache_expires_at
  ON public.syllabus_cache (expires_at);
