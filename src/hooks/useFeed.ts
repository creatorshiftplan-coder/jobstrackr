import { useMemo } from "react";
import { useJobs } from "@/hooks/useJobs";
import { useProfile } from "@/hooks/useProfile";
import { useExams } from "@/hooks/useExams";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useForYouJobs } from "@/hooks/useForYouJobs";
import { HybridMatchedJob, hybridRecommend, qualificationToTag } from "@/lib/hybridScorer";
import { buildFeed, FeedShelf } from "@/lib/feedBuilder";
import { isAlmostEligible, getJobGapSkills } from "@/hooks/useAlmostEligible";
import { MatchedJob } from "@/lib/jobMatcher";
import { Job } from "@/types/job";

/**
 * Calculates cosine similarity between two numeric vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parses vector string or array safely.
 */
function parseVector(vectorVal: any): number[] | null {
  if (Array.isArray(vectorVal)) return vectorVal;
  if (typeof vectorVal === "string") {
    try {
      return JSON.parse(vectorVal);
    } catch {
      try {
        return vectorVal
          .replace(/[\[\]]/g, "")
          .split(",")
          .map(Number);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Re-ranks eligible jobs based on user vector embedding using client-side cosine similarity.
 */
export function vectorRerank(
  jobs: HybridMatchedJob[],
  userEmbeddingRaw: any
): HybridMatchedJob[] {
  const userVec = parseVector(userEmbeddingRaw);
  if (!userVec) return jobs;

  return jobs
    .map((matched) => {
      const jobVecRaw = (matched.job as any).embedding;
      const jobVec = parseVector(jobVecRaw);

      let similarity = 0;
      if (jobVec) {
        similarity = cosineSimilarity(userVec, jobVec);
      }

      // Map cosine similarity to 0-100 score
      const matchScore = Math.max(0, Math.min(100, Math.round(similarity * 100)));
      (matched.job as any).matchScore = matchScore;

      return {
        ...matched,
        // Combined boost score
        priorityScore: matched.priorityScore + similarity * 10,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Main hook for recommendations feed pages (homepage and Recommendations wizard output).
 * Fetches all user contextual data and returns structured rows for rendering.
 *
 * Performance: pass `initialJobs` (e.g. from the homepage bundle) to skip the
 * duplicate /api/cache/jobs download — the full jobs list is multi-MB.
 */
export function useFeed(
  enabled: boolean = true,
  initialJobs?: Job[],
  /** True while the caller's own jobs request is still in flight — keeps the
   * feed's fallback fetch disabled so jobs aren't downloaded twice. */
  initialJobsPending: boolean = false,
) {
  // Only fetch jobs if the caller didn't already provide them (and isn't about to)
  const { data: fetchedJobs, isLoading: fetchedJobsLoading } = useJobs({
    enabled: enabled && !initialJobs && !initialJobsPending,
  });
  const jobs = initialJobs ?? fetchedJobs;
  const jobsLoading = initialJobs ? false : (initialJobsPending || fetchedJobsLoading);

  const { profile, isLoading: profileLoading } = useProfile({ enabled });
  const { userExams } = useExams({ enabled, includeExamCatalog: false });
  const { data: savedJobsData, isLoading: savedLoading } = useSavedJobs();

  const { matchedJobs, preferences, isLoading: forYouLoading } = useForYouJobs(
    100, // retrieve enough candidates for shelves selection
    enabled,
    jobs
  );

  const savedJobs = useMemo(() => {
    return (savedJobsData || []).map((s) => s.jobs).filter(Boolean) as any[];
  }, [savedJobsData]);

  const savedJobIds = useMemo(() => {
    return new Set((savedJobsData || []).map((s) => s.job_id));
  }, [savedJobsData]);

  const userSkills = useMemo(() => {
    return preferences?.skills || [];
  }, [preferences]);

  const isLoading = jobsLoading || profileLoading || savedLoading || forYouLoading;

  const result = useMemo(() => {
    if (!enabled || !matchedJobs || matchedJobs.length === 0) {
      return { shelves: [] as FeedShelf[], totalEligible: 0 };
    }

    // Step 1: Split into eligible vs almost-eligible
    const eligible = matchedJobs.filter((m) => m.eligibility.eligible && m.eligibility.skillsMissing.length === 0);
    const almostElig = matchedJobs.filter((m) => isAlmostEligible(m, userSkills));

    // Step 2: Apply hybrid ranking (exam intent + tag overlap + recency)
    const preferredSectors = profile?.preferred_sectors || [];
    const qualTag = qualificationToTag(preferences?.qualificationType || null);
    
    const hybridRanked = hybridRecommend(
      eligible,
      preferredSectors,
      userExams,
      qualTag,
      eligible.length // don't slice yet, pass everything to build rows
    );

    // Step 3: Vector re-rank using stored profile_embedding
    const userEmbeddingRaw = profile?.embedding || (profile as any)?.profile_embedding;
    const vectorRanked = vectorRerank(hybridRanked, userEmbeddingRaw);

    // Map gap skills to almost eligible jobs for rendering in job cards
    const almostEligWithGaps = almostElig.map((matched) => {
      const gaps = getJobGapSkills(matched, userSkills);
      return {
        ...matched,
        job: {
          ...matched.job,
          gapSkills: gaps,
        },
      } as MatchedJob;
    });

    // Step 4: Build Netflix shelves
    // We mock top-10 similarity locally by grouping similar departments.
    // Only computed for the (≤2) recently saved jobs buildFeed actually uses —
    // computing it for every job was O(n²) and blocked the main thread.
    const jobSimilarityMap = new Map<string, Job[]>();
    const allJobs = jobs || [];
    for (const saved of savedJobs.slice(0, 2)) {
      const similar: Job[] = [];
      for (const j of allJobs) {
        if (j.id !== saved.id && j.department === saved.department) {
          similar.push(j);
          if (similar.length >= 10) break;
        }
      }
      jobSimilarityMap.set(saved.id, similar);
    }

    const shelves = buildFeed(
      vectorRanked,
      almostEligWithGaps,
      profile,
      savedJobs,
      new Set(), // viewed jobs placeholder
      jobSimilarityMap
    );

    return {
      shelves,
      totalEligible: eligible.length,
    };
  }, [enabled, matchedJobs, userSkills, profile, preferences, userExams, savedJobs, jobs]);

  return {
    shelves: result.shelves,
    totalEligible: result.totalEligible,
    isLoading,
  };
}
