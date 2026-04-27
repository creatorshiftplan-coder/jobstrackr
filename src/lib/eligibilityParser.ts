import {
  EligibilityAlternative,
  EligibilityDocumentConstraint,
  EligibilityExperienceRule,
  EligibilityGlobalRules,
  EligibilityLanguageRule,
  EligibilityNegativeConstraint,
  EligibilityPhysicalRule,
  EligibilityProfessionRule,
  EligibilityProfile,
  EligibilityQualificationLevel,
  EligibilityQualificationStatusRule,
  EligibilityQualificationStream,
  EligibilityRegistrationRule,
  EligibilityResidencyRule,
  EligibilitySkillRule,
  EligibilitySourceSegment,
  Job,
} from "@/types/job";

const PROFILE_VERSION = 1;

const qualificationLevelPatterns: Array<{ level: EligibilityQualificationLevel; pattern: RegExp }> = [
  { level: "phd", pattern: /\b(ph\.?d\.?|doctorate)\b/i },
  { level: "post_graduation", pattern: /\b(post[\s-]?graduat(?:e|ion)|master'?s?|m\.?sc\.?|m\.?a\.?|m\.?com\.?|mba|mca|m\.?tech\.?|md|ms|dnb)\b/i },
  { level: "graduation", pattern: /\b(graduat(?:e|ion)|bachelor'?s?|degree|b\.?sc\.?|b\.?a\.?|b\.?com\.?|bca|bba|b\.?tech\.?|b\.?e\.?|llb|mbbs|bds|b\.?pharm\.?|b\.?ed\.?)\b/i },
  { level: "diploma", pattern: /\b(diploma|polytechnic|d\.?pharm\.?|gnm|anm|jbt|d\.el\.ed\.?|d\.ed\.?|mlt|dmlt)\b/i },
  { level: "iti", pattern: /\b(iti|ncvt|scvt|craft apprentice|trade apprentice)\b/i },
  { level: "12th", pattern: /\b(12th|10\+2|intermediate|higher secondary|senior secondary|\+2)\b/i },
  { level: "10th", pattern: /\b(10th|matric(?:ulation)?|ssc|hslc|class x)\b/i },
  { level: "8th", pattern: /\b(8th|class viii|middle school|7th standard|7th class)\b/i },
];

const streamPatterns: Array<{ stream: EligibilityQualificationStream; pattern: RegExp }> = [
  { stream: "engineering", pattern: /\b(engineering|b\.?tech\.?|m\.?tech\.?|b\.?e\.?|m\.?e\.?|civil engineering|mechanical engineering|electronics|computer science|dialysis technology|critical care technology)\b/i },
  { stream: "medical", pattern: /\b(mbbs|medicine|medical|bds|radiography|radiology|imaging|dental|operation theatre|ot technician|emergency medicine|orthopaedics|paediatrics|anesthesiology|echocardiography)\b/i },
  { stream: "nursing", pattern: /\b(nursing|gnm|anm|nurse|midwife)\b/i },
  { stream: "pharmacy", pattern: /\b(pharmacy|pharmacist|b\.?pharm\.?|d\.?pharm\.?)\b/i },
  { stream: "law", pattern: /\b(law|llb|advocate|bar council|legal practitioner)\b/i },
  { stream: "teaching", pattern: /\b(b\.?ed\.?|d\.el\.ed\.?|d\.?ed\.?|jbt|tet|ctet|jtet|teacher eligibility|elementary education|special education)\b/i },
];

const skillPatterns: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "computer", label: "Computer proficiency required", pattern: /\b(computer knowledge|computer application|computer literacy|basic computer|ms office|tally)\b/i },
  { key: "typing_hindi", label: "Hindi typing required", pattern: /\b(hindi typing|typing speed.*hindi|hindi.*typing|5000\s*k(?:ey)?d(?:epressions)?\s*per\s*hour.*hindi)\b/i },
  { key: "typing_english", label: "English typing required", pattern: /\b(english typing|typing speed.*english|english.*typing|30\s*w\.p\.m\.?|30\s*wpm)\b/i },
  { key: "shorthand", label: "Shorthand required", pattern: /\b(shorthand|dictation|80\s*words\s*per\s*minute|100\s*w\.p\.m\.?)\b/i },
  { key: "driving", label: "Driving skill required", pattern: /\b(valid driving license|lmv|hmv|driving cars|heavy vehicles|motor mechanism)\b/i },
  { key: "swimming", label: "Swimming required", pattern: /\b(swimming|required to swim|must swim)\b/i },
];

const languagePatterns: Array<{ key: string; label: string; pattern: RegExp; modes: string[] }> = [
  { key: "odia", label: "Odia required", pattern: /\b(odia|odiya)\b/i, modes: ["read", "write", "speak"] },
  { key: "bengali", label: "Bengali required", pattern: /\b(bengali)\b/i, modes: ["read", "write", "speak"] },
  { key: "punjabi", label: "Punjabi required", pattern: /\b(punjabi)\b/i, modes: ["subject_passed", "read", "write", "speak"] },
  { key: "assamese", label: "Assamese required", pattern: /\b(assamese)\b/i, modes: ["read", "write", "speak"] },
  { key: "gujarati", label: "Gujarati required", pattern: /\b(gujarati)\b/i, modes: ["read", "write", "speak"] },
  { key: "hindi", label: "Hindi required", pattern: /\b(hindi)\b/i, modes: ["read", "write", "speak"] },
  { key: "english", label: "English required", pattern: /\b(english)\b/i, modes: ["read", "write", "speak"] },
  { key: "local_language", label: "Local language required", pattern: /\b(local language|regional language|mother tongue)\b/i, modes: ["read", "write", "speak"] },
];

const registrationPatterns: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "bar_council", label: "Bar Council enrollment required", pattern: /\b(bar council|enrol(?:l)?ment as an advocate|advocate in the roll)\b/i },
  { key: "nursing_council", label: "Nursing Council registration required", pattern: /\b(nursing registration council|registered as nurse|registered as nurse and midwife|nurse and midwife)\b/i },
  { key: "pharmacy_council", label: "Pharmacy registration required", pattern: /\b(registered as pharmacist|pharmacy act|state pharmacy council)\b/i },
  { key: "rci", label: "RCI registration required", pattern: /\b(rci|crr number)\b/i },
  { key: "medical_council", label: "Medical council registration required", pattern: /\b(indian medical council|state medical council|nmc)\b/i },
  { key: "uidai", label: "UIDAI Aadhaar certification required", pattern: /\b(aadhaar operator|aadhaar supervisor|uidai)\b/i },
  { key: "gate_score", label: "Valid GATE score required", pattern: /\b(gate qualification|gate score|gpat)\b/i },
  { key: "net_slet", label: "NET or SLET required", pattern: /\b(net|slet|jrf)\b/i },
  { key: "driving_license", label: "Valid driving license required", pattern: /\b(valid driving license|permanent license)\b/i },
  { key: "cet", label: "CET qualification required", pattern: /\b(cet qualification|cet group c exam qualified|pet 2025 score)\b/i },
];

