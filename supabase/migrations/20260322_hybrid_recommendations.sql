-- ═══════════════════════════════════════════════════════════════════════
-- Hybrid Recommendation Engine: pgvector + tags
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Add tags and embedding columns to jobs
alter table jobs add column if not exists tags text[];
alter table jobs add column if not exists embedding vector(384);

-- 3. Add embedding column to profiles
alter table profiles add column if not exists embedding vector(384);

-- 4. Indexes
create index if not exists jobs_tags_idx on jobs using gin(tags);

-- HNSW index: better recall than IVFFlat for <30K rows, no training needed
create index if not exists jobs_embedding_idx
on jobs using hnsw (embedding vector_cosine_ops);

-- 5. RPC: Refine top-N pre-filtered jobs using vector similarity
create or replace function vector_refine_jobs(
  job_ids uuid[],
  query_embedding vector(384),
  match_limit int default 10
)
returns table (
  id uuid,
  title text,
  department text,
  distance float
)
language sql stable
as $$
  select j.id, j.title, j.department,
         j.embedding <=> query_embedding as distance
  from jobs j
  where j.id = any(job_ids)
    and j.embedding is not null
  order by distance asc
  limit match_limit;
$$;

-- 6. RPC: Find similar jobs to a given job (nearest neighbors)
create or replace function similar_jobs(
  p_job_id uuid,
  match_limit int default 5
)
returns table (
  id uuid,
  title text,
  department text,
  location text,
  last_date text,
  vacancies int,
  qualification text,
  slug text,
  distance float
)
language sql stable
as $$
  select j2.id, j2.title, j2.department, j2.location,
         j2.last_date::text, j2.vacancies, j2.qualification, j2.slug,
         j2.embedding <=> j1.embedding as distance
  from jobs j1
  join jobs j2 on j1.id != j2.id
  where j1.id = p_job_id
    and j1.embedding is not null
    and j2.embedding is not null
  order by distance asc
  limit match_limit;
$$;
