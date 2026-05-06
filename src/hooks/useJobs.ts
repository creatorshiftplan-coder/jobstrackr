import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

interface UseJobsOptions {
  enabled?: boolean;
}

export function useJobs(options: UseJobsOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, slug, title, department, location, last_date, last_date_display, vacancies, vacancies_display, qualification, eligibility, experience, salary_min, salary_max, age_min, age_max, application_fee, job_metadata, is_featured, admin_refreshed_at, created_at, tags")
        .order("created_at", { ascending: false })
        .range(0, 9999);

      if (error) throw error;
      return (data || []) as any;
    },
    enabled,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
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
      // First try finding by slug
      const { data: bySlug } = await supabase
        .from("jobs")
        .select("*")
        .eq("slug", slugOrId)
        .single();

      if (bySlug) return bySlug as any;

      // Fallback: try by UUID (for transition period)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_REGEX.test(slugOrId)) {
        const { data: byId, error } = await supabase
          .from("jobs")
          .select("*")
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
