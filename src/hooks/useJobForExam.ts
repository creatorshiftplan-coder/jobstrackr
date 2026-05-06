import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

/**
 * Hook to find a job that matches an exam by name similarity.
 * This is useful when you have an exam ID and need to find the corresponding job.
 * 
 * Matching strategy:
 * 1. Exact match on title
 * 2. Partial match (exam name contains job title or vice versa)
 * 3. Fuzzy match using key words from the exam name
 */
export function useJobForExam(examName: string | undefined) {
    return useQuery({
        queryKey: ["job-for-exam", examName],
        queryFn: async (): Promise<Job | null> => {
            if (!examName) return null;

            // Normalize the exam name for matching
            const normalizedName = examName
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

            // Try exact title match first
            const { data: exactMatch } = await supabase
                .from("jobs")
                .select("*")
                .ilike("title", normalizedName)
                .limit(1)
                .maybeSingle();

            if (exactMatch) return exactMatch as Job;

            // Try partial match - job title contains exam name
            const { data: partialMatch } = await supabase
                .from("jobs")
                .select("*")
                .ilike("title", `%${normalizedName}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (partialMatch) return partialMatch as Job;

            // Extract key words for fuzzy matching (3+ char words)
            const keywords = normalizedName
                .split(" ")
                .filter(word => word.length >= 3)
                .slice(0, 3); // Take first 3 keywords

            if (keywords.length === 0) return null;

            // Try matching with keywords
            // Use OR condition with ilike for each keyword
            for (const keyword of keywords) {
                const { data: keywordMatch } = await supabase
                    .from("jobs")
                    .select("*")
                    .ilike("title", `%${keyword}%`)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (keywordMatch) return keywordMatch as Job;
            }

            return null;
        },
        enabled: !!examName && examName.length > 0,
        staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    });
}

/**
 * Hook to get the job ID for an exam.
 * Returns null if no matching job is found.
 */
export function useJobIdForExam(examName: string | undefined): string | null {
    const { data: job } = useJobForExam(examName);
    return job?.id || null;
}

/**
 * Hook to check if a job exists for an exam.
 */
export function useHasJobForExam(examName: string | undefined): boolean {
    const { data: job, isLoading } = useJobForExam(examName);
    if (isLoading) return false;
    return !!job;
}

export default useJobForExam;
