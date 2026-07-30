import { useQuery } from "@tanstack/react-query";
import { Job } from "@/types/job";
import { fetchJobListFromSupabase } from "@/hooks/useJobs";

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
    staleTime: 1000 * 60 * 15, // 15 minutes — matches the lengthened server cache TTL
  });
}

/**
 * Fallback: direct Supabase fetch if cache endpoint is unavailable.
 *
 * Shares `fetchJobListFromSupabase` with useJobs so both fallbacks pull the
 * same trimmed column set. This runs in the browser once per visitor, so during
 * an `/api/cache/homepage` outage it is the site's heaviest query — keeping it
 * aligned with the server-side select is what stops an incident from becoming
 * an egress bill.
 */
async function fallbackFetch(): Promise<HomepageBundle> {
  const jobsList = await fetchJobListFromSupabase();
  return {
    recentJobs: jobsList.slice(0, 50),
    allJobs: jobsList,
    // No consumer reads exams from this bundle (Index uses allJobs/recentJobs
    // only) — fetching the whole exams table here was pure wasted egress.
    exams: [],
  };
}