const residencyPatterns: Array<{ type: string; label: string; pattern: RegExp }> = [
  { type: "same_district", label: "Same district residency required", pattern: /\b(same district|resident of the same district)\b/i },
  { type: "same_village_or_ward", label: "Same village or ward residency required", pattern: /\b(village assembly|same gram panchayat|same village|same ward|anganwadi centre is located)\b/i },
  { type: "state_domicile", label: "State domicile required", pattern: /\b(domicile|permanent resident of assam|resident of the state|belong to the eligible states\/districts)\b/i },
  { type: "employment_exchange", label: "Employment exchange registration required", pattern: /\b(employment exchange)\b/i },
];

const negativeConstraintPatterns: Array<{ type: string; label: string; pattern: RegExp; value?: string | boolean }> = [
  { type: "female_only", label: "Female candidates only", pattern: /\b(only female candidates|female candidates are eligible|women only)\b/i, value: "female" },
  { type: "male_only", label: "Male candidates only", pattern: /\b(male only|men only)\b/i, value: "male" },
  { type: "distance_mode_not_accepted", label: "Distance mode qualification not accepted", pattern: /\b(distance learning mode will not be accepted|distance mode not accepted)\b/i },
  { type: "higher_qualification_not_allowed", label: "Higher qualification not allowed", pattern: /\b(graduates and candidates possessing higher qualifications are not eligible|engineering graduates and diploma holders are not eligible|higher qualifications are not eligible)\b/i },
];

