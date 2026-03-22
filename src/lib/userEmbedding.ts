import { Profile } from "@/hooks/useProfile";
import { EducationQualification } from "@/hooks/useEducation";
import { ExamAttempt } from "@/hooks/useExams";

/**
 * Build the text representation of a user for embedding generation.
 * Combines: qualification + stream + preferred sectors + tracked exam names.
 * 
 * Called only when user updates profile or wizard preferences.
 * The resulting text is sent to the embedding model (server-side)
 * and stored in profiles.embedding.
 */
export function buildUserEmbeddingText(
  profile: Profile | null,
  education: EducationQualification[],
  trackedExams: ExamAttempt[]
): string {
  const parts: string[] = [];

  // Highest education
  if (education.length > 0) {
    const highest = education[0]; // sorted by date descending
    if (highest.qualification_type) parts.push(highest.qualification_type);
    if (highest.qualification_name) parts.push(highest.qualification_name);
    if (highest.board_university) parts.push(highest.board_university);
  }

  // Preferred sectors
  if (profile?.preferred_sectors && profile.preferred_sectors.length > 0) {
    parts.push(profile.preferred_sectors.join(" "));
  }

  // Tracked exam names (strong intent signal)
  for (const attempt of trackedExams) {
    if (attempt.exams?.name) {
      parts.push(attempt.exams.name);
    }
  }

  // Category (OBC/SC/ST)
  if (profile?.category) {
    parts.push(profile.category);
  }

  return parts.filter(Boolean).join(" ");
}
