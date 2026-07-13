import { useMemo } from "react";
import { useJobs } from "@/hooks/useJobs";
import { useProfile, Profile } from "@/hooks/useProfile";
import { useExams, ExamAttempt } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/types/job";
import { hybridRecommend, qualificationToTag, HybridMatchedJob } from "@/lib/hybridScorer";
import { matchAndSort, MatchPreferences } from "@/lib/jobMatcher";
import { isJobOpenForFeed } from "@/lib/jobUtils";

interface UseRecommendationsOptions {
  /** Pre-fetched profile to avoid a redundant Supabase call */
  initialProfile?: Profile | null;
  /** Pre-fetched user exams to avoid a redundant Supabase call */
  initialUserExams?: ExamAttempt[];
}

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
 *
 * Performance: When called from the homepage, pass initialJobs/initialProfile/initialUserExams
 * to avoid 3 redundant Supabase queries.
 */
export function useRecommendations(
  limit: number = 10,
  enabled: boolean = true,
  initialJobs?: Job[],
  options?: UseRecommendationsOptions,
) {
  const { user, isGuestMode } = useAuth();

  // Only fetch if not provided externally
  const hasInitialProfile = options?.initialProfile !== undefined;
  const hasInitialExams = options?.initialUserExams !== undefined;

  const { data: jobs, isLoading: jobsLoading } = useJobs({ enabled: enabled && !initialJobs });
  const resolvedJobs = initialJobs || jobs;
  const { profile: fetchedProfile, isLoading: profileLoading } = useProfile({ enabled: enabled && !hasInitialProfile });
  const { userExams: fetchedExams } = useExams({ enabled: enabled && !hasInitialExams, includeExamCatalog: false });

  const profile = hasInitialProfile ? options!.initialProfile : fetchedProfile;
  const userExams = hasInitialExams ? options!.initialUserExams! : fetchedExams;

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
    if (!enabled || !resolvedJobs || resolvedJobs.length === 0) {
      return { recommended: [] as HybridMatchedJob[], examMatched: [] as HybridMatchedJob[] };
    }

    // Step 1: Filter expired jobs (lightweight — no qualification filter without wizard)
    const activeJobs = resolvedJobs.filter((job) => isJobOpenForFeed(job));

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
  }, [enabled, resolvedJobs, preferences, profile?.preferred_sectors, userExams, limit]);

  return {
    /** Jobs matching user's tracked exams — highest priority */
    examMatched,
    /** Jobs recommended based on sectors, tags, recency — general recommendations */
    recommended,
    /** Whether data is still loading */
    isLoading: enabled && ((!initialJobs && jobsLoading) || (!hasInitialProfile && profileLoading)),
    /** Whether user has tracked exams */
    hasTrackedExams: enabled && userExams.length > 0,
    /** Whether user has set sector preferences */
    hasSectorPreferences: (profile?.preferred_sectors?.length ?? 0) > 0,
  };
}