const physicalPatterns: Array<{ type: string; label: string; pattern: RegExp }> = [
  { type: "physical_test", label: "Physical standards or test required", pattern: /\b(physical standards|physical test|height|chest)\b/i },
  { type: "medical_fitness", label: "Medical fitness required", pattern: /\b(medical fitness|medically fit)\b/i },
];

const qualificationStatusPatterns: Array<{ type: string; label: string; pattern: RegExp }> = [
  { type: "final_year_allowed", label: "Final-year candidates allowed", pattern: /\b(final year|awaiting results|may apply provisionally)\b/i },
  { type: "recognized_institution_required", label: "Recognized institution required", pattern: /\b(recognized (?:university|institution|board|council)|approved by)\b/i },
  { type: "distance_mode_not_accepted", label: "Distance mode not accepted", pattern: /\b(distance learning mode will not be accepted|distance mode not accepted)\b/i },
];

const professionPatterns: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "advocate_enrolled", label: "Enrolled advocate required", pattern: /\b(enrol(?:l)?ment as an advocate|advocate in the roll of bar council)\b/i },
  { key: "ex_banker", label: "Ex-banker or banking experience required", pattern: /\b(ex-banker|banking experience|officer cadre|rrb|nbfcs|bc-coordinator)\b/i },
  { key: "sportsperson", label: "Sports qualification route", pattern: /\b(meritorious sportsperson|sports qualification)\b/i },
];

const subjectPatterns: Array<{ subject: string; pattern: RegExp }> = [
  { subject: "physics", pattern: /\bphysics\b/i },
  { subject: "chemistry", pattern: /\bchemistry\b/i },
  { subject: "mathematics", pattern: /\b(math|mathematics)\b/i },
  { subject: "biology", pattern: /\b(biology|botany|zoology)\b/i },
  { subject: "commerce", pattern: /\bcommerce|b\.com\b/i },
  { subject: "law", pattern: /\blaw\b/i },
  { subject: "hindi", pattern: /\bhindi\b/i },
  { subject: "english", pattern: /\benglish\b/i },
  { subject: "library_science", pattern: /\blibrary science|library & information\b/i },
];

const specializationPatterns: Array<{ pattern: RegExp; fallback: string }> = [
  { pattern: /\b(?:degree|diploma|certificate|graduate degree|b\.?tech\.?|b\.?e\.?|b\.?sc\.?|m\.?sc\.?|mba|llb|mbbs|md|ms|dnb)\s*(?:in|of)?\s+([a-z][a-z0-9&()/,\s-]+?)(?:\s+(?:with|from|plus|and|or|having|required|recognized|minimum|valid)\b|[.;,]|$)/gi, fallback: "" },
  { pattern: /\b(?:critical care technology|dialysis technology|general nursing(?:\s*&\s*midwifery)?|computer application|data entry operator|translation|library science|elementary education|special education|medical imaging technology|radiography|operation theatre technology|dental technician|fisheries science|nautical science|civil engineering|mechanical engineering|biotechnology|molecular biology|life science|microbiology|virology|echocardiography)\b/gi, fallback: "" },
];

const noisePatterns = [
  /\b(application mode|apply online|apply now|online only|offline forms|visit the official|website|portal|upload|preview page|payment gateway|download\/print|fee|stipend|document verification|dv|training & stipend|no job guarantee|communication|application dates|selection will be done purely on merit|tie-breaking|there will be no written test|viva-voce)\b/i,
  /https?:\/\//i,
];

const manualReviewPatterns = [
  /\b(refer to (?:advertisement|notification)|specific qualifications vary by post|depending on the post|detailed in the official notification|eligibility criteria vary by post)\b/i,
];

const postWisePattern = /(?:^|\s)(?:\d+\.|\(?[ivx]+\)|for\s+)([A-Z][A-Za-z&/()\-., ]{2,80}):/gi;

