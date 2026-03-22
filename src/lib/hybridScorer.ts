import { Job } from "@/types/job";
import { ExamAttempt } from "@/hooks/useExams";
import { MatchedJob } from "@/lib/jobMatcher";

/**
 * Hybrid scoring layer that sits on top of matchAndSort().
 *
 * Scoring signals:
 * - Tracked exam match (+10): User is actively tracking an exam that matches this job
 * - Tag/sector overlap (+5): Job tags overlap with user's preferred sectors
 * - Qualification tier match (+3): Job tags include user's qualification level tag
 * - Recency boost (+2): Job was posted in the last 7 days
 */

/**
 * Score a single job using hybrid signals (exam intent + tag overlap + recency).
 * Returns a numeric score to be added on top of matchAndSort's priorityScore.
 */
export function scoreJobHybrid(
  job: Job,
  preferredSectors: string[],
  trackedExams: ExamAttempt[],
  qualificationTag: string | null
): number {
  let score = 0;
  const titleLower = job.title.toLowerCase();
  const deptLower = job.department.toLowerCase();
  const jobText = `${titleLower} ${deptLower}`;

  // +10: Job matches a tracked exam name (strongest intent signal)
  for (const attempt of trackedExams) {
    const examName = attempt.exams?.name?.toLowerCase();
    if (!examName) continue;

    // Check if job title contains exam name or vice versa
    if (titleLower.includes(examName) || examName.includes(titleLower)) {
      score += 10;
      break;
    }

    // Fuzzy: check if significant keywords from exam name appear in job
    const examWords = examName.split(/\s+/).filter((w) => w.length > 2);
    const matchCount = examWords.filter((w) => jobText.includes(w)).length;
    if (examWords.length > 0 && matchCount >= Math.ceil(examWords.length * 0.6)) {
      score += 8;
      break;
    }
  }

  // +5: Job tags overlap with user's preferred sectors
  if (job.tags && preferredSectors.length > 0) {
    const sectorLower = preferredSectors.map((s) => s.toLowerCase());
    const hasOverlap = job.tags.some((tag) =>
      sectorLower.some(
        (sector) => tag.includes(sector) || sector.includes(tag)
      )
    );
    if (hasOverlap) score += 5;
  }

  // +3: Job tags include user's qualification tier tag
  if (qualificationTag && job.tags?.includes(qualificationTag)) {
    score += 3;
  }

  // +2: Recency boost (posted in last 7 days)
  const daysSincePosted = (Date.now() - new Date(job.created_at).getTime()) / 86400000;
  if (daysSincePosted <= 7) score += 2;

  return score;
}

/**
 * Map user qualification type to the corresponding tag key.
 */
export function qualificationToTag(qualificationType: string | null): string | null {
  if (!qualificationType) return null;
  const map: Record<string, string> = {
    "8th": "8th_pass",
    "10th": "10th_pass",
    "12th": "12th_pass",
    iti: "iti",
    diploma: "diploma",
    graduation: "graduate",
    post_graduation: "post_graduate",
    phd: "phd",
  };
  return map[qualificationType.toLowerCase()] ?? null;
}

export interface HybridMatchedJob extends MatchedJob {
  hybridScore: number;
  matchesTrackedExam: boolean;
}

/**
 * Apply hybrid scoring to pre-filtered eligible jobs from matchAndSort().
 * Returns jobs re-ranked by combined (priorityScore + hybridScore).
 */
export function hybridRecommend(
  matchedJobs: MatchedJob[],
  preferredSectors: string[],
  trackedExams: ExamAttempt[],
  qualificationTag: string | null,
  limit: number = 50
): HybridMatchedJob[] {
  return matchedJobs
    .map((matched) => {
      const hybridScore = scoreJobHybrid(
        matched.job,
        preferredSectors,
        trackedExams,
        qualificationTag
      );

      const matchesTrackedExam = trackedExams.some((attempt) => {
        const examName = attempt.exams?.name?.toLowerCase();
        if (!examName) return false;
        const titleLower = matched.job.title.toLowerCase();
        return titleLower.includes(examName) || examName.includes(titleLower);
      });

      return {
        ...matched,
        hybridScore,
        matchesTrackedExam,
        // Combine scores: priorityScore from matchAndSort + hybridScore
        priorityScore: matched.priorityScore + hybridScore,
      };
    })
    .sort((a, b) => {
      // Eligible first
      if (a.eligibility.eligible !== b.eligibility.eligible) {
        return a.eligibility.eligible ? -1 : 1;
      }
      // Tracked exam matches first (within eligible)
      if (a.matchesTrackedExam !== b.matchesTrackedExam) {
        return a.matchesTrackedExam ? -1 : 1;
      }
      // Higher combined score
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // More vacancies
      return (b.job.vacancies || 0) - (a.job.vacancies || 0);
    })
    .slice(0, limit);
}
