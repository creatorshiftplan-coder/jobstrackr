import { Job } from "../types/job";
import { HybridMatchedJob } from "./hybridScorer";
import { MatchedJob } from "./jobMatcher";
import { parseJobDeadline, resolveStateFromLocationText } from "./jobUtils";
import { Profile } from "../hooks/useProfile";

export interface FeedShelf {
  key: string;
  title: string;
  jobs: Job[];
  showGapChips?: boolean;
  showMatchScore?: boolean;
}

function getDaysLeft(lastDate: string): number {
  const deadline = parseJobDeadline(lastDate);
  if (!deadline) return Infinity;
  const diffTime = deadline.getTime() - Date.now();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Organises matched eligibility outputs into Netflix-style rows.
 * Deduplicates jobs so they appear in at most one recommended shelf.
 */
export function buildFeed(
  eligible: HybridMatchedJob[],
  almostElig: MatchedJob[],
  userProfile: Profile | null,
  savedJobs: Job[],
  viewedJobIds: Set<string> = new Set(),
  jobSimilarity: Map<string, Job[]> = new Map()
): FeedShelf[] {
  const seenIds = new Set<string>();

  // Helper to extract n unique unseen jobs
  const take = (jobsList: Job[], n: number): Job[] => {
    const result: Job[] = [];
    for (const job of jobsList) {
      if (seenIds.has(job.id)) continue;
      seenIds.add(job.id);
      result.push(job);
      if (result.length >= n) break;
    }
    return result;
  };

  const shelves: FeedShelf[] = [];

  // 1. Eligible For You (Top Match Rank)
  const eligibleJobs = eligible.map((e) => e.job);
  const eligibleForYouJobs = take(eligibleJobs, 20);
  if (eligibleForYouJobs.length > 0) {
    shelves.push({
      key: "eligible_for_you",
      title: "Eligible For You",
      jobs: eligibleForYouJobs,
      showMatchScore: true,
    });
  }

  // 2. Almost There - 1 Skill Away (Failed only 1-2 required skills)
  const almostEligJobs = almostElig.map((a) => a.job);
  const almostThereJobs = take(almostEligJobs, 15);
  if (almostThereJobs.length > 0) {
    shelves.push({
      key: "almost_there",
      title: "Almost There - 1 Skill Away",
      jobs: almostThereJobs,
      showGapChips: true,
    });
  }

  // 3. Closing Soon (Eligible jobs closing in <= 7 days)
  const closingSoonCandidates = eligibleJobs.filter(
    (j) => getDaysLeft(j.last_date) <= 7 && getDaysLeft(j.last_date) >= 0
  );
  const closingSoonJobs = take(closingSoonCandidates, 10);
  if (closingSoonJobs.length > 0) {
    shelves.push({
      key: "closing_soon",
      title: "Closing Soon",
      jobs: closingSoonJobs,
    });
  }

  // 4. Because You Liked {Title} (one shelf per recently saved job, max 2 shelves)
  const recentSaved = savedJobs.slice(0, 2);
  for (const saved of recentSaved) {
    const similar = jobSimilarity.get(saved.id) || [];
    const recommendedSimilar = take(similar, 10);
    if (recommendedSimilar.length > 0) {
      shelves.push({
        key: `because_liked:${saved.id}`,
        title: `Because You Liked ${saved.title.split("-")[0].split("(")[0].trim()}`,
        jobs: recommendedSimilar,
      });
    }
  }

  // 5. New in {State} (domicile matching)
  if (userProfile?.address) {
    const userState = resolveStateFromLocationText(userProfile.address) || userProfile.address;
    const stateCandidates = eligibleJobs.filter((job) => {
      const jobLoc = job.location || "";
      return jobLoc.toLowerCase().includes(userState.toLowerCase());
    });
    const stateJobs = take(stateCandidates, 10);
    if (stateJobs.length > 0) {
      shelves.push({
        key: "new_in_state",
        title: `New in ${userState}`,
        jobs: stateJobs,
      });
    }
  }

  // 6. High Vacancies (Eligible posts with >= 100 vacancies)
  const highVacancyCandidates = eligibleJobs
    .filter((j) => typeof j.vacancies === "number" && j.vacancies >= 100)
    .sort((a, b) => (b.vacancies || 0) - (a.vacancies || 0));
  const highVacancyJobs = take(highVacancyCandidates, 10);
  if (highVacancyJobs.length > 0) {
    shelves.push({
      key: "high_vacancies",
      title: "High Vacancy Posts",
      jobs: highVacancyJobs,
    });
  }

  // 7. Saved Jobs (always appended if user has saved jobs, seenIds deduplication bypassed here)
  if (savedJobs.length > 0) {
    shelves.push({
      key: "saved",
      title: "Saved Jobs",
      jobs: savedJobs,
    });
  }

  return shelves;
}