const profileCache = new Map<string, EligibilityProfile>();

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEligibilityText(parts: Array<string | null | undefined>): string {
  return normalizeWhitespace(parts.filter(Boolean).join(" | "));
}

function normalizeTagValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function splitSegments(text: string): string[] {
  const marked = text
    .replace(/\r?\n+/g, " | ")
    .replace(/[•●▪]/g, " | ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+(?=(?:\(?\d+\)|\d+\.|\(?[ivxlcdm]+\))\s)/gi, " | ");

  return marked
    .split(/\s*\|\s*/)
    .map((segment) => normalizeWhitespace(segment.replace(/^(?:\(?\d+\)|\d+\.|\(?[ivxlcdm]+\))\s*/i, "")))
    .filter(Boolean);
}

function classifySegment(text: string): EligibilitySourceSegment["type"] {
  if (noisePatterns.some((pattern) => pattern.test(text))) return "noise";
  if (/\b(age limit|minimum age|maximum age|upper age|min age|years as on|age relaxation)\b/i.test(text)) return "age";
  if (/\b(citizen of india|nationality|subject of nepal|subject of bhutan|tibetan refugee|person of indian origin)\b/i.test(text)) return "nationality";
  if (languagePatterns.some((entry) => entry.pattern.test(text))) return "language";
  if (registrationPatterns.some((entry) => entry.pattern.test(text))) return "registration";
  if (residencyPatterns.some((entry) => entry.pattern.test(text))) return "residency";
  if (physicalPatterns.some((entry) => entry.pattern.test(text))) return "physical";
  if (negativeConstraintPatterns.some((entry) => entry.pattern.test(text))) return "negative";
  if (/\b(experience|post qualification experience|years experience)\b/i.test(text)) return "experience";
  if (/\b(degree|diploma|certificate|graduate|graduation|10th|12th|iti|mbbs|llb|b\.ed|b\.tech|m\.sc|m\.a|phd|doctorate|senior secondary|higher secondary)\b/i.test(text)) return "qualification";
  return "other";
}

function extractPostLabel(text: string): string | null {
  const match = text.match(/^([A-Z][A-Za-z&/()\-., ]{2,80}):/);
  return match ? normalizeWhitespace(match[1]) : null;
}

function createLanguageRule(key: string, label: string, modes: string[], text: string): EligibilityLanguageRule {
  return {
    key,
    label,
    modes,
    level_text: null,
    mandatory: true,
    source_text: text,
    confidence: 0.9,
  };
}

function createRegistrationRule(key: string, label: string, text: string): EligibilityRegistrationRule {
  return {
    key,
    label,
    authority: null,
    source_text: text,
    confidence: 0.9,
  };
}

function createSkillRule(key: string, label: string, text: string): EligibilitySkillRule {
  return {
    key,
    label,
    source_text: text,
    confidence: 0.85,
  };
}

function createResidencyRule(type: string, label: string, text: string): EligibilityResidencyRule {
  return {
    type,
    label,
    source_text: text,
    confidence: 0.9,
  };
}

function createPhysicalRule(type: string, label: string, text: string): EligibilityPhysicalRule {
  return {
    type,
    label,
    source_text: text,
    confidence: 0.85,
  };
}

function createNegativeConstraint(type: string, label: string, text: string, value?: string | boolean): EligibilityNegativeConstraint {
  return {
    type,
    label,
    value: value ?? null,
    source_text: text,
    confidence: 0.95,
  };
}

function createDocumentConstraint(type: string, label: string, text: string): EligibilityDocumentConstraint {
  return {
    type,
    label,
    source_text: text,
    confidence: 0.85,
  };
}

function createQualificationStatus(type: string, label: string, text: string): EligibilityQualificationStatusRule {
  return {
    type,
    label,
    source_text: text,
    confidence: 0.85,
  };
}

function createProfessionRule(key: string, label: string, text: string): EligibilityProfessionRule {
  return {
    key,
    label,
    source_text: text,
    confidence: 0.85,
  };
}

function extractAgeRule(text: string): EligibilityGlobalRules["age_rule"] {
  const minMaxMatch = text.match(/(?:age\s*limit[:\s]*)?(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*years?/i);
  const minOnlyMatch = text.match(/minimum age[:\s]*(\d{1,2})/i);
  const maxOnlyMatch = text.match(/(?:maximum|upper) age(?:\s*limit)?[:\s]*(\d{1,2})/i);

  const relaxations = Array.from(text.matchAll(/\b(SC\/?ST|SC|ST|OBC(?:-NCL)?|EWS|PwBD|PwD|Ex[\s-]?Servicemen?)\b[^\d]*(\d{1,2})\s*years?/gi)).map((match) => ({
    category: normalizeWhitespace(match[1]),
    years: Number(match[2]),
    source_text: text,
    confidence: 0.9,
  }));

  if (!minMaxMatch && !minOnlyMatch && !maxOnlyMatch && relaxations.length === 0) return null;

  return {
    min: minMaxMatch ? Number(minMaxMatch[1]) : minOnlyMatch ? Number(minOnlyMatch[1]) : null,
    max: minMaxMatch ? Number(minMaxMatch[2]) : maxOnlyMatch ? Number(maxOnlyMatch[1]) : null,
    reference_date_text: text.match(/as on[^|.;]+/i)?.[0] ?? null,
    relaxations,
    source_text: text,
    confidence: 0.9,
  };
}

function extractExperienceRule(text: string): EligibilityExperienceRule | null {
  const years = Array.from(text.matchAll(/(\d+)\s+years?/gi)).map((match) => Number(match[1]));
  if (years.length === 0) return null;

  const domains = Array.from(text.matchAll(/experience\s+(?:in|as|with|of)\s+([a-z][a-z0-9&/,\s-]+?)(?:\.|,|;|$)/gi))
    .map((match) => normalizeWhitespace(match[1]))
    .filter((value) => value.length > 2);

  return {
    minimum_years: Math.min(...years),
    domains: uniqueByKey(domains, (value) => value.toLowerCase()),
    post_qualification: /post qualification|after obtaining|after acquiring/i.test(text),
    source_text: text,
    confidence: 0.85,
  };
}

function extractMinimumMarks(text: string) {
  const overallMatch = text.match(/(\d{2})%\s*marks?/i);
  if (!overallMatch) return null;

  const overrides: Record<string, number> = {};
  for (const match of text.matchAll(/(\d{2})%\s*for\s*([A-Z/]+)/gi)) {
    overrides[normalizeTagValue(match[2])] = Number(match[1]);
  }

  return {
    overall: Number(overallMatch[1]),
    category_overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    source_text: text,
    confidence: 0.85,
  };
}

function extractQualificationLevels(text: string): EligibilityQualificationLevel[] {
  return uniqueByKey(
    qualificationLevelPatterns.filter((entry) => entry.pattern.test(text)).map((entry) => entry.level),
    (value) => value,
  );
}

function extractQualificationStreams(text: string): EligibilityQualificationStream[] {
  const streams = streamPatterns.filter((entry) => entry.pattern.test(text)).map((entry) => entry.stream);
  if (streams.length === 0 && /\b(degree|diploma|certificate|graduate|graduation|10th|12th|iti)\b/i.test(text)) {
    streams.push("general");
  }
  return uniqueByKey(streams, (value) => value);
}

function extractQualificationModes(text: string): string[] {
  const modes: string[] = [];
  if (/\bdegree|graduate|graduation|bachelor|master|mbbs|llb|b\.tech|b\.e|m\.sc|m\.a|mba\b/i.test(text)) modes.push("degree");
  if (/\bdiploma|polytechnic|gnm|anm|d\.el\.ed|d\.ed|jbt\b/i.test(text)) modes.push("diploma");
  if (/\bcertificate\b/i.test(text)) modes.push("certificate");
  if (/\biti|ncvt|scvt\b/i.test(text)) modes.push("iti");
  return uniqueByKey(modes, (value) => value);
}

function extractRequiredSubjects(text: string): string[] {
  return uniqueByKey(
    subjectPatterns.filter((entry) => entry.pattern.test(text)).map((entry) => entry.subject),
    (value) => value,
  );
}

function normalizeSpecialization(raw: string): string {
  return normalizeWhitespace(raw)
    .replace(/^in\s+/i, "")
    .replace(/^(?:the\s+)?(?:concerned|relevant|same)\s+/i, "")
    .replace(/\bfield\b$/i, "")
    .replace(/\s+/g, " ");
}

function extractSpecializations(text: string): string[] {
  const values: string[] = [];
  for (const entry of specializationPatterns) {
    entry.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = entry.pattern.exec(text)) !== null) {
      const raw = match[1] ?? match[0];
      const normalized = normalizeSpecialization(raw);
      if (!normalized || normalized.length < 3) continue;
      if (/^(recognized|equivalent|related|relevant|concerned specialty|subject|discipline)$/i.test(normalized)) continue;
      values.push(normalized);
    }
  }
  return uniqueByKey(values, (value) => value.toLowerCase());
}

