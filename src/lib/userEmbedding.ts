import { Profile } from "@/hooks/useProfile";
import { EducationQualification } from "@/hooks/useEducation";
import { ExamAttempt } from "@/hooks/useExams";

export function computeAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Build the text representation of a user for embedding generation.
 * Combines: qualification + stream + preferred sectors + tracked exam names + skills + age + category.
 * 
 * Called only when user updates profile or wizard preferences.
 * The resulting text is sent to the embedding model (server-side)
 * and stored in profiles.embedding.
 */
export function buildUserEmbeddingText(
  profile: Profile | null,
  education: EducationQualification[],
  trackedExams: ExamAttempt[],
  skills: string[] = []
): string {
  const parts: string[] = [];

  // Age, Category, Gender
  if (profile?.date_of_birth) {
    parts.push(`Age ${computeAge(profile.date_of_birth)} years`);
  }
  if (profile?.category) {
    parts.push(`${profile.category} category`);
  }
  if (profile?.gender) {
    parts.push(profile.gender);
  }

  // Highest education
  if (education.length > 0) {
    const highest = education[0]; // sorted by date descending
    if (highest.qualification_type) parts.push(highest.qualification_type);
    if (highest.qualification_name) parts.push(highest.qualification_name);
    if (highest.board_university) parts.push(highest.board_university);
  }

  // Address/State (domicile match)
  if (profile?.address) {
    parts.push(`State ${profile.address}`);
  }

  // Skills from wizard/localStorage
  for (const skill of skills) {
    if (skill === "typing_english") parts.push("typing English");
    else if (skill === "typing_hindi") parts.push("typing Hindi");
    else if (skill === "computer") parts.push("computer certificate");
    else if (skill === "stenography") parts.push("stenography");
    else if (skill === "driving") parts.push("driving license LMV");
    else if (skill === "swimming") parts.push("swimming");
    else if (skill === "physical_fitness") parts.push("physical fitness");
    else parts.push(skill.replace(/[_-]+/g, " "));
  }

  // Preferred sectors
  if (profile?.preferred_sectors && profile.preferred_sectors.length > 0) {
    parts.push(`Preferred: ${profile.preferred_sectors.join(", ")}`);
  }

  // Tracked exam names (strong intent signal)
  for (const attempt of trackedExams) {
    if (attempt.exams?.name) {
      parts.push(attempt.exams.name);
    }
  }

  return parts.filter(Boolean).join(" ");
}

