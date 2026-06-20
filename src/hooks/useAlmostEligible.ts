import { MatchedJob } from "../lib/jobMatcher";
import { checkAllSkills } from "../lib/skillMatcher";

/**
 * Predicate to check if a job is almost eligible for the student.
 * Almost eligible = passes age, qualification, and gender, but missing 1-2 required skills.
 */
export function isAlmostEligible(matchedJob: MatchedJob, userSkills: string[] = []): boolean {
  const { eligible, ageOk, qualOk, skillsMissing, blockers } = matchedJob.eligibility;

  // Must pass hard checks (age, qualification, gender)
  if (!eligible) return false;
  if (ageOk === false) return false;
  if (qualOk === false) return false;
  // Unverifiable hard gates (domicile, registration, manual review…) belong in
  // "Review eligibility", not "Almost There".
  if (blockers.length > 0) return false;

  // Run JSONB required skills matcher
  const jsonbResult = checkAllSkills(matchedJob.job.required_skills, userSkills);

  // Combine gaps: union of regex skillsMissing and JSONB gap_skills
  const totalGapsCount = Math.max(skillsMissing.length, jsonbResult.gap_skills.length);

  // 1-2 achievable gaps only
  return totalGapsCount >= 1 && totalGapsCount <= 2;
}

export interface SkillGap {
  label: string;
  type: string;
  required: boolean;
}

/**
 * Extracts all gap skills (missing required skills) for a job.
 */
export function getJobGapSkills(matchedJob: MatchedJob, userSkills: string[] = []): SkillGap[] {
  const gaps: SkillGap[] = [];
  const { skillsMissing } = matchedJob.eligibility;

  // Add regex gaps
  for (const skill of skillsMissing) {
    gaps.push({
      label: skill,
      type: "regex",
      required: true,
    });
  }

  // Add JSONB gaps
  const jsonbResult = checkAllSkills(matchedJob.job.required_skills, userSkills);
  for (const skill of jsonbResult.gap_skills) {
    // Avoid duplicate labels
    const label = getSkillObjectLabel(skill);
    if (!gaps.some((g) => g.label.toLowerCase() === label.toLowerCase())) {
      gaps.push({
        label,
        type: skill.type,
        required: true,
      });
    }
  }

  return gaps;
}

/**
 * Returns a user-friendly label for a structured SkillObject.
 */
function getSkillObjectLabel(skill: any): string {
  switch (skill.type) {
    case "typing":
      return `Typing ${skill.min_wpm || 35} WPM ${skill.language}`;
    case "stenography":
      return `Stenography ${skill.min_wpm || 80} WPM ${skill.language || "English"}`;
    case "computer":
      return `Computer Cert (${skill.accepted?.join("/") || "CCC"})`;
    case "iti":
      return `ITI Trade (${skill.trades?.join("/") || "Electrician"})`;
    case "driving":
      return `${skill.license_types?.join("/") || "LMV"} Driving License`;
    case "law":
      return `Law Degree (${skill.accepted?.join("/") || "LLB"})`;
    case "ncc":
      return `NCC ${skill.min_certificate || "B"} Cert`;
    case "experience":
      return `${skill.min_years || 1}yr experience in ${skill.domain}`;
    case "physical":
      return "Physical Standards";
    case "custom":
    default:
      return skill.label || "Specialized Skill";
  }
}