function extractLanguages(text: string): EligibilityLanguageRule[] {
  const rules = languagePatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createLanguageRule(entry.key, entry.label, entry.modes, text));

  if (/\bpassed .* as a subject/i.test(text)) {
    return rules.map((rule) => ({
      ...rule,
      modes: uniqueByKey([...rule.modes, "subject_passed"], (value) => value),
    }));
  }

  return rules;
}

function extractRegistrations(text: string): EligibilityRegistrationRule[] {
  return registrationPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createRegistrationRule(entry.key, entry.label, text));
}

function extractSkills(text: string): EligibilitySkillRule[] {
  return skillPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createSkillRule(entry.key, entry.label, text));
}

function extractResidencyRules(text: string): EligibilityResidencyRule[] {
  return residencyPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createResidencyRule(entry.type, entry.label, text));
}

function extractPhysicalRules(text: string): EligibilityPhysicalRule[] {
  return physicalPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createPhysicalRule(entry.type, entry.label, text));
}

function extractNegativeConstraints(text: string): EligibilityNegativeConstraint[] {
  return negativeConstraintPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createNegativeConstraint(entry.type, entry.label, text, entry.value));
}

function extractDocumentConstraints(text: string): EligibilityDocumentConstraint[] {
  const constraints: EligibilityDocumentConstraint[] = [];
  if (/\brecognized (?:university|institution|board|council)\b/i.test(text)) {
    constraints.push(createDocumentConstraint("recognized_institution_required", "Recognized institution required", text));
  }
  if (/\bcentral government format|annexure\b/i.test(text)) {
    constraints.push(createDocumentConstraint("prescribed_format_required", "Prescribed certificate format required", text));
  }
  if (/\bmark sheet|proof of passing|must produce proof\b/i.test(text)) {
    constraints.push(createDocumentConstraint("proof_of_passing_required", "Proof of passing required", text));
  }
  return constraints;
}

