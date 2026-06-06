import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

interface HomepageBundle {
  recentJobs: Job[];
  allJobs: Job[];
  exams: any[];
}

/**
 * Fetches all homepage data in a single Redis-cached API call.
 * Returns recent jobs (top 50), all jobs (for recommendations), and active exams.
 *
 * Replaces 3 separate hooks (useJobs + useExams + separate profile fetching)
 * with one bundled request that goes through Redis cache.
 */
export function useHomepageData(enabled: boolean = true) {
  return useQuery({
    queryKey: ["homepage-bundle"],
    queryFn: async (): Promise<HomepageBundle> => {
      const res = await fetch("/api/cache/homepage");
      if (!res.ok) {
        // Fallback to direct Supabase if cache endpoint fails
        return fallbackFetch();
      }
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/** Fallback: direct Supabase fetch if cache endpoint is unavailable */
async function fallbackFetch(): Promise<HomepageBundle> {
  const columns = [
    "id", "slug", "title", "department", "location",
    "last_date", "last_date_display", "vacancies", "vacancies_display",
    "qualification", "eligibility", "experience",
    "salary_min", "salary_max", "age_min", "age_max",
    "application_fee", "job_metadata", "is_featured",
    "admin_refreshed_at", "created_at", "tags",
  ].join(",");

  const [{ data: allJobs }, { data: exams }] = await Promise.all([
    supabase
      .from("jobs")
      .select(columns)
      .order("created_at", { ascending: false })
      .range(0, 9999),
    supabase
      .from("exams")
      .select("*")
      .eq("is_active", true)
      .order("name"),
  ]);

  const jobsList = (allJobs || []) as any;
  return {
    recentJobs: jobsList.slice(0, 50),
    allJobs: jobsList,
    exams: exams || [],
  };
}
