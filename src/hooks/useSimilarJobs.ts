import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

interface SimilarJob {
  id: string;
  title: string;
  department: string;
  location: string;
  last_date: string;
  vacancies: number | null;
  qualification: string;
  slug: string | null;
  distance: number;
}

/**
 * Fetch similar jobs using vector similarity (pgvector).
 * Calls the similar_jobs RPC function which finds nearest neighbors
 * by cosine distance on the embedding column.
 *
 * Only returns results if the given job has an embedding.
 */
export function useSimilarJobs(jobId: string | undefined, limit: number = 5) {
  return useQuery({
    queryKey: ["similar-jobs", jobId, limit],
    queryFn: async (): Promise<SimilarJob[]> => {
      if (!jobId) return [];

      const { data, error } = await supabase.rpc("similar_jobs", {
        p_job_id: jobId,
        match_limit: limit,
      });

      if (error) {
        // Silently fail — similar jobs is an enhancement, not critical
        console.warn("similar_jobs RPC error:", error.message);
        return [];
      }

      return (data || []) as SimilarJob[];
    },
    enabled: !!jobId,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: false, // Don't retry on failure — embedding may not exist
  });
}