function extractQualificationStatuses(text: string): EligibilityQualificationStatusRule[] {
  return qualificationStatusPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createQualificationStatus(entry.type, entry.label, text));
}

function extractProfessionRules(text: string): EligibilityProfessionRule[] {
  return professionPatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => createProfessionRule(entry.key, entry.label, text));
}

function detectQualityFlags(text: string, segments: EligibilitySourceSegment[]): string[] {
  const flags = new Set<string>();

  if (manualReviewPatterns.some((pattern) => pattern.test(text))) {
    flags.add("manual_review");
    flags.add("review_needed");
  }

  const postMatches = Array.from(text.matchAll(postWisePattern));
  if (postMatches.length > 1) {
    flags.add("post_wise_eligibility");
    flags.add("review_needed");
  }

  if (/\bOR\b/i.test(text)) {
    flags.add("multiple_paths");
  }

  const noiseSegments = segments.filter((segment) => segment.type === "noise").length;
  if (noiseSegments >= 3) {
    flags.add("mixed_noise_heavy");
  }

  if (!flags.has("review_needed") && !flags.has("manual_review")) {
    flags.add("parsed_confidently");
  }

  return Array.from(flags);
}

function splitAlternatives(baseText: string, qualityFlags: string[]): string[] {
  if (qualityFlags.includes("post_wise_eligibility")) {
    return [baseText];
  }

  const alternatives = baseText
    .split(/\s+OR\s+/i)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (alternatives.length > 1) return alternatives;

  if (/^[A-Za-z0-9+().\-\s]+(?:\/[A-Za-z0-9+().\-\s]+){1,5}$/.test(baseText) && /\b(10\+2|12th|graduate|d\.pharm|b\.pharm|iti|diploma|degree)\b/i.test(baseText)) {
    return baseText.split("/").map((part) => normalizeWhitespace(part)).filter(Boolean);
  }

  return [baseText];
}

