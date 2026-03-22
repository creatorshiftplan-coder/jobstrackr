import { useMemo } from "react";
import { useJobs } from "@/hooks/useJobs";
import { useProfile } from "@/hooks/useProfile";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/types/job";
import { hybridRecommend, qualificationToTag, HybridMatchedJob } from "@/lib/hybridScorer";
import { matchAndSort, MatchPreferences } from "@/lib/jobMatcher";

/**
 * Combined hook for hybrid job recommendations on the Index page.
 *
 * Pipeline:
 * 1. Fetch all jobs, user profile, tracked exams
 * 2. Build lightweight preferences from profile (no wizard needed)
 * 3. Run matchAndSort() for eligibility filtering
 * 4. Apply hybridRecommend() for exam-intent + tag scoring
 * 5. Return top recommended jobs + exam-matched jobs
 *
 * This is a simpler path than the full Recommendations wizard.
 * It uses profile data directly (no 8-step wizard answers needed).
 */
export function useRecommendations(limit: number = 10) {
  const { user, isGuestMode } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { profile, isLoading: profileLoading } = useProfile();
  const { userExams } = useExams();

  // Build lightweight preferences from profile data
  const preferences: MatchPreferences = useMemo(() => ({
    dob: profile?.date_of_birth || null,
    qualificationType: null,    // Not available without wizard — skip qualification filter
    qualificationStream: "general",
    qualificationName: null,
    sectors: profile?.preferred_sectors || [],
    salaryMin: null,
    salaryMax: null,
    locations: [],
    grades: [],
    skills: [],
    category: profile?.category || null,
    gender: profile?.gender || null,
  }), [profile]);

  // Run full pipeline
  const { recommended, examMatched } = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { recommended: [] as HybridMatchedJob[], examMatched: [] as HybridMatchedJob[] };
    }

    // Step 1: Filter expired jobs (lightweight — no qualification filter without wizard)
    const today = new Date();
    const activeJobs = jobs.filter((job) => {
      try {
        return new Date(job.last_date) >= today;
      } catch {
        return true; // Keep jobs with unparseable dates
      }
    });

    // Step 2: Run matchAndSort with lightweight preferences
    // Since we don't have qualification type from wizard, this mainly filters by salary/grade/expiry
    const matched = matchAndSort(activeJobs, preferences);

    // Step 3: Apply hybrid scoring
    const qualTag = qualificationToTag(preferences.qualificationType);
    const hybridResults = hybridRecommend(
      matched,
      profile?.preferred_sectors || [],
      userExams,
      qualTag,
      limit
    );

    // Step 4: Split into exam-matched and general recommended
    const examMatchedJobs = hybridResults.filter((r) => r.matchesTrackedExam);
    const recommendedJobs = hybridResults.filter((r) => !r.matchesTrackedExam);

    return {
      recommended: recommendedJobs,
      examMatched: examMatchedJobs,
    };
  }, [jobs, preferences, profile?.preferred_sectors, userExams, limit]);

  return {
    /** Jobs matching user's tracked exams — highest priority */
    examMatched,
    /** Jobs recommended based on sectors, tags, recency — general recommendations */
    recommended,
    /** Whether data is still loading */
    isLoading: jobsLoading || profileLoading,
    /** Whether user has tracked exams */
    hasTrackedExams: userExams.length > 0,
    /** Whether user has set sector preferences */
    hasSectorPreferences: (profile?.preferred_sectors?.length ?? 0) > 0,
  };
}
