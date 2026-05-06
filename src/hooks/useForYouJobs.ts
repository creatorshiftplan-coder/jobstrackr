import { useMemo } from "react";
import { useJobs } from "@/hooks/useJobs";
import { useProfile } from "@/hooks/useProfile";
import { useEducation } from "@/hooks/useEducation";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/types/job";
import {
  QualStream,
  matchAndSort,
  getEducationRank,
  inferQualificationStream,
  MatchPreferences,
} from "@/lib/jobMatcher";
import { hybridRecommend, qualificationToTag, HybridMatchedJob } from "@/lib/hybridScorer";

const LOCALSTORAGE_KEY = "jfy_preferences";
const AGE_RANGE_VALUES = new Set(["18-20", "21-25", "26-30", "31-35", "36-40", "40+"]);

function ageRangeToMidAge(range: string): number {
  switch (range) {
    case "18-20": return 19;
    case "21-25": return 23;
    case "26-30": return 28;
    case "31-35": return 33;
    case "36-40": return 38;
    case "40+": return 45;
    default: return 25;
  }
}

function ageToDob(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().split("T")[0];
}

function parseSalaryRange(val: string): [number | null, number | null] {
  if (val === "any") return [null, null];
  const [min, max] = val.split("-").map(Number);
  return [min || null, max || null];
}

function readStoredAnswers(userId: string | null | undefined): Record<string, string | string[]> {
  if (!userId) return {};
  try {
    const saved = localStorage.getItem(`${LOCALSTORAGE_KEY}:${userId}`);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * Hook that replicates the /for-you page matching logic for the homepage.
 * Reads wizard answers from localStorage and runs full matchAndSort + hybridRecommend.
 * Only returns results if the user has completed the wizard (has stored preferences).
 */
export function useForYouJobs(limit: number = 5, enabled: boolean = true) {
  const { user } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs({ enabled });
  const { profile, isLoading: profileLoading } = useProfile({ enabled });
  const { education, isLoading: educationLoading } = useEducation({ enabled });
  const { userExams } = useExams({ enabled, includeExamCatalog: false });

  const answers = useMemo(() => readStoredAnswers(user?.id), [user?.id]);
  const hasWizardAnswers = Object.keys(answers).length > 0;

  const highestEducation = useMemo(() => {
    if (education.length === 0) return null;
    return education.reduce((highest, current) =>
      getEducationRank(current.qualification_type) > getEducationRank(highest.qualification_type)
        ? current : highest
    );
  }, [education]);

  const inferredStream = useMemo<QualStream>(
    () => inferQualificationStream(highestEducation?.qualification_name, highestEducation?.qualification_type),
    [highestEducation]
  );

  const preferences: MatchPreferences = useMemo(() => {
    let dob: string | null = null;
    if (answers.dob && typeof answers.dob === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(answers.dob)) {
        dob = answers.dob;
      } else if (AGE_RANGE_VALUES.has(answers.dob)) {
        dob = ageToDob(ageRangeToMidAge(answers.dob));
      }
    } else if (profile?.date_of_birth) {
      dob = profile.date_of_birth;
    }

    let qualificationType: string | null = null;
    if (answers.qualification && typeof answers.qualification === "string") {
      qualificationType = answers.qualification;
    } else if (highestEducation) {
      qualificationType = highestEducation.qualification_type;
    }

    const qualificationStream = (
      (typeof answers.stream === "string" ? answers.stream : null) ||
      inferredStream ||
      "general"
    ) as QualStream;

    const sectors = (answers.sectors as string[]) || profile?.preferred_sectors || [];

    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    if (answers.salary && typeof answers.salary === "string") {
      [salaryMin, salaryMax] = parseSalaryRange(answers.salary);
    }

    const locations = ((answers.location as string[]) || []).filter((l) => l !== "All India");
    const grades = ((answers.grade as string[]) || []).filter((g) => g !== "any");
    const skills = (answers.skills as string[]) || [];

    return {
      dob,
      qualificationType,
      qualificationStream,
      qualificationName: highestEducation?.qualification_name || null,
      sectors,
      salaryMin,
      salaryMax,
      locations,
      grades,
      skills,
      category: profile?.category || null,
      gender: profile?.gender || null,
    };
  }, [answers, profile, highestEducation, inferredStream]);

  const forYouJobs = useMemo((): Job[] => {
    if (!enabled || !hasWizardAnswers || !jobs || jobs.length === 0) return [];

    const matched = matchAndSort(jobs, preferences);
    const eligible = matched.filter((m) => m.eligibility.eligible && m.eligibility.skillsMissing.length === 0);
    const qualTag = qualificationToTag(preferences.qualificationType);

    const hybrid = hybridRecommend(
      eligible,
      (answers.sectors as string[]) || profile?.preferred_sectors || [],
      userExams,
      qualTag,
      limit
    );

    return hybrid.map((h) => h.job);
  }, [enabled, hasWizardAnswers, jobs, preferences, answers.sectors, profile?.preferred_sectors, userExams, limit]);

  return {
    forYouJobs,
    hasWizardAnswers,
    isLoading: enabled && (jobsLoading || profileLoading || educationLoading),
  };
}