function buildAlternative(text: string, index: number): EligibilityAlternative {
  const levels = extractQualificationLevels(text);
  const streams = extractQualificationStreams(text);
  const specializations = extractSpecializations(text);
  const labels = [
    levels.length > 0 ? toTitleCase(levels[levels.length - 1]) : null,
    specializations[0] ?? null,
  ].filter(Boolean);

  return {
    id: `alt_${index + 1}`,
    label: labels.join(" - ") || `Eligibility Path ${index + 1}`,
    qualification_levels: levels,
    qualification_streams: streams,
    specializations,
    qualification_modes: extractQualificationModes(text),
    required_subjects: extractRequiredSubjects(text),
    minimum_marks: extractMinimumMarks(text),
    required_registrations: extractRegistrations(text),
    required_languages: extractLanguages(text),
    required_skills: extractSkills(text),
    experience_rule: extractExperienceRule(text),
    qualification_status_rules: extractQualificationStatuses(text),
    profession_rules: extractProfessionRules(text),
    source_text: text,
    confidence: text.length > 0 ? 0.8 : 0.4,
  };
}

function deriveTags(globalRules: EligibilityGlobalRules, alternatives: EligibilityAlternative[], qualityFlags: string[]): string[] {
  const tags = new Set<string>();

  for (const alternative of alternatives) {
    for (const level of alternative.qualification_levels) tags.add(`qual_level:${level}`);
    for (const stream of alternative.qualification_streams) tags.add(`qual_stream:${stream}`);
    for (const specialization of alternative.specializations) tags.add(`qual_specialization:${normalizeTagValue(specialization)}`);
    for (const mode of alternative.qualification_modes) tags.add(`qual_mode:${normalizeTagValue(mode)}`);
    for (const status of alternative.qualification_status_rules) tags.add(`qualification_status:${normalizeTagValue(status.type)}`);
    for (const profession of alternative.profession_rules) tags.add(`profession:${normalizeTagValue(profession.key)}`);
    for (const registration of alternative.required_registrations) tags.add(`registration:${normalizeTagValue(registration.key)}`);
    for (const language of alternative.required_languages) tags.add(`language:${normalizeTagValue(language.key)}`);
    for (const skill of alternative.required_skills) tags.add(`skill:${normalizeTagValue(skill.key)}`);
    if (alternative.experience_rule?.minimum_years) tags.add(`experience:min_${alternative.experience_rule.minimum_years}_years`);
  }

  for (const registration of globalRules.required_registrations) tags.add(`registration:${normalizeTagValue(registration.key)}`);
  for (const language of globalRules.required_languages) tags.add(`language:${normalizeTagValue(language.key)}`);
  for (const residency of globalRules.residency_rules) tags.add(`restriction:residency:${normalizeTagValue(residency.type)}`);
  for (const skill of globalRules.required_skills) tags.add(`skill:${normalizeTagValue(skill.key)}`);
  for (const physical of globalRules.physical_rules) tags.add(`restriction:physical:${normalizeTagValue(physical.type)}`);
  for (const negative of globalRules.negative_constraints) tags.add(`restriction:${normalizeTagValue(negative.type)}`);
  for (const document of globalRules.document_constraints) tags.add(`document:${normalizeTagValue(document.type)}`);
  if (globalRules.experience_rule?.minimum_years) tags.add(`experience:min_${globalRules.experience_rule.minimum_years}_years`);
  for (const flag of qualityFlags) tags.add(`quality:${normalizeTagValue(flag)}`);

  return Array.from(tags).sort();
}

