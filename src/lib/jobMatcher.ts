import { Job, EligibilityAlternative } from "@/types/job";
import { getEligibilityProfile } from "@/lib/eligibilityParser";
import { matchesSectorPreference, parseJobDeadline, extractLocationFromText, cleanLocationString, resolveStateFromLocationText, isAllIndiaLocationText } from "@/lib/jobUtils";
/**
 * Returns the best location for a job: inferred from title/department if explicit location is generic.
 * Mutates the job object to set inferred_location if needed.
 */
export function getBestJobLocation(job: Job): string {
  const genericLocations = ["india", "all india", "across india", "pan india", "various", "multiple"];
  const loc = (job.location || "").toLowerCase();
  const isGeneric = genericLocations.some(g => loc.includes(g));
  if (isGeneric) {
    const inferred = extractLocationFromText(`${job.title} ${job.department}`);
    job.inferred_location = inferred;
    return cleanLocationString(inferred) || cleanLocationString(job.location);
  }
  job.inferred_location = null;
  return cleanLocationString(job.location);
}

// ═════════════════════════════════════════════════════════════════════════
// QUALIFICATION SYSTEM
// Two-dimensional: LEVEL (general rank) + STREAM (specialization)
// A BSc holder can apply for "Graduate" jobs but NOT "B.Tech" jobs.
// ═════════════════════════════════════════════════════════════════════════

// General hierarchy levels
export const QUAL_LEVELS = {
  "8th": 1,
  "10th": 2,
  "12th": 3,
  "iti": 3,       // same level as 12th
  "diploma": 3.5,
  "graduation": 4,
  "post_graduation": 5,
  "phd": 6,
} as const;

// Specialization streams — jobs requiring a specific stream reject other streams at the same level
export type QualStream = "general" | "engineering" | "medical" | "teaching" | "law" | "nursing" | "pharmacy";

interface QualProfile {
  level: number;
  stream: QualStream;
}

// Map user's education type → profile
export function getUserQualProfile(qualType: string): QualProfile {
  const t = qualType.toLowerCase();
  const level = QUAL_LEVELS[t as keyof typeof QUAL_LEVELS] ?? 0;

  if (t === "graduation" || t === "post_graduation") {
    return { level, stream: "general" }; // BSc/BA/BCom → general
  }
  return { level, stream: "general" };
}

// We also allow wizard to specify stream — exposed to Recommendations.tsx
export function getUserQualProfileWithStream(qualType: string, stream: QualStream): QualProfile {
  const level = QUAL_LEVELS[qualType.toLowerCase() as keyof typeof QUAL_LEVELS] ?? 0;
  return { level, stream };
}

export function inferQualificationStream(
  qualificationName: string | null | undefined,
  qualificationType: string | null | undefined
): QualStream {
  const text = `${qualificationType || ""} ${qualificationName || ""}`.toLowerCase();

  if (
    text.includes("b.tech") || text.includes("btech") || text.includes("m.tech") ||
    text.includes("engineering") || text.includes("b.e") || text.includes("m.e")
  ) {
    return "engineering";
  }

  if (text.includes("mbbs") || text.includes("medical") || text.includes("bds")) {
    return "medical";
  }

  if (text.includes("llb") || text.includes("law")) {
    return "law";
  }

  if (text.includes("b.ed") || text.includes("bed") || text.includes("tet") || text.includes("ctet")) {
    return "teaching";
  }

  if (text.includes("nursing") || text.includes("gnm") || text.includes("anm")) {
    return "nursing";
  }

  if (text.includes("pharmacy") || text.includes("pharm")) {
    return "pharmacy";
  }

  return "general";
}

export function getQualStreamLabel(stream: QualStream): string {
  const labels: Record<QualStream, string> = {
    general: "General",
    engineering: "Engineering",
    medical: "Medical",
    teaching: "Teaching",
    law: "Law",
    nursing: "Nursing",
    pharmacy: "Pharmacy",
  };

  return labels[stream];
}

