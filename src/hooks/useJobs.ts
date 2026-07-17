import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

interface UseJobsOptions {
  enabled?: boolean;
  bypassCache?: boolean;
}

/**
 * Every column the SPA `Job` type consumes — used for single-job detail reads.
 * Deliberately excludes the heavy `embedding` vector (and its bookkeeping
 * columns), which the UI never renders; `select("*")` was pulling it on every
 * job-detail view. Keeps `job_metadata` because the detail page renders it.
 */
const JOB_DETAIL_COLS =
  "id, slug, title, department, location, salary_min, salary_max, age_min, age_max, " +
  "application_fee, qualification, experience, vacancies, vacancies_display, " +
  "application_start_date, last_date, last_date_display, description, eligibility, " +
  "apply_link, official_website, is_featured, admin_refreshed_at, job_metadata, " +
  "created_at, updated_at, tags, eligibility_summary, required_skills";

export function useJobs(options: UseJobsOptions = {}) {
  const { enabled = true, bypassCache = false } = options;

  return useQuery({
    queryKey: bypassCache ? ["jobs", "bypass-cache"] : ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      if (bypassCache) {
        const columns = [
          "id", "slug", "title", "department", "location",
          "last_date", "last_date_display", "vacancies", "vacancies_display",
          "qualification", "eligibility", "experience",
          "salary_min", "salary_max", "age_min", "age_max",
          "application_fee", "job_metadata", "is_featured",
          "admin_refreshed_at", "created_at", "tags",
          "eligibility_summary", "required_skills"
        ].join(",");
        const { data, error } = await supabase
          .from("jobs")
          .select(columns)
          .order("created_at", { ascending: false })
          .range(0, 9999);
        if (error) throw error;
        return (data || []) as any;
      }

      const res = await fetch("/api/cache/jobs");
      if (!res.ok) {
        // Fallback to direct Supabase if cache endpoint fails
        try {
          const { data, error } = await supabase
            .from("jobs")
            .select("id, slug, title, department, location, last_date, last_date_display, vacancies, vacancies_display, qualification, eligibility, experience, salary_min, salary_max, age_min, age_max, application_fee, job_metadata, is_featured, admin_refreshed_at, created_at, tags, eligibility_summary, required_skills")
            .order("created_at", { ascending: false })
            .range(0, 9999);
          if (error) throw error;
          return (data || []) as any;
        } catch (err) {
          console.warn("[useJobs] Failed fetching with eligibility fields, retrying without them:", err);
          const { data, error } = await supabase
            .from("jobs")
            .select("id, slug, title, department, location, last_date, last_date_display, vacancies, vacancies_display, qualification, eligibility, experience, salary_min, salary_max, age_min, age_max, application_fee, job_metadata, is_featured, admin_refreshed_at, created_at, tags")
            .order("created_at", { ascending: false })
            .range(0, 9999);
          if (error) throw error;
          return (data || []) as any;
        }
      }
      return res.json();
    },
    enabled,
    staleTime: bypassCache ? 0 : 1000 * 60 * 15, // Bypass cache has 0 stale time for instant updates; cached path matches server TTL
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_DETAIL_COLS)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
}

/** Fetch a job by slug, with UUID fallback for backward compatibility */
export function useJobBySlug(slugOrId: string) {
  return useQuery({
    queryKey: ["job", "slug", slugOrId],
    queryFn: async (): Promise<Job | null> => {
      // First try finding by slug. maybeSingle() returns null for a missing slug
      // (HTTP 200) instead of single()'s 406, so a not-found job doesn't spam the
      // console with errors — the UUID fallback / null return handles it.
      const { data: bySlug } = await supabase
        .from("jobs")
        .select(JOB_DETAIL_COLS)
        .eq("slug", slugOrId)
        .maybeSingle();

      if (bySlug) return bySlug as any;

      // Fallback: try by UUID (for transition period)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_REGEX.test(slugOrId)) {
        const { data: byId, error } = await supabase
          .from("jobs")
          .select(JOB_DETAIL_COLS)
          .eq("id", slugOrId)
          .single();
        if (error) throw error;
        return byId as any;
      }

      return null;
    },
    enabled: !!slugOrId,
  });
}
