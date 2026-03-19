import { Job } from "@/types/job";
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

  // ── Detect specialization requirements ───────────────────────

  // Engineering (B.Tech / B.E)
  if (
    text.includes("b.tech") || text.includes("btech") ||
    text.includes("b.e.") || text.includes("b.e ") || text.includes("b.e,") ||
    (text.includes("engineering") && (text.includes("graduate") || text.includes("degree")))
  ) {
    return { level: 4, stream: "engineering" };
  }

  // M.Tech / ME (post-grad engineering)
  if (text.includes("m.tech") || text.includes("mtech") || text.includes("m.e.") || text.includes("m.e ")) {
    return { level: 5, stream: "engineering" };
  }

  // Medical / MBBS
  if (text.includes("mbbs") || text.includes("medical degree") || text.includes("bds")) {
    return { level: 4, stream: "medical" };
  }

  // Nursing
  if (text.includes("nursing") || text.includes("b.sc nursing") || text.includes("gnm")) {
    return { level: 4, stream: "nursing" };
  }

  // Pharmacy
  if (text.includes("pharmacy") || text.includes("b.pharm") || text.includes("d.pharm")) {
    return { level: text.includes("d.pharm") ? 3.5 : 4, stream: "pharmacy" };
  }

  // Teaching (B.Ed / TET)
  if (text.includes("b.ed") || text.includes("bed") || text.includes("tet") || text.includes("ctet")) {
    return { level: 4, stream: "teaching" };
  }

  // Law
  if (text.includes("llb") || text.includes("l.l.b") || text.includes("law degree") || text.includes("advocate")) {
    return { level: 4, stream: "law" };
  }

  // ── General level detection (no specific stream) ─────────────

  // PhD
  if (text.includes("phd") || text.includes("doctorate")) {
    return { level: 6, stream: "general" };
  }

  // Post Graduate (general — MA/MSc/MCom/MBA)
  if (
    text.includes("post") || text.includes("master") ||
    text.includes("m.sc") || text.includes("m.a") || text.includes("m.com") || text.includes("mba") ||
    text.includes("mca")
  ) {
    return { level: 5, stream: "general" };
  }

  // Graduate (general — BA/BSc/BCom etc)
  if (
    text.includes("graduate") || text.includes("graduation") ||
    text.includes("bachelor") || text.includes("degree") ||
    text.includes("b.sc") || text.includes("b.a") || text.includes("b.com") ||
    text.includes("bca") || text.includes("bba")
  ) {
    return { level: 4, stream: "general" };
  }

  // Diploma
  if (text.includes("diploma")) {
    return { level: 3.5, stream: "general" };
  }

  // ITI
  if (text.includes("iti")) {
    return { level: 3, stream: "general" };
  }

  // 12th / Higher Secondary
  if (
    text.includes("12th") || text.includes("class xii") ||
    text.includes("intermediate") || text.includes("higher secondary") || text.includes("+2")
  ) {
    return { level: 3, stream: "general" };
  }

  // 10th / Matriculation
  if (
    text.includes("10th") || text.includes("class x") ||
    text.includes("matriculation") || text.includes("ssc pass") || text.includes("10 pass")
  ) {
    return { level: 2, stream: "general" };
  }

  // 8th
  if (text.includes("8th") || text.includes("class viii") || text.includes("middle")) {
    return { level: 1, stream: "general" };
  }

  // Fallback: any qualification
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
  eligible: boolean;
  ageOk: boolean | null;
  qualOk: boolean | null;
  skillsMissing: string[];   // Skills the job requires but user lacks
  reasons: string[];
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
function getAgeRelaxation(category: string | null): number {
  switch (category?.toUpperCase()) {
    case "OBC": return 3;
    case "SC": case "ST": return 5;
    default: return 0;
  }
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
  /\b(degree|bachelor'?s?\s*degree|master'?s?\s*degree)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // "B.Sc in Agriculture", "M.Sc in Fisheries", "B.E. in Civil Engineering"
  /\b(b\.?\s*(?:sc|tech|e|a|com|pharm|ed)|m\.?\s*(?:sc|tech|e|a|com|pharm|ed)|b\.?\s*(?:arch|lib))\s*\.?\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  // "Certificate in X", "Post Graduate Certificate in X"
  /\b(certificate|certification)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
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
      const specialization = match[2].trim().replace(/\s+/g, " ");

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
  let ageOk: boolean | null = null;
  let qualOk: boolean | null = null;

  // ── STRICT Age Check (with category relaxation) ───────────────
  if (userAge !== null) {
    const hasAgeReq = (job.age_min && job.age_min >= 10) || (job.age_max && job.age_max >= 10);
    if (hasAgeReq) {
      const relaxation = getAgeRelaxation(category);
      const min = (job.age_min && job.age_min >= 10) ? job.age_min : 0;
      const max = (job.age_max && job.age_max >= 10) ? job.age_max + relaxation : 100;
      ageOk = userAge >= min && userAge <= max;
      if (!ageOk) {
        if (userAge < min) reasons.push(`Min age ${min}, you are ${userAge}`);
        else reasons.push(`Max age ${max - relaxation}${relaxation > 0 ? ` (+${relaxation} relaxation)` : ""}, you are ${userAge}`);
      }
    }
  }

  // ── STRICT Qualification Check ────────────────────────────────
  if (userQual !== null && job.qualification) {
    const jobQual = parseJobQualRequirement(job.qualification);
    qualOk = isQualificationEligible(userQual, jobQual);
    if (!qualOk) {
      const label = getJobQualLabel(job.qualification);
      if (userQual.level < jobQual.level) {
        reasons.push(`Requires ${label}`);
      } else {
        reasons.push(`Requires ${label} (specific stream)`);
      }
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

  // ── STRICT Skill Requirement Check ────────────────────────────
  const jobText = `${job.qualification || ""} ${job.eligibility || ""} ${job.title || ""}`.toLowerCase();
  const skillsMissing: string[] = [];
  const normalizedUserSkills = userSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean);
  for (const [skillKey, pattern] of Object.entries(SKILL_KEYWORDS)) {
    if (pattern.test(jobText) && !normalizedUserSkills.includes(skillKey)) {
      skillsMissing.push(getSkillLabel(skillKey));
    }
  }

  // ── Specialized Qualification Detection ────────────────────────
  // Detects "Diploma in X", "Degree in X", etc. and checks against user's qualification_name
  const specializedMissing = detectSpecializedRequirements(jobText, userQualificationName);
  for (const label of specializedMissing) {
    if (!skillsMissing.includes(label)) {
      skillsMissing.push(label);
    }
  }

  // ── Domain Requirements (pipe-delimited eligibility text) ──────
  // Parses "Constitutional Law | Criminal Law | Demonstrated experience in X, Y" etc.
  const domainMissing = extractDomainRequirements(job.eligibility, userQualificationName);
  for (const label of domainMissing) {
    if (!skillsMissing.includes(label)) {
      skillsMissing.push(label);
    }
  }

  // All hard checks must pass. Skills missing is a separate tier.
  const eligible = (ageOk === null || ageOk) && (qualOk === null || qualOk) && (genderOk === null || genderOk);

  return { eligible, ageOk, qualOk, skillsMissing, reasons };
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
  typing_english: /\b(english\s*typ|typing.*english|english.*typing|typing\s*speed|35\s*wpm|40\s*wpm)\b/i,
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