export function getSkillLabel(skill: string): string {
  const labels: Record<string, string> = {
    stenography: "Stenography",
    computer: "Computer Proficiency",
    typing_hindi: "Hindi Typing",
    typing_english: "English Typing",
    driving: "Driving License",
    swimming: "Swimming",
    physical_fitness: "Physical Fitness",
    braille: "Braille Knowledge",
    sign_language: "Sign Language",
    rci_registration: "RCI Registration",
    special_education: "Special Education Diploma",
    // Professional certifications
    gate_score: "GATE Score",
    net_slet: "UGC NET / SLET",
    ca_icwa: "CA / ICWA / CS",
    cti_cits: "CTI / CITS",
    jaiib_caiib: "JAIIB / CAIIB",
    cfa_frm: "CFA / FRM",
    nism: "NISM Certification",
    pmp: "PMP Certification",
    ccna_networking: "CCNA / CCNP",
    afih: "AFIH (Industrial Health)",
    boe_certificate: "BOE Certificate",
    fssai: "FSSAI Certification",
    nis_coaching: "NIS Coaching Diploma",
    medical_coding: "Medical Coding (ICD-10)",
    // Language skills
    hindi_proficiency: "Hindi Proficiency",
    local_language: "Regional Language",
    sanskrit: "Sanskrit Knowledge",
    // Software / tech skills
    autocad: "AutoCAD",
    gis: "GIS (Geographic Information System)",
    sap_erp: "SAP / ERP",
    programming: "Programming",
    // Domain-specific skills
    surveying: "Surveying",
    agriculture: "Agriculture",
    fisheries: "Fisheries",
    forestry: "Forestry",
    veterinary: "Veterinary Science",
    horticulture: "Horticulture",
    geology: "Geology",
    textile: "Textile Technology",
    food_technology: "Food Technology",
    physiotherapy: "Physiotherapy",
    clinical_psychology: "Clinical Psychology",
    social_work: "Social Work (MSW)",
    biotechnology: "Biotechnology",
    public_health: "Public Health (MPH)",
  };

  if (labels[skill]) return labels[skill];

  return skill
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Parse job qualification text → what stream does it require?
function parseJobQualRequirement(qualification: string): QualProfile {
  const text = qualification.toLowerCase();

  // 1. Engineering (M.Tech / ME)
  if (/\b(m\.?tech|m\.?e)\b/i.test(text)) {
    return { level: 5, stream: "engineering" };
  }
  // 2. Engineering (B.Tech / B.E)
  if (
    /\b(b\.?tech|b\.?e)\b/i.test(text) ||
    (/\bengineering\b/i.test(text) && /\b(graduate|degree|bachelor)\b/i.test(text))
  ) {
    return { level: 4, stream: "engineering" };
  }

  // 3. Medical / MBBS / Veterinary (M.D. / M.S. / M.V.Sc)
  if (/\b(m\.?d\.?|m\.?s\.?|m\.?v\.?sc|mvsc)\b/i.test(text) && /\b(medical|surgery|veterinary|animal)\b/i.test(text)) {
    return { level: 5, stream: "medical" };
  }
  // 4. Medical / MBBS / Veterinary (B.B.S. / B.D.S / B.V.Sc)
  if (
    /\b(mbbs|bds|bvsc|b\.?v\.?sc|animal husbandry)\b/i.test(text) ||
    (/\b(medical|veterinary)\b/i.test(text) && /\b(degree|graduate|bachelor)\b/i.test(text))
  ) {
    return { level: 4, stream: "medical" };
  }

  // 5. Nursing (M.Sc Nursing)
  if (/\bm\.?sc\s+nursing\b/i.test(text)) {
    return { level: 5, stream: "nursing" };
  }
  // 6. Nursing (B.Sc Nursing / GNM)
  if (/\b(nursing|gnm|anm|b\.?sc\s+nursing)\b/i.test(text)) {
    return { level: 4, stream: "nursing" };
  }

  // 7. Pharmacy (M.Pharm)
  if (/\bm\.?pharm\b/i.test(text)) {
    return { level: 5, stream: "pharmacy" };
  }
  // 8. Pharmacy (B.Pharm / D.Pharm)
  if (/\b(pharmacy|pharmacist|b\.?pharm|d\.?pharm)\b/i.test(text)) {
    return { level: /\bd\.?pharm\b/i.test(text) ? 3.5 : 4, stream: "pharmacy" };
  }

  // 9. Teaching (M.Ed)
  if (/\bm\.?ed\b/i.test(text)) {
    return { level: 5, stream: "teaching" };
  }
  // 10. Teaching (B.Ed / TET)
  if (/\b(b\.?ed|bed|tet|ctet|d\.el\.ed|d\.ed)\b/i.test(text)) {
    return { level: 4, stream: "teaching" };
  }

  // 11. Law (LLM)
  if (/\b(llm|l\.l\.m)\b/i.test(text)) {
    return { level: 5, stream: "law" };
  }
  // 12. Law (LLB)
  if (/\b(laws?|ll\.?b\.?|law degree|advocate)\b/i.test(text)) {
    return { level: 4, stream: "law" };
  }

  // ── General levels ──────────────────────────────────────────

  // PhD
  if (/\b(ph\.?\s*d\.?|doctorate)\b/i.test(text)) {
    return { level: 6, stream: "general" };
  }

  // Post Graduate (general — MA/MSc/MCom/MBA)
  if (
    /\b(post[\s-]?graduat(?:e|ion)|master'?s?|m\.?sc|m\.?a\b|m\.?com|mba|mca)\b/i.test(text) ||
    /\b(msc|ma|mcom)\b/i.test(text)
  ) {
    return { level: 5, stream: "general" };
  }

  // Graduate (general — BA/BSc/BCom etc)
  if (
    /\b(graduat(?:e|ion)|bachelor'?s?|degree|b\.?sc|b\.?a\b|b\.?com|bca|bba)\b/i.test(text) ||
    /\b(bsc|ba|bcom)\b/i.test(text)
  ) {
    return { level: 4, stream: "general" };
  }

  // Diploma
  if (/\bdiploma\b/i.test(text)) {
    return { level: 3.5, stream: "general" };
  }

  // ITI
  if (/\biti\b/i.test(text)) {
    return { level: 3, stream: "general" };
  }

  // 12th
  if (/\b(12th|class xii|intermediate|higher secondary|\+2)\b/i.test(text)) {
    return { level: 3, stream: "general" };
  }

  // 10th
  if (/\b(10th|class x|matriculation|ssc pass|10 pass)\b/i.test(text)) {
    return { level: 2, stream: "general" };
  }

  // 8th
  if (/\b(8th|class viii|middle)\b/i.test(text)) {
    return { level: 1, stream: "general" };
  }

  return { level: 0, stream: "general" };
}

/**
 * Check if a user's qualification satisfies a job's requirement.
 *
 * Rules:
 * 1. User level must be >= job required level
 * 2. If job requires a specific stream (engineering, medical, etc.),
 *    user must have that SAME stream — or a higher-level qualification
 *    (e.g., M.Tech in any stream can apply for B.Tech engineering jobs,
 *     but BSc cannot apply for B.Tech engineering jobs)
 * 3. If job requires "general" stream → any stream with sufficient level is OK
 */
function isQualificationEligible(user: QualProfile, job: QualProfile): boolean {
  // Level must be sufficient
  if (user.level < job.level) return false;

  // If job needs a specific stream
  if (job.stream !== "general") {
    // User must have the SAME stream — even at a higher level
    // e.g., MSc (general) CANNOT apply for B.Tech (engineering)
    // but M.Tech (engineering) CAN apply for B.Tech (engineering)
    return user.stream === job.stream;
  }

  // Job is general stream → any stream with sufficient level is OK
  return true;
}

// ═════════════════════════════════════════════════════════════════════════
// QUALIFICATION LABEL for display
// ═════════════════════════════════════════════════════════════════════════

export function getQualLabel(qualType: string): string {
  const labels: Record<string, string> = {
    "8th": "8th Pass",
    "10th": "10th Pass",
    "12th": "12th Pass",
    "iti": "ITI",
    "diploma": "Diploma",
    "graduation": "Graduate",
    "post_graduation": "Post Graduate",
    "phd": "PhD",
  };
  return labels[qualType.toLowerCase()] ?? qualType;
}

function getJobQualLabel(qualification: string): string {
  const profile = parseJobQualRequirement(qualification);
  const levelLabels: Record<number, string> = {
    1: "8th Pass", 2: "10th Pass", 3: "12th Pass", 3.5: "Diploma",
    4: "Graduate", 5: "Post Graduate", 6: "PhD",
  };
  const base = levelLabels[profile.level] ?? "Any";
  if (profile.stream !== "general") {
    const streamLabels: Record<string, string> = {
      engineering: "B.Tech/B.E", medical: "MBBS", teaching: "B.Ed",
      law: "LLB", nursing: "Nursing", pharmacy: "Pharmacy",
    };
    return streamLabels[profile.stream] ?? base;
  }
  return base;
}

// ═════════════════════════════════════════════════════════════════════════
// AGE COMPUTATION
// ═════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════
// GRADE / GROUP INFERENCE
// ═════════════════════════════════════════════════════════════════════════

const GROUP_PATTERNS: Record<string, RegExp> = {
  "Group A": /\bgroup[\s-]?a\b/i,
  "Group B": /\bgroup[\s-]?b\b/i,
  "Group C": /\bgroup[\s-]?c\b|\bjunior\b|\bclerk\b|\bldc\b|\budc\b|\bssc\s+chsl\b|\bssc\s+cgl\b/i,
  "Group D": /\bgroup[\s-]?d\b|\bmts\b|\bpeon\b|\bsafaiwala\b|\bmulti[\s-]?tasking\b/i,
};

export function inferGrade(title: string, department: string): string | null {
  const text = `${title} ${department}`;
  for (const [group, pattern] of Object.entries(GROUP_PATTERNS)) {
    if (pattern.test(text)) return group;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK — STRICT
// ═════════════════════════════════════════════════════════════════════════

export interface EligibilityResult {
  eligible: boolean;          // No DEFINITE (verifiable) failure — age/qual confirmed-fail, gender, higher-qual
  ageOk: boolean | null;
  qualOk: boolean | null;
  skillsMissing: string[];    // Acquirable skills the user lacks → "Almost There"
  blockers: string[];         // Unverifiable / non-acquirable hard gates → "Review eligibility"
  experienceNote: string | null; // Informational experience requirement — never blocks
  reasons: string[];          // Human-readable failure reasons (for "Not Eligible" display)
}

/**
 * Single source of truth for the eligibility taxonomy. Keep all consumers
 * routed through these helpers so the rule cannot drift across the codebase.
 *
 * - canApply:    every hard, verifiable dimension affirmatively passes →
 *                show in "Eligible For You" / "Can Apply".
 * - needsReview: passes hard checks but has an unverifiable gate we cannot
 *                confirm → show in "Worth Checking — Verify Eligibility".
 */
export function canApply(e: EligibilityResult): boolean {
  return e.eligible && e.skillsMissing.length === 0 && e.blockers.length === 0;
}

export function needsReview(e: EligibilityResult): boolean {
  return e.eligible && e.blockers.length > 0;
}

export interface MatchPreferences {
  dob: string | null;
  qualificationType: string | null;  // e.g. "graduation"
  qualificationStream: QualStream;   // e.g. "general" or "engineering"
  qualificationName: string | null;  // e.g. "B.Tech in Electronics" — used for specialized requirement matching
  sectors: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  locations: string[];               // Multi-select, soft filter (sort only)
  grades: string[];                  // Multi-select, e.g. ["Group B", "Group C"]
  skills: string[];                  // e.g. ["stenography", "computer", "typing_hindi"]
  category: string | null;           // OBC/SC/ST/EWS/General — for age relaxation
  gender: string | null;             // Male/Female/Other — for gender-specific jobs
}

// ── Age Relaxation by Category ──────────────────────────────────────────


function qualLevelToNumber(level: string): number {
  return QUAL_LEVELS[level as keyof typeof QUAL_LEVELS] ?? 0;
}

function addUniqueLabel(target: string[], label: string) {
  if (label && !target.includes(label)) {
    target.push(label);
  }
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hasSpecificQualificationStream(streams: string[]): boolean {
  return streams.some((stream) => stream !== "general");
}

function userMatchesSpecialization(userQualificationName: string | null, specializations: string[]): boolean {
  // Drop generic, non-constraining "specializations" ("any discipline", "relevant
  // stream", "concerned subject") — these impose no real requirement, so a job that
  // only carries them must not be hard-failed for a mismatch.
  const meaningful = specializations.filter((specialization) => {
    const normalized = specialization.toLowerCase().trim();
    if (!normalized) return false;
    if (/\b(related|relevant|concerned|same|equivalent|appropriate|respective)\b/.test(normalized)) return false;
    const firstWord = normalized.split(/\s+/)[0];
    return !GENERIC_FIELD_WORDS.has(normalized) && !GENERIC_FIELD_WORDS.has(firstWord);
  });
  if (meaningful.length === 0) return true;

  const userText = (userQualificationName || "").toLowerCase();
  if (!userText) return false;

  return meaningful.some((specialization) => {
    const normalized = specialization.toLowerCase();
    if (userText.includes(normalized)) return true;
    return normalized
      .split(/\s+/)
      .filter((word) => word.length > 3 && !GENERIC_FIELD_WORDS.has(word))
      .some((word) => userText.includes(word));
  });
}

function getAlternativeLevelLabel(levels: string[]): string {
  if (levels.length === 0) return "required qualification";
  const highestLevel = levels.reduce((current, level) =>
    qualLevelToNumber(level) > qualLevelToNumber(current) ? level : current,
  levels[0]);
  return getQualLabel(highestLevel);
}

/**
 * Tri-state qualification evaluation.
 *  - true  → user satisfies a concrete requirement path (CONFIRMED eligible)
 *  - false → concrete requirement(s) existed but the user matches none (CONFIRMED fail)
 *  - null  → the job states a qualification we could not resolve into anything
 *            concrete (CANNOT confirm → caller treats as a blocker, not a pass)
 * Returns the matched alternative so the caller can surface its path-specific
 * hard gates (registrations, languages, experience).
 */
function evaluateStructuredQualification(
  userQual: QualProfile,
  userQualificationName: string | null,
  job: Job,
): { qualOk: boolean | null; reason: string | null; matchedAlternative: EligibilityAlternative | null } {
  const profile = getEligibilityProfile(job);

  const alternatives = profile.alternatives.filter((alternative) => alternative.qualification_levels.length > 0 || alternative.specializations.length > 0 || alternative.qualification_streams.length > 0);
  if (alternatives.length === 0) {
    const hasQualText = (job.qualification || "").trim().length > 0;
    const jobQual = parseJobQualRequirement(job.qualification || "");
    // Couldn't read a concrete level/stream from the free-form text.
    if (jobQual.level === 0 && jobQual.stream === "general") {
      // Job states a requirement we can't parse → indeterminate (do NOT auto-pass).
      // No qualification text at all → genuinely no requirement → satisfied.
      return { qualOk: hasQualText ? null : true, reason: null, matchedAlternative: null };
    }
    const qualOk = isQualificationEligible(userQual, jobQual);
    return {
      qualOk,
      reason: qualOk ? null : `Requires ${getJobQualLabel(job.qualification)}`,
      matchedAlternative: null,
    };
  }

  let sawConcreteRequirement = false;
  for (const alternative of alternatives) {
    const highestRequiredLevel = alternative.qualification_levels.reduce((current, level) =>
      Math.max(current, qualLevelToNumber(level)), 0);
    const hasStream = hasSpecificQualificationStream(alternative.qualification_streams);
    const hasSpec = alternative.specializations.length > 0;
    const hasSubjects = !!(alternative.required_subjects && alternative.required_subjects.length > 0);
    const isConcrete = highestRequiredLevel > 0 || hasStream || hasSpec || hasSubjects;
    if (isConcrete) sawConcreteRequirement = true;

    if (highestRequiredLevel > 0 && userQual.level < highestRequiredLevel) continue;
    if (hasStream && !alternative.qualification_streams.includes(userQual.stream)) continue;
    if (hasSpec && !userMatchesSpecialization(userQualificationName, alternative.specializations)) continue;
    if (hasSubjects && !userMatchesSpecialization(userQualificationName, alternative.required_subjects)) continue;

    // A purely-vacuous match (matched on nothing concrete) cannot confirm eligibility.
    if (!isConcrete) continue;

    return { qualOk: true, reason: null, matchedAlternative: alternative };
  }

  // No path satisfied. If none carried a concrete requirement, we cannot confirm.
  if (!sawConcreteRequirement) {
    return { qualOk: null, reason: null, matchedAlternative: null };
  }

  // Concrete requirements existed but the user satisfied none → CONFIRMED fail.
  const bestAlternative = alternatives.reduce((best, alternative) => {
    const bestLevel = best.qualification_levels.reduce((current, level) => Math.max(current, qualLevelToNumber(level)), 0);
    const nextLevel = alternative.qualification_levels.reduce((current, level) => Math.max(current, qualLevelToNumber(level)), 0);
    return nextLevel < bestLevel ? alternative : best;
  }, alternatives[0]);

  if (bestAlternative.specializations.length > 0) {
    return { qualOk: false, reason: `Requires ${toTitleCase(bestAlternative.specializations[0])}`, matchedAlternative: null };
  }

  if (hasSpecificQualificationStream(bestAlternative.qualification_streams)) {
    const streamLabel = getQualStreamLabel(bestAlternative.qualification_streams[0] as QualStream);
    return { qualOk: false, reason: `Requires ${streamLabel}`, matchedAlternative: null };
  }

  return { qualOk: false, reason: `Requires ${getAlternativeLevelLabel(bestAlternative.qualification_levels)}`, matchedAlternative: null };
}

function evaluateStructuredConstraints(
  userQual: QualProfile | null,
  gender: string | null,
  job: Job,
): string[] {
  const profile = getEligibilityProfile(job);
  const reasons: string[] = [];

  for (const constraint of profile.global_rules.negative_constraints) {
    if (constraint.type === "female_only" && (!gender || gender.toLowerCase() !== "female")) {
      addUniqueLabel(reasons, constraint.label);
    }
    if (constraint.type === "male_only" && (!gender || gender.toLowerCase() !== "male")) {
      addUniqueLabel(reasons, constraint.label);
    }
    if (constraint.type === "higher_qualification_not_allowed" && userQual && userQual.level >= QUAL_LEVELS.graduation) {
      addUniqueLabel(reasons, constraint.label);
    }
  }

  return reasons;
}

// ═════════════════════════════════════════════════════════════════════════
// SPECIALIZED QUALIFICATION DETECTION
// Detects "Diploma in X", "Degree in X", "Certificate in X" patterns
// that require specific subject-area qualifications beyond level+stream.
// ═════════════════════════════════════════════════════════════════════════

// Generic qualification-level words that should NOT be treated as specializations
const GENERIC_QUAL_WORDS = new Set([
  "any", "relevant", "recognized", "approved", "equivalent", "related",
  "appropriate", "concerned", "respective", "suitable", "corresponding",
]);

// Patterns that extract "in <specialization>" from eligibility text
const SPECIALIZED_QUAL_PATTERNS: RegExp[] = [
  // "Diploma in Surveyorship", "Diploma in Civil Engineering", etc.
  /\b(diploma)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // "Degree in Agriculture", "Bachelor's Degree in Fisheries"
  /\b(degree|bachelor'?s?\s*degree|master'?s?\s*degree|graduate|graduation)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // "B.Sc in Agriculture", "M.Sc in Fisheries", "B.E. in Civil Engineering"
  /\b(b\.?\s*(?:sc|tech|e|a|com|pharm|ed)|m\.?\s*(?:sc|tech|e|a|com|pharm|ed)|b\.?\s*(?:arch|lib))\s*\.?\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // "Certificate in X", "Post Graduate Certificate in X"
  /\b(certificate|certification)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // Parenthesized specialization requirements like "B.Sc (Physics)", "Diploma (Electrical Engineering)"
  /\b(diploma|degree|b\.?\s*(?:sc|tech|e|a|com|pharm|ed)|m\.?\s*(?:sc|tech|e|a|com|pharm|ed)|b\.?\s*(?:arch|lib)|graduate|graduation|certificate|certification)\s*\(\s*([a-z][a-z\s&/,]+?)\s*\)/gi,
];

function detectSpecializedRequirements(
  jobText: string,
  userQualificationName: string | null
): string[] {
  const missing: string[] = [];
  const userQualLower = (userQualificationName || "").toLowerCase();
  const seen = new Set<string>();

  for (const pattern of SPECIALIZED_QUAL_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jobText)) !== null) {
      const qualType = match[1].trim();
      const specialization = match[2].trim().replace(/[()]/g, "").replace(/\s+/g, " ");

      // Skip generic/empty specializations
      if (!specialization || specialization.length < 3) continue;
      if (GENERIC_QUAL_WORDS.has(specialization.toLowerCase())) continue;
      // Skip if first word is generic (e.g. "any recognized institution")
      const firstWord = specialization.split(/\s+/)[0].toLowerCase();
      if (GENERIC_QUAL_WORDS.has(firstWord)) continue;

      // Deduplicate
      const key = `${qualType.toLowerCase()}|${specialization.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if user's qualification_name contains the specialization
      const specLower = specialization.toLowerCase();
      const userHasSpec = userQualLower.includes(specLower) ||
        // Also check individual key terms (e.g. "surveyorship" in "Diploma in Surveyorship")
        specLower.split(/\s+/).filter(w => w.length > 3).some(word => userQualLower.includes(word));

      if (!userHasSpec) {
        // Format nicely: "Diploma in Surveyorship" → "Diploma in Surveyorship Required"
        const label = `${qualType.charAt(0).toUpperCase()}${qualType.slice(1)} in ${specialization.charAt(0).toUpperCase()}${specialization.slice(1)}`;
        missing.push(label);
      }
    }
  }

  return missing;
}

/**
 * Extract domain-specific requirements from pipe-delimited eligibility text.
 * Handles formats like:
 *   "Constitutional Law | Criminal Law | Demonstrated experience in legislative drafting, policy formulation..."
 * Short segments (≤6 words) become domain expertise labels.
 * Longer segments with "experience in X, Y, Z" get key phrases extracted.
 */
function extractDomainRequirements(
  eligibilityText: string | null,
  userQualificationName: string | null
): string[] {
  if (!eligibilityText || !eligibilityText.includes("|")) return [];

  const missing: string[] = [];
  const userQualLower = (userQualificationName || "").toLowerCase();
  const seen = new Set<string>();

  const segments = eligibilityText.split("|").map(s => s.trim()).filter(Boolean);

  // Segments describing general eligibility / application info — skip these
  const ELIGIBILITY_SENTENCE_PATTERN = /\b(candidates?\s+(from|should|must|who|are\s+eligible)|applicants?\s+(should|must|who)|eligible\s+to\s+apply|years?\s+of\s+(?:experience|service)|age\s+(?:limit|relaxat)|relaxation|reservation|upper\s+age|salary|pay\s+(?:scale|band|matrix)|probation|posting|selected\s+candidate|how\s+to\s+apply|not\s+essential|indian\s+citizen|domicile|residence\s+certificate|category\s+age|cumulative)\b/i;

  // Age / relaxation segments like "SC/ST: 5 years", "Maximum 35 years", "18 to 27 years"
  const AGE_RELAXATION_PATTERN = /^\s*(?:(?:SC|ST|OBC|EWS|PwBD|PwD|Ex[\s-]?Servicem|General|UR)[\s/]*(?:SC|ST|OBC|EWS|PwBD|PwD|NCL|Non[\s-]?Creamy)?[\s:]*\d|(?:Maximum|Minimum|Not exceeding|Max|Min)\s+\d+\s*years?|\d+\s*(?:to|-)\s*\d+\s*years?|Category\s+Age|Post\s+(?:Name|Max\s+Age)|Note:|Age\s+Relaxation|Only\s+Indian)/i;

  // Post-wise table header segments
  const TABLE_HEADER_PATTERN = /^\s*(?:Post\s+Name\s+Qualification|Educational\s+Qualification\s*&\s*Age|Essential\s+Qualification\s+Experience|Post\s+Max\s+Age)/i;

  // Qualification-level terms already handled by the level/stream system — skip
  const QUAL_LEVEL_PATTERN = /^\s*(graduation|graduate|post[\s-]?graduat|bachelor|master|diploma|iti|12th|10th|8th|class\s+(?:x|xii|viii)|matriculation|degree\s+in\s+any|any\s+(?:degree|graduate)|phd|doctorate|b\.?tech|m\.?tech|mbbs|llb|b\.?ed|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|b\.?com|m\.?com|bca|mca|mba|gnm|anm|d\.?pharm|b\.?pharm|bams|bhms|bums|bsms|bnys)\s*$/i;

  for (const segment of segments) {
    const wordCount = segment.trim().split(/\s+/).length;
    const segLower = segment.toLowerCase().trim();

    // Skip empty or starts with a number
    if (segLower.length < 3 || /^\d/.test(segLower)) continue;

    // Skip general eligibility/application sentence fragments
    if (ELIGIBILITY_SENTENCE_PATTERN.test(segment)) continue;

    // Skip age/relaxation segments
    if (AGE_RELAXATION_PATTERN.test(segment)) continue;

    // Skip table headers
    if (TABLE_HEADER_PATTERN.test(segment)) continue;

    // ── Short segments (1–6 words) → domain / subject area labels ──
    if (wordCount <= 6) {
      // Skip pure qualification-level terms
      if (QUAL_LEVEL_PATTERN.test(segment)) continue;
      if (GENERIC_QUAL_WORDS.has(segLower)) continue;

      if (seen.has(segLower)) continue;
      seen.add(segLower);

      const userHasDomain = userQualLower.includes(segLower) ||
        segLower.split(/\s+/).filter(w => w.length > 3).some(word => userQualLower.includes(word));

      if (!userHasDomain) {
        missing.push(segment.trim());
      }
    }

    // ── Longer segments → extract "experience/expertise in X, Y, Z" phrases ──
    else {
      const expPattern = /(?:experience|expertise|proficiency|specialization|knowledge)\s+(?:in|of|with)\s+(.+?)(?:\s*[.;]\s*|$)/gi;
      expPattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = expPattern.exec(segment)) !== null) {
        const rawList = match[1];
        const parts = rawList
          .split(/,\s*|\s+and\s+/)
          .map(p => p.trim())
          .filter(p => p.length > 3 && p.split(/\s+/).length <= 5);
        for (const part of parts) {
          const partLower = part.toLowerCase();
          if (seen.has(partLower)) continue;
          seen.add(partLower);
          if (!userQualLower.includes(partLower)) {
            missing.push(part.charAt(0).toUpperCase() + part.slice(1));
          }
        }
      }
    }
  }

  return missing;
}

// Regex skill keys that are NOT quick, acquirable skills — they are hard gates
// the user either has or does not, so they route to `blockers` (Review) rather
// than `skillsMissing` (Almost There).
const BLOCKER_SKILL_KEYS = new Set([
  "hindi_proficiency",  // language proficiency gate (strict regex, not a mere mention)
  "local_language",
  "sanskrit",
  "physical_fitness",   // height/chest/running standards — cannot be "learned" quickly
  "rci_registration",   // statutory registration
]);

// ═════════════════════════════════════════════════════════════════════════
// CONJUNCTIVE / SPECIALIZED QUALIFICATION GATE  ("X AND Y", specific subject)
//
// The level/stream matcher confirms eligibility on LEVEL alone. That silently
// passes a job when its path actually demands something SPECIFIC the user may
// not hold — a named diploma/specialization ("Diploma (MLT/DMLT)"), a required
// subject ("…with Biological Science as paper"), or a second stacked credential
// ("Graduation AND B.Ed").
//
// This gate decomposes the qualification text into OR-paths (the user needs to
// satisfy ANY ONE), where WITHIN a path requirements are conjunctive (AND).
// It returns short "needs" labels ONLY when NO path is fully satisfiable, so the
// caller can route the job to "Worth Checking — Verify Eligibility" with a chip
// naming exactly what is unmet. Strict-when-ambiguous: an unconfirmable specific
// never silently passes.
// ═════════════════════════════════════════════════════════════════════════

// Field words that impose no real specialization — they make a requirement generic.
const GENERIC_FIELD_WORDS = new Set([
  ...GENERIC_QUAL_WORDS,
  "discipline", "disciplines", "stream", "streams", "subject", "subjects", "field",
  "fields", "branch", "branches", "faculty", "specialisation", "specialization",
  "group", "groups", "any stream", "any discipline", "any subject",
]);

// Qualification-level tokens — used to detect where a comma segment starts a NEW
// eligibility path vs. continues a subject list ("Physics, Chemistry and Maths").
const QUAL_LEVEL_TOKEN_RE = /\b(diploma|degree|graduat\w*|bachelor'?s?|master'?s?|post[\s-]?graduat\w*|b\.?\s*sc|b\.?\s*tech|b\.?\s*e|b\.?\s*a|b\.?\s*com|b\.?\s*ed|m\.?\s*sc|m\.?\s*a|m\.?\s*com|m\.?\s*tech|llb|llm|mbbs|bds|iti|sslc|ssc|matric\w*|hsc|10th|12th|10\+2|intermediate|pg\s*diploma|mba|mca|bca|certificate|d\.?\s*pharm|b\.?\s*pharm|gnm|anm|mlt|dmlt)\b/i;

// Quick, acquirable skills — these belong in `skillsMissing` (Almost There), so the
// gate must NOT surface them as conjunctive credential blockers.
const QUICK_SKILL_KEYS = new Set([
  "stenography", "computer", "typing_hindi", "typing_english", "driving", "swimming",
]);

function isGenericField(field: string): boolean {
  const f = field.trim().toLowerCase();
  if (f.length < 2) return true;
  if (GENERIC_FIELD_WORDS.has(f)) return true;
  const firstWord = f.split(/\s+/)[0];
  if (GENERIC_FIELD_WORDS.has(firstWord)) return true;
  // Pure qualification-level phrasing carries no specialization of its own.
  return /^(master'?s?|bachelor'?s?|hons?\.?|honou?rs|regular|full[\s-]?time|part[\s-]?time|degree|diploma|graduation|graduate|pass(?:ed)?|10\+2|llb|llm|b\.?ed)$/i.test(f);
}

function isAcquirableSkillField(field: string): boolean {
  const f = ` ${field.toLowerCase()} `;
  for (const key of QUICK_SKILL_KEYS) {
    const pattern = SKILL_KEYWORDS[key];
    if (pattern && pattern.test(f)) return true;
  }
  return /typewrit/i.test(f);
}

function looksLikeSubject(field: string): boolean {
  const f = field.toLowerCase();
  if (/\bscience\b/.test(f)) return true;
  return /\b(physics|chemistry|maths?|mathematics|biology|biological|botany|zoology|statistics|economics|geography|history|commerce|accountancy|computer|electronics|agriculture|geology|microbiology|biotechnology|sociology|psychology|political|philosophy|sanskrit|hindi|english|geog)\b/.test(f);
}

function cleanField(raw: string): string {
  return raw
    .replace(/[()]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

// Low-signal subject words that need not independently match — the distinctive
// token carries the meaning ("Biological Science" ↔ "B.Sc Biology").
const SUBJECT_STOPWORDS = new Set([
  "science", "sciences", "studies", "applied", "general", "hons", "honours",
  "honors", "degree", "graduate", "graduation", "and",
]);

// Does the user's free-form qualification name satisfy a required field/subject?
// Root-based so "B.Sc Biology" matches a "Biological Science" requirement.
function userHoldsField(userQualificationName: string | null, field: string): boolean {
  const user = (userQualificationName || "").toLowerCase();
  if (!user) return false;
  const tokens = field.toLowerCase().split(/[\s/&,]+/).filter(Boolean);
  // Every distinctive token of the requirement must be reflected in the user's name.
  let meaningful = tokens.filter((t) => t.length >= 3 && !GENERIC_FIELD_WORDS.has(t) && !SUBJECT_STOPWORDS.has(t));
  // If only low-signal words remained (e.g. the field was just "Science"), fall back
  // to those so we still require *some* overlap rather than matching everything.
  if (meaningful.length === 0) meaningful = tokens.filter((t) => t.length >= 3 && !GENERIC_FIELD_WORDS.has(t));
  if (meaningful.length === 0) return false;
  return meaningful.every((token) => {
    if (user.includes(token)) return true;
    const root = token.slice(0, Math.min(5, token.length));
    return new RegExp(`\\b${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(user);
  });
}

interface SpecificRequirement {
  label: string;   // short, human chip text (e.g. "Diploma (MLT/DMLT)", "Biological Science")
  field: string;   // matchable field for userHoldsField
}

function extractPathSpecifics(path: string): SpecificRequirement[] {
  const specifics: SpecificRequirement[] = [];
  const seen = new Set<string>();
  const push = (label: string, field: string) => {
    const key = field.toLowerCase();
    if (!field || seen.has(key)) return;
    if (isAcquirableSkillField(field)) return; // acquirable → skillsMissing, not a blocker
    seen.add(key);
    specifics.push({ label, field });
  };

  // 1. Parenthetical specialization after a qualification keyword: "Diploma (MLT/DMLT)".
  for (const m of path.matchAll(/\b(diploma|degree|graduat\w*|certificate|b\.?\s*sc|b\.?\s*tech|b\.?\s*ed|b\.?\s*a|m\.?\s*sc|pg\s*diploma)\s*\(([^)]+)\)/gi)) {
    const field = cleanField(m[2]);
    if (isGenericField(field)) continue;
    const qual = toTitleCase(cleanField(m[1]).replace(/\s+/g, ""));
    push(`${qual} (${field.toUpperCase().length <= 8 ? field.toUpperCase() : toTitleCase(field)})`, field);
  }

  // 2. "<qualification> in <field>": "Diploma in Surveyorship", "Degree in Agriculture".
  for (const m of path.matchAll(/\b(diploma|degree|bachelor'?s?|master'?s?|graduat\w*|certificate|pg\s*diploma|b\.?\s*sc|b\.?\s*tech|m\.?\s*sc|b\.?\s*a|b\.?\s*ed|b\.?\s*pharm|d\.?\s*pharm)\s+(?:in|of)\s+([a-z][a-z &/]*?)(?=\s+(?:with|from|or\b|and\b|as\b|under|recognized|recognised|having|plus|\+|issued|approved|degree|diploma)|[.,;]|$)/gi)) {
    const field = cleanField(m[2]);
    if (isGenericField(field)) continue;
    push(toTitleCase(field), field);
  }

  // 3. Required subject "<subject> as a paper/subject/optional".
  for (const m of path.matchAll(/(?:^|\bwith\b|\bhaving\b|\bincluding\b|,)\s*([a-z][a-z]+(?:\s+[a-z]+){0,2})\s+as\s+(?:an?\s+)?(?:paper|subject|optional|elective|main\s+subject)\b/gi)) {
    const field = cleanField(m[1]);
    if (isGenericField(field) || !looksLikeSubject(field)) continue;
    push(toTitleCase(field), field);
  }

  // 4. "with <subject>" where the field reads like an academic subject.
  for (const m of path.matchAll(/\bwith\s+([a-z][a-z &]*?)(?=\s+(?:as\b|in\s+class|in\s+xi|in\s+11|in\s+10|subject|paper|degree|diploma)|[.,;]|$)/gi)) {
    const field = cleanField(m[1]);
    if (isGenericField(field) || !looksLikeSubject(field)) continue;
    push(toTitleCase(field), field);
  }

  // 5. Second stacked credential after an AND-conjunction: "Graduation AND B.Ed".
  for (const m of path.matchAll(/\b(?:and|&|along\s+with|in\s+addition\s+to|as\s+well\s+as|plus)\s+(?:an?\s+|a\s+)?((?:pg\s*diploma|b\.?\s*ed|d\.?\s*el\.?\s*ed|llb|llm|b\.?\s*tech|m\.?\s*tech|mba|mca|diploma(?:\s+in\s+[a-z &]+)?|degree\s+in\s+[a-z &]+)\b)/gi)) {
    const cred = cleanField(m[1]);
    if (!cred) continue;
    // Generic-only ("…and a degree") carries no extra specificity.
    if (/^(degree|diploma|graduation|graduate)$/i.test(cred)) continue;
    push(toTitleCase(cred), cred);
  }

  return specifics;
}

// Split qualification text into OR-paths. ` or ` and spaced ` / ` are disjunctions;
// commas start a new path ONLY when the next segment names its own qualification
// level (so "Physics, Chemistry and Maths" stays one subject list). Parentheses are
// protected so "(MLT/DMLT)" is never split.
function splitQualificationPaths(text: string): string[] {
  const parens: string[] = [];
  const protectedText = text.replace(/\([^)]*\)/g, (m) => {
    parens.push(m);
    return ` ${parens.length - 1} `;
  });

  const restore = (s: string) => s.replace(/ (\d+) /g, (_, i) => parens[Number(i)] ?? "");

  const orPaths = protectedText
    .split(/\s+\bor\b\s+|\s+\/\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const orPath of orPaths) {
    const segments = orPath.split(",");
    let current = "";
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;
      if (current && !QUAL_LEVEL_TOKEN_RE.test(trimmed)) {
        current += `, ${trimmed}`; // continuation (subject list / experience clause)
      } else {
        if (current) result.push(restore(current));
        current = trimmed;
      }
    }
    if (current) result.push(restore(current));
  }
  return result.length > 0 ? result : [restore(protectedText)];
}

/**
 * Returns 1–2 short "needs" labels when NO eligibility path is fully satisfiable
 * for the user, i.e. every path demands a specific specialization / subject /
 * stacked credential the user cannot be confirmed to hold. Returns [] when at
 * least one path is cleanly satisfiable (no veto).
 */
export function findUnmetQualificationSpecifics(
  job: Job,
  userQual: QualProfile,
  userQualificationName: string | null,
): string[] {
  const unmet: SpecificRequirement[] = [];
  const seen = new Set<string>();
  const addUnmet = (specifics: SpecificRequirement[]) => {
    for (const spec of specifics) {
      const key = spec.field.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unmet.push(spec);
    }
  };

  // ── (A) Authoritative OR-path analysis on the QUALIFICATION column ──────────
  // The user needs to satisfy ANY ONE path; only the qualification column carries
  // these alternatives. (Eligibility/summary prose must never become an easy
  // alternative path — that would re-open the leak — so it is handled in (B).)
  const qualText = (job.qualification || "").trim();
  if (qualText) {
    const paths = splitQualificationPaths(qualText);
    let closestUnmet: SpecificRequirement[] | null = null;
    let cleanPathExists = false;

    for (const path of paths) {
      const parsed = parseJobQualRequirement(path);
      const levelStreamOk = isQualificationEligible(userQual, parsed);
      const specifics = extractPathSpecifics(path).filter((s) => !userHoldsField(userQualificationName, s.field));

      if (levelStreamOk && specifics.length === 0) {
        cleanPathExists = true;
        break;
      }

      // Track unmet specifics only on paths whose level is reachable; a pure level
      // shortfall is the structured matcher's job, not this gate's.
      const levelReachable = parsed.level === 0 || userQual.level >= parsed.level;
      if (specifics.length > 0 && levelReachable) {
        if (!closestUnmet || specifics.length < closestUnmet.length) closestUnmet = specifics;
      }
    }

    if (!cleanPathExists && closestUnmet) addUnmet(closestUnmet);
  }

  // ── (B) Extra AND-constraints from the eligibility text + Grok AI summary ────
  // These ADD requirements on top of the qualification (subjects, named diplomas,
  // stacked credentials the recruiter spells out in prose), so an unmet one routes
  // the job to "Worth Checking" even when the qualification column looked clean.
  const extraText = [job.eligibility, job.eligibility_summary]
    .filter(Boolean)
    .join(" . ")
    .replace(/\s+/g, " ")
    .trim();
  if (extraText) {
    addUnmet(extractPathSpecifics(extraText).filter((s) => !userHoldsField(userQualificationName, s.field)));
  }

  return unmet.slice(0, 2).map((s) => s.label);
}

export function checkEligibility(
  userAge: number | null,
  userQual: QualProfile | null,
  job: Job,
  category: string | null = null,
  gender: string | null = null,
  userSkills: string[] = [],
  userQualificationName: string | null = null
): EligibilityResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let ageOk: boolean | null = null;
  let qualOk: boolean | null = null;
  const profile = getEligibilityProfile(job);
  const structuredQualification = userQual ? evaluateStructuredQualification(userQual, userQualificationName, job) : null;
  const matchedAlt = structuredQualification?.matchedAlternative ?? null;
  const reviewNeeded =
    profile.quality_flags.includes("review_needed") ||
    profile.quality_flags.includes("manual_review") ||
    profile.quality_flags.includes("post_wise_eligibility");

  // ── STRICT Age Check (with category relaxation) ───────────────
  const profileAgeRule = profile.global_rules.age_rule;
  const hasProfileAgeReq = (profileAgeRule?.min && profileAgeRule.min >= 10) || (profileAgeRule?.max && profileAgeRule.max >= 10);
  const hasAgeReq = hasProfileAgeReq || (job.age_min && job.age_min >= 10) || (job.age_max && job.age_max >= 10);
  if (hasAgeReq) {
    if (userAge === null) {
      // Job has an age bar but we don't know the user's age → cannot confirm.
      addUniqueLabel(blockers, "Age limit applies — add your date of birth to confirm");
    } else {
      let relaxation = 0;
      if (category) {
        const userCatLower = category.toLowerCase();
        const customRelaxations = profileAgeRule?.relaxations || [];
        const matchedRule = customRelaxations.find((r) => {
          const ruleCatLower = r.category.toLowerCase();
          return ruleCatLower.includes(userCatLower) || userCatLower.includes(ruleCatLower) ||
                 (userCatLower === "st" && ruleCatLower.includes("st")) ||
                 (userCatLower === "sc" && ruleCatLower.includes("sc"));
        });
        if (matchedRule && typeof matchedRule.years === "number") {
          relaxation = matchedRule.years;
        } else {
          relaxation = 0;
        }
      }

      const min = (profileAgeRule?.min && profileAgeRule.min >= 10)
        ? profileAgeRule.min
        : (job.age_min && job.age_min >= 10) ? job.age_min : 0;
      const max = (profileAgeRule?.max && profileAgeRule.max >= 10)
        ? profileAgeRule.max + relaxation
        : (job.age_max && job.age_max >= 10) ? job.age_max + relaxation : 100;
      ageOk = userAge >= min && userAge <= max;
      if (!ageOk) {
        if (userAge < min) reasons.push(`Min age ${min}, you are ${userAge}`);
        else reasons.push(`Max age ${max - relaxation}${relaxation > 0 ? ` (+${relaxation} relaxation)` : ""}, you are ${userAge}`);
      }
    }
  }

  // ── STRICT Qualification Check (tri-state) ────────────────────
  if (userQual !== null && job.qualification) {
    qualOk = structuredQualification?.qualOk ?? null;
    if (qualOk === false && structuredQualification?.reason) {
      reasons.push(structuredQualification.reason);
    } else if (qualOk === null) {
      // Job states a qualification we couldn't resolve → cannot confirm.
      addUniqueLabel(blockers, "Qualification criteria need manual review");
    }
  } else if (userQual === null && (job.qualification || "").trim()) {
    // We don't know the user's qualification but the job requires one.
    addUniqueLabel(blockers, "Add your qualification to confirm eligibility");
  }

  // ── Conjunctive / specialized qualification gate ("X AND Y", required subject) ──
  // The level/stream check above can confirm on level alone while the path actually
  // demands a specific specialization, subject, or stacked credential the user does
  // not hold. When NO path is cleanly satisfiable, surface the unmet part as a short
  // "Needs: X" blocker so the job routes to "Worth Checking" instead of can-apply.
  if (userQual !== null && qualOk !== false) {
    for (const label of findUnmetQualificationSpecifics(job, userQual, userQualificationName)) {
      addUniqueLabel(blockers, `Needs: ${label}`);
    }
  }

  // ── Gender Check ──────────────────────────────────────────────
  let genderOk: boolean | null = null;
  if (gender && job.title) {
    const titleLower = job.title.toLowerCase();
    const isFemaleOnly = /\b(women|female|mahila)\b/i.test(titleLower) && !/\b(male|men)\b/i.test(titleLower);
    const isMaleOnly = /\b(male only|men only)\b/i.test(titleLower);
    if (isFemaleOnly && gender.toLowerCase() !== "female") {
      genderOk = false;
      reasons.push("Female candidates only");
    } else if (isMaleOnly && gender.toLowerCase() !== "male") {
      genderOk = false;
      reasons.push("Male candidates only");
    }
  }

  for (const constraintReason of evaluateStructuredConstraints(userQual, gender, job)) {
    genderOk = false;
    addUniqueLabel(reasons, constraintReason);
  }

  // ── Unverifiable hard gates → BLOCKERS (Review eligibility) ────
  if (reviewNeeded) {
    addUniqueLabel(blockers, "Eligibility varies by post — verify manually");
  }
  for (const residency of profile.global_rules.residency_rules) {
    addUniqueLabel(blockers, residency.label);
  }
  for (const registration of [...profile.global_rules.required_registrations, ...(matchedAlt?.required_registrations ?? [])]) {
    if (registration.key !== "rci") addUniqueLabel(blockers, registration.label); // rci handled by regex below
  }
  for (const language of [...profile.global_rules.required_languages, ...(matchedAlt?.required_languages ?? [])]) {
    // Generic English/Hindi mentions are too noisy to gate on; regional-language and
    // strict Hindi-proficiency gates are handled via regional rules + the regex loop.
    if (!["english", "hindi", "local_language"].includes(language.key)) addUniqueLabel(blockers, language.label);
  }
  for (const physicalRule of profile.global_rules.physical_rules) {
    if (physicalRule.type === "medical_fitness") addUniqueLabel(blockers, physicalRule.label); // height/chest covered by regex
  }

  // ── Skill Requirement Check (acquirable → skillsMissing; gates → blockers) ──
  const jobText = `${job.qualification || ""} ${job.eligibility || ""} ${job.title || ""}`.toLowerCase();
  const skillsMissing: string[] = [];
  const normalizedUserSkills = userSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean);

  for (const [skillKey, pattern] of Object.entries(SKILL_KEYWORDS)) {
    if (pattern.test(jobText) && !normalizedUserSkills.includes(skillKey)) {
      if (BLOCKER_SKILL_KEYS.has(skillKey)) {
        addUniqueLabel(blockers, getSkillLabel(skillKey));
      } else {
        addUniqueLabel(skillsMissing, getSkillLabel(skillKey));
      }
    }
  }

  // Specialized-subject requirements (e.g. "Diploma in Surveyorship") are qualification
  // gates the user does not visibly hold — route to Review, not Almost There.
  if (!reviewNeeded && qualOk !== true) {
    const specializedMissing = detectSpecializedRequirements(jobText, userQualificationName);
    for (const label of specializedMissing) {
      addUniqueLabel(blockers, label);
    }
  }

  // ── Experience requirement → informational only (never blocks) ──
  let experienceNote: string | null = null;
  const expRule = matchedAlt?.experience_rule || profile.global_rules.experience_rule;
  if (expRule && expRule.minimum_years && expRule.minimum_years > 0) {
    experienceNote = `${expRule.minimum_years}+ yr${expRule.minimum_years > 1 ? "s" : ""} experience`;
    if (expRule.domains && expRule.domains.length > 0) {
      experienceNote += ` (${expRule.domains.slice(0, 2).join(", ")})`;
    }
  }

  // `eligible` = no DEFINITE verifiable failure. The "can apply" list is gated by
  // canApply() which additionally requires blockers + skills to be empty.
  const eligible = (ageOk === null || ageOk) && (qualOk === null || qualOk) && (genderOk === null || genderOk);

  return { eligible, ageOk, qualOk, skillsMissing, blockers, experienceNote, reasons };
}