function buildGlobalRules(segments: EligibilitySourceSegment[], rawText: string): EligibilityGlobalRules {
  const qualificationSegments = segments.filter((segment) => segment.type === "qualification" || segment.type === "experience" || segment.type === "registration" || segment.type === "language" || segment.type === "physical");

  const nationality: string[] = [];
  if (/\bcitizen of india\b/i.test(rawText)) nationality.push("india");
  if (/\bsubject of nepal\b/i.test(rawText)) nationality.push("nepal");
  if (/\bsubject of bhutan\b/i.test(rawText)) nationality.push("bhutan");

  const ageSegment = segments.find((segment) => segment.type === "age");
  const languageRules = uniqueByKey(segments.flatMap((segment) => extractLanguages(segment.text)), (rule) => `${rule.key}:${rule.source_text}`);
  const residencyRules = uniqueByKey(segments.flatMap((segment) => extractResidencyRules(segment.text)), (rule) => `${rule.type}:${rule.source_text}`);
  const registrationRules = uniqueByKey(segments.flatMap((segment) => extractRegistrations(segment.text)), (rule) => `${rule.key}:${rule.source_text}`);
  const skillRules = uniqueByKey(qualificationSegments.flatMap((segment) => extractSkills(segment.text)), (rule) => `${rule.key}:${rule.source_text}`);
  const physicalRules = uniqueByKey(segments.flatMap((segment) => extractPhysicalRules(segment.text)), (rule) => `${rule.type}:${rule.source_text}`);
  const negativeConstraints = uniqueByKey(segments.flatMap((segment) => extractNegativeConstraints(segment.text)), (rule) => `${rule.type}:${rule.source_text}`);
  const documentConstraints = uniqueByKey(segments.flatMap((segment) => extractDocumentConstraints(segment.text)), (rule) => `${rule.type}:${rule.source_text}`);

  const globalExperienceSegments = segments.filter(
    (segment) => segment.type === "experience" && !/\bOR\b/i.test(segment.text),
  );
  const experienceRule = globalExperienceSegments.length === 1 ? extractExperienceRule(globalExperienceSegments[0].text) : null;

  return {
    nationality,
    age_rule: ageSegment ? extractAgeRule(ageSegment.text) : null,
    required_languages: languageRules,
    residency_rules: residencyRules,
    required_registrations: registrationRules,
    required_skills: skillRules,
    physical_rules: physicalRules,
    negative_constraints: negativeConstraints,
    document_constraints: documentConstraints,
    experience_rule: experienceRule,
  };
}

export function parseEligibilityProfileFromText(
  qualification: string | null | undefined,
  eligibility: string | null | undefined,
  title?: string | null,
): EligibilityProfile {
  const rawText = normalizeEligibilityText([qualification, eligibility]);
  const segmentsText = splitSegments(rawText);
  const sourceSegments: EligibilitySourceSegment[] = segmentsText.map((text) => ({
    type: classifySegment(text),
    text,
    applies_to_post: extractPostLabel(text),
  }));

  const qualityFlags = detectQualityFlags(rawText, sourceSegments);
  const globalRules = buildGlobalRules(sourceSegments, rawText);

  const alternativeSource = normalizeWhitespace(
    sourceSegments
      .filter((segment) => segment.type !== "noise" && segment.type !== "age" && segment.type !== "nationality" && segment.type !== "residency")
      .map((segment) => segment.text)
      .join(" | "),
  ) || rawText;

  const alternatives = splitAlternatives(alternativeSource, qualityFlags).map((text, index) => buildAlternative(text, index));
  const derivedTags = deriveTags(globalRules, alternatives, qualityFlags);

  return {
    version: PROFILE_VERSION,
    raw_text: rawText || normalizeWhitespace(title || ""),
    source_segments: sourceSegments,
    global_rules: globalRules,
    alternatives,
    quality_flags: qualityFlags,
    derived_tags: derivedTags,
  };
}

export function getEligibilityProfile(job: Job): EligibilityProfile {
  const existingProfile = job.job_metadata?.eligibility_profile;
  const currentRawText = normalizeEligibilityText([job.qualification, job.eligibility]);
  if (existingProfile?.version && existingProfile.raw_text === currentRawText) {
    return existingProfile;
  }

  const cacheKey = `${job.id}:${job.qualification}:${job.eligibility ?? ""}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const profile = parseEligibilityProfileFromText(job.qualification, job.eligibility, job.title);
  profileCache.set(cacheKey, profile);
  return profile;
}