// ═════════════════════════════════════════════════════════════════════════
// HARD FILTERS — salary, location, grade
// These EXCLUDE jobs from results (not just scoring)
// ═════════════════════════════════════════════════════════════════════════

function passesSalaryFilter(job: Job, prefMin: number | null, prefMax: number | null): boolean {
  if (prefMin === null && prefMax === null) return true;
  // If job has no salary info → include it (unknown salary)
  if (job.salary_min === null && job.salary_max === null) return true;

  const jobMin = job.salary_min ?? 0;
  const jobMax = job.salary_max ?? Infinity;
  const pMin = prefMin ?? 0;
  const pMax = prefMax ?? Infinity;

  // Check overlap
  return jobMax >= pMin && jobMin <= pMax;
}


function passesGradeFilter(job: Job, prefGrades: string[]): boolean {
  if (prefGrades.length === 0) return true;
  const jobGrade = inferGrade(job.title, job.department);
  if (!jobGrade) return true; // Unknown grade → include
  return prefGrades.includes(jobGrade);
}

// Location is now a SOFT filter — used only for sorting, not exclusion
function locationMatchScore(job: Job, prefLocations: string[]): number {
  if (prefLocations.length === 0) return 0;
  const bestLoc = getBestJobLocation(job);
  const resolvedState = resolveStateFromLocationText(bestLoc) || resolveStateFromLocationText(job.location);
  const isNationwide = isAllIndiaLocationText(job.location);
  const matchesPreferredState = prefLocations.some((pref) => {
    const prefLower = pref.toLowerCase();
    return (
      bestLoc.toLowerCase().includes(prefLower) ||
      (resolvedState ? resolvedState.toLowerCase() === prefLower : false)
    );
  });
  if (matchesPreferredState) return 3;

  if (isNationwide) return 2;

  return 0;
}

// ═════════════════════════════════════════════════════════════════════════
// SKILL MATCHING
// ═════════════════════════════════════════════════════════════════════════

const SKILL_KEYWORDS: Record<string, RegExp> = {
  // ── Core skills ────────────────────────────────────────
  stenography: /\b(steno|stenograph|shorthand)\b/i,
  computer: /\b(computer|ccc|nielit|rscit|ms[\s-]?cit|pgdca|\bdca\b|o[\s-]?level|copa|data\s*entry|ms[\s-]?office|tally|computer\s*(?:knowledge|proficien|applicat|basics|literat))\b/i,
  typing_hindi: /\b(hindi\s*typ|typing.*hindi|hindi.*typing|mangal)\b/i,
  typing_english: /\b(english\s*typ|typing.*english|english.*typing|typewrit\w*|typing\s*speed|35\s*wpm|40\s*wpm)\b/i,
  driving: /\b(driv|lmv|hmv|motor\s*vehicle|driving\s*licen)\b/i,
  swimming: /\b(swim)\b/i,
  physical_fitness: /\b(physical\s*(test|fitness|standard|efficien|endurance)|1600\s*m|800\s*m|height.*\d{2,3}\s*cm|chest.*\d{2,3}\s*cm|\d+\s*(?:km|meters?)\s*(?:run|walk)|(?:long|high)\s*jump|height.*chest)\b/i,
  braille: /\b(braille)\b/i,
  sign_language: /\b(sign\s*language)\b/i,
  rci_registration: /\b(rci\s*(regist|recogni))\b/i,
  special_education: /\b(special\s*education|d\.?ed\.?\s*spl|b\.?ed\.?\s*spl)\b/i,
  // ── Professional certifications ────────────────────────
  gate_score: /\b(gate\s*(scor|qualif|rank|valid)|\bGPAT\b)\b/i,
  net_slet: /\b(ugc[\s-]?net|csir[\s-]?net|\bslet\b|\bjrf\b|net[\s-]qualified)\b/i,
  ca_icwa: /\b(chartered\s*accountant|\bCA\s*[(/]|\bCA\b\s*\/|\bICWA\b|\bICMA[I]?\b|\bCMA\b\s*[(/]|company\s*secretary|\bICSI\b|\bICW?AI\b)\b/i,
  cti_cits: /\b(cti|cits|craftsmen?\s*training)\b/i,
  jaiib_caiib: /\b(JAIIB|CAIIB)\b/i,
  cfa_frm: /\b(\bCFA\b|\bFRM\b|\bPRM\b|chartered\s*financial\s*analyst|financial\s*risk\s*manager)\b/i,
  nism: /\bNISM\b/i,
  pmp: /\bPMP\b/i,
  ccna_networking: /\b(CCNA|CCNP|CompTIA)\b/i,
  afih: /\bAFIH\b/i,
  boe_certificate: /\b(BOE|[Bb]oiler\s*[Oo]peration\s*[Ee]ngineer)\b/i,
  fssai: /\bFSSAI\b/i,
  nis_coaching: /\b(NIS\s*[Dd]iploma|[Dd]iploma.*\bNIS\b|\bSAI\s*NS\s*NIS\b)\b/i,
  medical_coding: /\b(medical\s*cod|ICD[\s-]?10|medical\s*terminolog)\b/i,
  // ── Language skills ────────────────────────────────────
  hindi_proficiency: /\b(proficien\w*\s+in\s+hindi|hindi\s+(proficien|knowledge|medium)|knowledge\s+of\s+hindi|must\s+know\s+hindi)\b/i,
  local_language: /\b(local\s+language|regional\s+language|(?:knowledge|proficien\w*|fluent|fluency|must\s+know|read.*write)\s+(?:in\s+|of\s+)?(?:tamil|telugu|kannada|malayalam|bengali|marathi|gujarati|odia|odiya|punjabi|assamese|urdu|konkani|manipuri|meitei|mizo|bodo|dogri|maithili|santali|sindhi|nepali|kashmiri|rajasthani)|(?:tamil|telugu|kannada|malayalam|bengali|marathi|gujarati|odia|odiya|punjabi|assamese|urdu|konkani|manipuri|meitei|mizo)\s+(?:language|medium|proficien|knowledge|is\s+(?:essential|mandatory|required)))\b/i,
  sanskrit: /\b(sanskrit)\b/i,
  // ── Software / tech skills ─────────────────────────────
  autocad: /\b(auto\s*cad|autocad)\b/i,
  gis: /\b(gis|geographic\s*information\s*system|geo[\s-]?informatics|remote\s*sensing)\b/i,
  sap_erp: /\b(sap\s*(erp|fico|mm|sd)?|\berp\b)\b/i,
  programming: /\b(programming|python|java\b|c\+\+|javascript|coding\s+skill)\b/i,
  // ── Domain-specific skills ─────────────────────────────
  surveying: /\b(survey(or|ing|orship))\b/i,
  agriculture: /\b(agricultur|agri\s*science|krishi|agronomy)\b/i,
  fisheries: /\b(fisher|pisciculture|aquaculture)\b/i,
  forestry: /\b(forest(ry|er)|sylviculture)\b/i,
  veterinary: /\b(veterinar|animal\s*husbandry)\b/i,
  horticulture: /\b(horticultur)\b/i,
  geology: /\b(geolog)\b/i,
  textile: /\b(textile\s*(technolog|engineering|science))\b/i,
  food_technology: /\b(food\s*(technolog|science|processing))\b/i,
  physiotherapy: /\b(physiotherap|\bBPT\b|\bMPT\b)\b/i,
  clinical_psychology: /\b(clinical\s*psycholog|m\.?phil\.?\s*(?:in\s*)?(?:clinical|psychiatric)|psychiatric\s*social)\b/i,
  social_work: /\b(social\s*work|\bMSW\b|\bBSW\b)\b/i,
  biotechnology: /\b(biotechnolog|biomedical)\b/i,
  public_health: /\b(public\s*health|\bMPH\b|community\s*medicine|epidemiolog)\b/i,
};

function skillMatchScore(job: Job, userSkills: string[]): number {
  if (userSkills.length === 0) return 0;
  const jobText = `${job.title} ${job.qualification} ${job.eligibility || ""}`.toLowerCase();
  let score = 0;
  for (const skill of userSkills) {
    const normalizedSkill = skill.trim().toLowerCase();
    if (!normalizedSkill) continue;
    const pattern = SKILL_KEYWORDS[normalizedSkill];
    if (pattern && pattern.test(jobText)) score += 1;
    else if (!pattern && jobText.includes(normalizedSkill)) score += 1;
  }
  return score;
}

// ═════════════════════════════════════════════════════════════════════════
// PRIORITY SCORING (for sorting within eligible jobs)
// Salary/grade are hard-filtered. Location + skills + sector + urgency = sort signals.
// ═════════════════════════════════════════════════════════════════════════

export function scorePriority(job: Job, prefs: MatchPreferences): number {
  let score = 0;
  const today = new Date();

  // Location match (+2 for matching state / All India)
  score += locationMatchScore(job, prefs.locations);

  // Sector match (+3)
  if (prefs.sectors.length > 0) {
    const sectorMatch = prefs.sectors.some(
      (s) => matchesSectorPreference(job.department, job.title, s)
    );
    if (sectorMatch) score += 3;
  }

  // Skill match (+1 per matching skill)
  score += skillMatchScore(job, prefs.skills);

  // Urgency boost — closing-soon jobs rank higher
  const lastDate = parseJobDeadline(job.last_date);
  if (lastDate) {
    const daysLeft = (lastDate.getTime() - today.getTime()) / 86400000;
    if (daysLeft <= 7) score += 2;
    else if (daysLeft <= 15) score += 1;
  }

  // Higher vacancies get a small boost
  if (job.vacancies && job.vacancies >= 100) score += 1;

  return score;
}

// ═════════════════════════════════════════════════════════════════════════
// MATCH & SORT
// ═════════════════════════════════════════════════════════════════════════

export interface MatchedJob {
  job: Job;
  eligibility: EligibilityResult;
  priorityScore: number;
}

export function matchAndSort(
  jobs: Job[],
  prefs: MatchPreferences
): MatchedJob[] {
  const today = new Date();
  const userAge = prefs.dob ? computeAge(prefs.dob) : null;
  const userQual: QualProfile | null = prefs.qualificationType
    ? getUserQualProfileWithStream(prefs.qualificationType, prefs.qualificationStream)
    : null;

  return jobs
    // 1. Remove expired jobs (keep jobs with unparseable dates like TBD)
    .filter((job) => {
      const d = parseJobDeadline(job.last_date);
      if (!d) return true;
      return d >= today;
    })
    // 2. Apply hard filters (salary + grade — NOT location)
    .filter((job) => passesSalaryFilter(job, prefs.salaryMin, prefs.salaryMax))
    .filter((job) => passesGradeFilter(job, prefs.grades))
    // 3. Compute eligibility + priority
    .map((job) => {
      const eligibility = checkEligibility(userAge, userQual, job, prefs.category, prefs.gender, prefs.skills, prefs.qualificationName);
      const priorityScore = scorePriority(job, prefs);
      return { job, eligibility, priorityScore };
    })
    // 4. Sort: eligible first → higher priority → more vacancies
    .sort((a, b) => {
      if (a.eligibility.eligible !== b.eligibility.eligible) {
        return a.eligibility.eligible ? -1 : 1;
      }
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return (b.job.vacancies || 0) - (a.job.vacancies || 0);
    });
}

// Legacy exports for backward compat (used by Recommendations.tsx)
export function getEducationRank(qualificationType: string): number {
  return QUAL_LEVELS[qualificationType.toLowerCase() as keyof typeof QUAL_LEVELS] ?? 0;
}
