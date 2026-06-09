/**
 * ============================================================================
 * JOB MATCHER v3 — Production-Grade with Caching, Fuzzy Matching & Skill Levels
 * ============================================================================
 * 
 * IMPROVEMENTS:
 * 1. Pre-computed JobRequirements cache — parse once, store structured data
 * 2. Fuzzy qualification matching — B.Tech ≈ B.E. ≈ Bachelor of Engineering
 * 4. Structured skill taxonomy with Basic/Intermediate/Advanced levels
 * ============================================================================
 */

import { Job } from "@/types/job";
import {
  matchesSectorPreference,
  parseJobDeadline,
  extractLocationFromText,
  cleanLocationString,
  resolveStateFromLocationText,
  isAllIndiaLocationText,
} from "@/lib/jobUtils";

// ═════════════════════════════════════════════════════════════════════════
// SECTION 1: PRE-COMPUTED JOB REQUIREMENTS CACHE
// ═════════════════════════════════════════════════════════════════════════

export interface JobRequirements {
  jobId: string;
  qualificationPaths: QualPath[];
  minQualificationLevel: number;
  requiredStreams: QualStream[];
  specializedRequirements: string[];
  experience: ExperienceRequirement | null;
  ageMin: number | null;
  ageMax: number | null;
  domicile: DomicileRequirement;
  gender: GenderRequirement;
  requiredSkills: JobSkill[];
  desirableSkills: JobSkill[];
  domainRequirements: string[];
  inferredLocation: string | null;
  inferredGrade: string | null;
  inferredCategory: string | null;
  parsedAt: string;
  parserVersion: string;
}

export function computeJobRequirements(job: Job): JobRequirements {
  const jobText = `${job.title || ""} ${job.qualification || ""} ${job.eligibility || ""} ${job.description || ""}`;

  return {
    jobId: job.id,
    qualificationPaths: parseOrQualifications(job.qualification || ""),
    minQualificationLevel: computeMinQualLevel(job.qualification || ""),
    requiredStreams: extractRequiredStreams(jobText),
    specializedRequirements: detectSpecializedRequirements(jobText, null),
    experience: parseExperienceRequirement(jobText),
    ageMin: (job.age_min && job.age_min >= 10) ? job.age_min : null,
    ageMax: (job.age_max && job.age_max >= 10) ? job.age_max : null,
    domicile: detectDomicileRequirement(jobText),
    gender: detectGenderRequirement(job.title, job.description),
    requiredSkills: extractJobSkills(jobText, "required"),
    desirableSkills: extractJobSkills(jobText, "desirable"),
    domainRequirements: extractDomainRequirements(job.eligibility, null),
    inferredLocation: extractLocationFromText(`${job.title} ${job.department}`),
    inferredGrade: inferGrade(job.title, job.department),
    inferredCategory: inferCategory(job.department, job.title),
    parsedAt: new Date().toISOString(),
    parserVersion: "3.0.0",
  };
}

// ═════════════════════════════════════════════════════════════════════════
// SECTION 2: FUZZY QUALIFICATION MATCHING
// ═════════════════════════════════════════════════════════════════════════

const QUAL_EQUIVALENCE_GRAPH: Record<string, string[]> = {
  "b.tech": ["btech", "b.tech.", "b tech", "bachelor of technology", "bachelor in technology", "bachelors in technology"],
  "b.e": ["be", "b.e.", "b e", "bachelor of engineering", "bachelor in engineering", "bachelors in engineering"],
  "m.tech": ["mtech", "m.tech.", "m tech", "master of technology", "master in technology"],
  "m.e": ["me", "m.e.", "m e", "master of engineering", "master in engineering"],
  "b.sc": ["b.sc.", "bsc", "bachelor of science", "bachelors of science"],
  "m.sc": ["m.sc.", "msc", "master of science", "masters of science"],
  "b.a": ["b.a.", "ba", "bachelor of arts", "bachelors of arts"],
  "m.a": ["m.a.", "ma", "master of arts", "masters of arts"],
  "b.com": ["b.com.", "bcom", "bachelor of commerce", "bachelors of commerce"],
  "m.com": ["m.com.", "mcom", "master of commerce", "masters of commerce"],
  "bca": ["b.c.a.", "bachelor of computer applications"],
  "mca": ["m.c.a.", "master of computer applications"],
  "bba": ["b.b.a.", "bachelor of business administration"],
  "mba": ["m.b.a.", "master of business administration", "masters of business administration"],
  "mbbs": ["m.b.b.s.", "bachelor of medicine and bachelor of surgery"],
  "bds": ["b.d.s.", "bachelor of dental surgery"],
  "bams": ["b.a.m.s.", "bachelor of ayurvedic medicine and surgery"],
  "bhms": ["b.h.m.s.", "bachelor of homeopathic medicine and surgery"],
  "bums": ["b.u.m.s.", "bachelor of unani medicine and surgery"],
  "bnys": ["b.n.y.s.", "bachelor of naturopathy and yogic sciences"],
  "b.sc nursing": ["bsc nursing", "bachelor of science in nursing"],
  "gnm": ["general nursing and midwifery"],
  "anm": ["auxiliary nursing and midwifery"],
  "b.pharm": ["b.pharm.", "bpharm", "bachelor of pharmacy"],
  "d.pharm": ["d.pharm.", "dpharm", "diploma in pharmacy"],
  "b.ed": ["b.ed.", "bed", "bachelor of education"],
  "m.ed": ["m.ed.", "med", "master of education"],
  "llb": ["l.l.b.", "bachelor of laws", "bachelor of law"],
  "llm": ["l.l.m.", "master of laws", "master of law"],
  "iti": ["industrial training institute", "iti certificate"],
  "diploma": ["diploma degree", "polytechnic"],
  "12th": ["class xii", "higher secondary", "intermediate", "+2", "plus two", "senior secondary"],
  "10th": ["class x", "matriculation", "secondary", "ssc pass", "high school"],
  "8th": ["class viii", "middle school", "eighth"],
  "post graduation": ["postgraduate", "post graduate", "pg", "masters degree", "master degree"],
  "graduation": ["graduate", "bachelor degree", "bachelors degree", "undergraduate"],
};

const VARIANT_TO_CANONICAL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(QUAL_EQUIVALENCE_GRAPH)) {
    map.set(canonical, canonical);
    for (const variant of variants) {
      map.set(variant, canonical);
    }
  }
  return map;
})();

function normalizeQualification(qual: string): string {
  const normalized = qual.toLowerCase().trim().replace(/\./g, "").replace(/\s+/g, " ");
  if (VARIANT_TO_CANONICAL.has(normalized)) {
    return VARIANT_TO_CANONICAL.get(normalized)!;
  }
  const cleaned = normalized
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s+(?:degree|certificate|course|program)$/i, "")
    .replace(/^(?:degree|certificate|course|program)\s+in\s+/i, "")
    .trim();
  if (VARIANT_TO_CANONICAL.has(cleaned)) {
    return VARIANT_TO_CANONICAL.get(cleaned)!;
  }
  for (const [variant, canonical] of VARIANT_TO_CANONICAL) {
    if (normalized.includes(variant) || variant.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}

function areQualificationsEquivalent(qual1: string, qual2: string): boolean {
  return normalizeQualification(qual1) === normalizeQualification(qual2);
}

function isQualificationEligibleFuzzy(userQualName: string | null, jobPaths: QualPath[]): boolean {
  if (!userQualName || jobPaths.length === 0) return true;
  const userCanonical = normalizeQualification(userQualName);
  return jobPaths.some((path) => {
    const userLevel = getLevelFromCanonical(userCanonical);
    if (userLevel < path.level) return false;
    if (path.stream !== "general") {
      const userStream = inferStreamFromCanonical(userCanonical);
      if (userStream !== path.stream) return false;
    }
    if (path.rawText && path.rawText.length > 10) {
      const pathSubjects = extractSubjectsFromQualText(path.rawText);
      const userSubjects = extractSubjectsFromQualText(userQualName);
      if (pathSubjects.length > 0) {
        const hasMatchingSubject = pathSubjects.some((ps) =>
          userSubjects.some((us) => areSubjectsSimilar(ps, us))
        );
        if (!hasMatchingSubject) return false;
      }
    }
    return true;
  });
}

function extractSubjectsFromQualText(text: string): string[] {
  const subjects: string[] = [];
  const patterns = [
    /(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|recognized|by|with|or|and)\b|[.;,]|$)/gi,
    /(?:specialization|major|subject)\s*(?::|in|is)?\s*([a-z][a-z\s&/,]+?)(?:\s*[.;,]|$)/gi,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const subject = match[1].trim().toLowerCase();
      if (subject.length > 2 && !GENERIC_QUAL_WORDS.has(subject)) {
        subjects.push(subject);
      }
    }
  }
  return subjects;
}

function areSubjectsSimilar(sub1: string, sub2: string): boolean {
  const s1 = sub1.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const s2 = sub2.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const overlap = s1.filter((w) => s2.includes(w));
  if (overlap.length > 0) return true;
  const ABBREVIATIONS: Record<string, string[]> = {
    "cse": ["computer science", "computer science engineering", "cs"],
    "cs": ["computer science", "computer science engineering"],
    "ece": ["electronics", "electronics communication", "electronics and communication"],
    "eee": ["electrical", "electronics", "electrical electronics"],
    "mech": ["mechanical"],
    "civil": ["civil engineering"],
    "it": ["information technology", "information tech"],
  };
  for (const [abbr, expansions] of Object.entries(ABBREVIATIONS)) {
    const hasAbbr = s1.includes(abbr) || s2.includes(abbr);
    const hasExpansion = expansions.some((e) => s1.some((w) => e.includes(w)) || s2.some((w) => e.includes(w)));
    if (hasAbbr && hasExpansion) return true;
  }
  return false;
}

function getLevelFromCanonical(canonical: string): number {
  const levelMap: Record<string, number> = {
    "phd": 6, "doctorate": 6,
    "post graduation": 5, "mba": 5, "mca": 5, "m.tech": 5, "m.e": 5,
    "m.sc": 5, "m.a": 5, "m.com": 5, "m.ed": 5, "llm": 5,
    "graduation": 4, "b.tech": 4, "b.e": 4, "b.sc": 4, "b.a": 4,
    "b.com": 4, "bca": 4, "bba": 4, "b.ed": 4, "llb": 4,
    "mbbs": 4, "bds": 4, "bams": 4, "bhms": 4, "bums": 4, "bnys": 4,
    "b.sc nursing": 4, "b.pharm": 4,
    "diploma": 3.5, "d.pharm": 3.5,
    "iti": 3,
    "12th": 3, "gnm": 3, "anm": 3,
    "10th": 2,
    "8th": 1,
  };
  return levelMap[canonical] ?? 0;
}

function inferStreamFromCanonical(canonical: string): QualStream {
  const text = canonical.toLowerCase();
  if (text.includes("tech") || text.includes("engineering") || text.includes("be") || text.includes("btech")) {
    return "engineering";
  }
  if (text.includes("mbbs") || text.includes("medical") || text.includes("bds") || text.includes("bams")) {
    return "medical";
  }
  if (text.includes("b.ed") || text.includes("bed") || text.includes("m.ed") || text.includes("med")) {
    return "teaching";
  }
  if (text.includes("llb") || text.includes("llm") || text.includes("law")) {
    return "law";
  }
  if (text.includes("nursing") || text.includes("gnm") || text.includes("anm")) {
    return "nursing";
  }
  if (text.includes("pharm") || text.includes("b.pharm") || text.includes("d.pharm")) {
    return "pharmacy";
  }
  return "general";
}


// ═════════════════════════════════════════════════════════════════════════
// SECTION 4: STRUCTURED SKILL TAXONOMY WITH LEVELS
// ═════════════════════════════════════════════════════════════════════════

type SkillLevel = "basic" | "intermediate" | "advanced" | "expert";

export interface JobSkill {
  key: string;
  label: string;
  category: "core" | "professional" | "language" | "software" | "domain";
  level: SkillLevel;
  isMandatory: boolean;
}

export interface UserSkill {
  key: string;
  level: SkillLevel;
  certified: boolean;
  yearsOfExperience: number | null;
}

const SKILL_TAXONOMY: Record<string, {
  label: string;
  category: JobSkill["category"];
  patterns: RegExp[];
  levelPatterns: Record<SkillLevel, RegExp>;
}> = {
  stenography: {
    label: "Stenography",
    category: "core",
    patterns: [/\b(steno|stenograph|shorthand)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+steno|beginner\s+shorthand)\b/i,
      intermediate: /\b(steno\s*80|80\s*wpm\s+shorthand)\b/i,
      advanced: /\b(steno\s*100|100\s*wpm|120\s*wpm|expert\s+stenographer)\b/i,
      expert: /\b(steno\s*120\+|140\s*wpm|high\s+court\s+stenographer)\b/i,
    },
  },
  computer: {
    label: "Computer Proficiency",
    category: "core",
    patterns: [/\b(computer|ccc|nielit|rscit|ms[\s-]?cit|pgdca|\bdca\b|o[\s-]?level|copa|data\s*entry|ms[\s-]?office|tally|computer\s*(?:knowledge|proficien|applicat|basics|literat)|basic\s*computer|computer\s*skills?)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+computer|computer\s+literate|ccc|o[\s-]?level|computer\s+knowledge)\b/i,
      intermediate: /\b(dca|pgdca|ms[\s-]?office|tally|computer\s+proficiency|nielit)\b/i,
      advanced: /\b(advanced\s+computer|programming|software\s+development|database\s+management)\b/i,
      expert: /\b(expert\s+computer|system\s+admin|network\s+admin|cyber\s+security)\b/i,
    },
  },
  typing_english: {
    label: "English Typing",
    category: "core",
    patterns: [/\b(english\s*typ|typing.*english|english.*typing|typing\s*speed|\d+\s*wpm|words\s*per\s*minute)\b/i],
    levelPatterns: {
      basic: /\b(20\s*wpm|25\s*wpm|basic\s+typing)\b/i,
      intermediate: /\b(30\s*wpm|35\s*wpm|moderate\s+typing)\b/i,
      advanced: /\b(40\s*wpm|45\s*wpm|fast\s+typing)\b/i,
      expert: /\b(50\s*wpm|60\s*wpm|80\s*wpm|expert\s+typing)\b/i,
    },
  },
  typing_hindi: {
    label: "Hindi Typing",
    category: "core",
    patterns: [/\b(hindi\s*typ|typing.*hindi|hindi.*typing|mangal)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+hindi\s+typing)\b/i,
      intermediate: /\b(25\s*wpm\s+hindi|30\s*wpm\s+hindi)\b/i,
      advanced: /\b(35\s*wpm\s+hindi|40\s*wpm\s+hindi)\b/i,
      expert: /\b(50\s*wpm\s+hindi|expert\s+hindi\s+typing)\b/i,
    },
  },
  driving: {
    label: "Driving License",
    category: "core",
    patterns: [/\b(driv|lmv|hmv|motor\s*vehicle|driving\s*licen)\b/i],
    levelPatterns: {
      basic: /\b(lmv|light\s+motor\s+vehicle|2\s*[-\s]?wheeler)\b/i,
      intermediate: /\b(hmv|heavy\s+motor\s+vehicle|4\s*[-\s]?wheeler|commercial\s+driving)\b/i,
      advanced: /\b(heavy\s+vehicle|truck|bus\s+driving|transport\s+license)\b/i,
      expert: /\b(hazardous\s+goods|special\s+vehicle|articulated\s+vehicle)\b/i,
    },
  },
  physical_fitness: {
    label: "Physical Fitness",
    category: "core",
    patterns: [/\b(physical\s*(test|fitness|standard|efficien|endurance)|1600\s*m|800\s*m|height.*\d{2,3}\s*cm|chest.*\d{2,3}\s*cm|\d+\s*(?:km|meters?)\s*(?:run|walk)|(?:long|high)\s*jump|height.*chest|pet\b|pst\b)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+fitness|minimum\s+physical)\b/i,
      intermediate: /\b(standard\s+physical|pet\b|pst\b)\b/i,
      advanced: /\b(advanced\s+fitness|1600\s*m|5\s*km|high\s+jump)\b/i,
      expert: /\b(commando\s+fitness|special\s+forces|extreme\s+endurance)\b/i,
    },
  },
  gate_score: {
    label: "GATE Score",
    category: "professional",
    patterns: [/\b(gate\s*(scor|qualif|rank|valid)|\bGPAT\b)\b/i],
    levelPatterns: {
      basic: /\b(gate\s+qualified|gate\s+cutoff)\b/i,
      intermediate: /\b(gate\s+score\s*(?:between|of)?\s*(?:300|400|500))\b/i,
      advanced: /\b(gate\s+score\s*(?:between|of)?\s*(?:600|700)|gate\s+top\s*1000)\b/i,
      expert: /\b(gate\s+score\s*(?:between|of)?\s*(?:800|900)|gate\s+top\s*100|all\s*india\s+rank\s*\d{1,3})\b/i,
    },
  },
  net_slet: {
    label: "UGC NET / SLET",
    category: "professional",
    patterns: [/\b(ugc[\s-]?net|csir[\s-]?net|\bslet\b|\bjrf\b|net[\s-]qualified)\b/i],
    levelPatterns: {
      basic: /\b(net\s+qualified|net\s+cleared)\b/i,
      intermediate: /\b(jrf\b|junior\s+research\s+fellow)\b/i,
      advanced: /\b(assistant\s+professor\s+net|net\s+with\s+jrf)\b/i,
      expert: /\b(senior\s+research\s+fellow|principal\s+investigator)\b/i,
    },
  },
  ca_icwa: {
    label: "CA / ICWA / CS",
    category: "professional",
    patterns: [/\b(chartered\s*accountant|\bCA\s*[(/]|\bCA\b\s*\/|\bICWA\b|\bICMA[I]?\b|\bCMA\b\s*[(/]|company\s*secretary|\bICSI\b)\b/i],
    levelPatterns: {
      basic: /\b(ca\s+inter|icwa\s+inter|cma\s+inter|cs\s+executive)\b/i,
      intermediate: /\b(ca\s+final|icwa\s+final|cma\s+final|cs\s+professional)\b/i,
      advanced: /\b(ca\s+practicing|icwa\s+practicing|cs\s+practicing)\b/i,
      expert: /\b(ca\s+partner|icwa\s+partner|cs\s+partner|fellow\s+ca)\b/i,
    },
  },
  programming: {
    label: "Programming",
    category: "software",
    patterns: [/\b(programming|python|java\b|c\+\+|javascript|coding\s+skill|software\s+development)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+programming|beginner\s+(?:python|java)|scripting)\b/i,
      intermediate: /\b(intermediate\s+(?:python|java)|web\s+development|api\s+development)\b/i,
      advanced: /\b(advanced\s+(?:python|java)|system\s+design|microservices)\b/i,
      expert: /\b(architect|lead\s+developer|principal\s+engineer|open\s+source\s+contributor)\b/i,
    },
  },
  autocad: {
    label: "AutoCAD",
    category: "software",
    patterns: [/\b(auto\s*cad|autocad)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+autocad|2d\s+drafting)\b/i,
      intermediate: /\b(intermediate\s+autocad|3d\s+modeling)\b/i,
      advanced: /\b(advanced\s+autocad|revit\s+integration|bim)\b/i,
      expert: /\b(autocad\s+certified\s+professional|autocad\s+instructor)\b/i,
    },
  },
  gis: {
    label: "GIS",
    category: "software",
    patterns: [/\b(gis|geographic\s*information\s*system|geo[\s-]?informatics|remote\s*sensing)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+gis|qgis|arcgis\s+basic)\b/i,
      intermediate: /\b(arcgis|spatial\s+analysis|gps\s+surveying)\b/i,
      advanced: /\b(advanced\s+gis|remote\s+sensing|satellite\s+imagery)\b/i,
      expert: /\b(gis\s+scientist|gis\s+architect|spatial\s+data\s+scientist)\b/i,
    },
  },
  surveying: {
    label: "Surveying",
    category: "domain",
    patterns: [/\b(survey(or|ing|orship))\b/i],
    levelPatterns: {
      basic: /\b(land\s+survey|chain\s+survey)\b/i,
      intermediate: /\b(theodolite|total\s+station|gps\s+survey)\b/i,
      advanced: /\b(digital\s+survey|lidar|drone\s+survey)\b/i,
      expert: /\b(chief\s+surveyor|survey\s+director|geomatics\s+expert)\b/i,
    },
  },
  agriculture: {
    label: "Agriculture",
    category: "domain",
    patterns: [/\b(agricultur|agri\s*science|krishi|agronomy)\b/i],
    levelPatterns: {
      basic: /\b(basic\s+agriculture|farm\s+worker)\b/i,
      intermediate: /\b(agricultural\s+officer|extension\s+officer)\b/i,
      advanced: /\b(agricultural\s+scientist|research\s+officer)\b/i,
      expert: /\b(agricultural\s+director|icar\s+scientist|agricultural\s+economist)\b/i,
    },
  },
};

function extractJobSkills(jobText: string, type: "required" | "desirable"): JobSkill[] {
  const skills: JobSkill[] = [];
  const text = jobText.toLowerCase();
  const isDesirableContext = /\b(?:desirable|preferred|preferable|advantage|plus|added\s+advantage)\b/i.test(text);

  for (const [key, skillDef] of Object.entries(SKILL_TAXONOMY)) {
    const matches = skillDef.patterns.some((p) => p.test(text));
    if (!matches) continue;

    let level: SkillLevel = "basic";
    for (const [lvl, pattern] of Object.entries(skillDef.levelPatterns)) {
      if (pattern.test(text)) {
        level = lvl as SkillLevel;
        break;
      }
    }

    const isMandatory = type === "required" || !isDesirableContext;

    skills.push({
      key,
      label: skillDef.label,
      category: skillDef.category,
      level,
      isMandatory,
    });
  }

  return skills;
}

export interface SkillCheckResult {
  matched: JobSkill[];
  missing: JobSkill[];
  upgradeNeeded: { jobSkill: JobSkill; userLevel: SkillLevel }[];
  overqualified: JobSkill[];
}

export function checkSkillsWithLevels(jobSkills: JobSkill[], userSkills: UserSkill[]): SkillCheckResult {
  const result: SkillCheckResult = {
    matched: [],
    missing: [],
    upgradeNeeded: [],
    overqualified: [],
  };

  const userSkillMap = new Map(userSkills.map((s) => [s.key, s]));
  const LEVEL_ORDER: SkillLevel[] = ["basic", "intermediate", "advanced", "expert"];

  for (const jobSkill of jobSkills) {
    const userSkill = userSkillMap.get(jobSkill.key);

    if (!userSkill) {
      if (jobSkill.isMandatory) {
        result.missing.push(jobSkill);
      }
      continue;
    }

    const jobLevelIdx = LEVEL_ORDER.indexOf(jobSkill.level);
    const userLevelIdx = LEVEL_ORDER.indexOf(userSkill.level);

    if (userLevelIdx >= jobLevelIdx) {
      result.matched.push(jobSkill);
      if (userLevelIdx > jobLevelIdx) {
        result.overqualified.push(jobSkill);
      }
    } else {
      result.upgradeNeeded.push({ jobSkill, userLevel: userSkill.level });
      if (userLevelIdx + 1 >= jobLevelIdx) {
        result.matched.push(jobSkill);
      } else {
        result.missing.push(jobSkill);
      }
    }
  }

  return result;
}


// ═════════════════════════════════════════════════════════════════════════
// CORE TYPES & PARSING (Preserved from v2)
// ═════════════════════════════════════════════════════════════════════════

export const QUAL_LEVELS = {
  "8th": 1, "10th": 2, "12th": 3, iti: 3, diploma: 3.5,
  graduation: 4, post_graduation: 5, phd: 6,
} as const;

export type QualStream = "general" | "engineering" | "medical" | "teaching" | "law" | "nursing" | "pharmacy";

interface QualProfile { level: number; stream: QualStream; }
interface QualPath { level: number; stream: QualStream; rawText: string; }
interface ExperienceRequirement { minYears: number; maxYears: number | null; isMandatory: boolean; rawText: string; }
interface DomicileRequirement { required: boolean; states: string[]; isMandatory: boolean; rawText: string; }
interface GenderRequirement { required: "male" | "female" | "both" | null; isMandatory: boolean; reason: string; }

export function getUserQualProfile(qualType: string): QualProfile {
  const t = qualType.toLowerCase();
  const level = QUAL_LEVELS[t as keyof typeof QUAL_LEVELS] ?? 0;
  return { level, stream: "general" };
}

export function getUserQualProfileWithStream(qualType: string, stream: QualStream): QualProfile {
  const level = QUAL_LEVELS[qualType.toLowerCase() as keyof typeof QUAL_LEVELS] ?? 0;
  return { level, stream };
}

export function inferQualificationStream(qualificationName: string | null | undefined, qualificationType: string | null | undefined): QualStream {
  const text = `${qualificationType || ""} ${qualificationName || ""}`.toLowerCase();
  if (text.includes("b.tech") || text.includes("btech") || text.includes("m.tech") || text.includes("engineering") || text.includes("b.e") || text.includes("m.e")) return "engineering";
  if (text.includes("mbbs") || text.includes("medical") || text.includes("bds")) return "medical";
  if (text.includes("llb") || text.includes("law")) return "law";
  if (text.includes("b.ed") || text.includes("bed") || text.includes("tet") || text.includes("ctet")) return "teaching";
  if (text.includes("nursing") || text.includes("gnm") || text.includes("anm")) return "nursing";
  if (text.includes("pharmacy") || text.includes("pharm")) return "pharmacy";
  return "general";
}

export function getQualStreamLabel(stream: QualStream): string {
  const labels: Record<QualStream, string> = {
    general: "General", engineering: "Engineering", medical: "Medical",
    teaching: "Teaching", law: "Law", nursing: "Nursing", pharmacy: "Pharmacy",
  };
  return labels[stream];
}

function parseOrQualifications(qualification: string): QualPath[] {
  const paths: QualPath[] = [];
  const text = qualification.toLowerCase();
  const segments = text.split(/\s*(?:\bor\b|\band\/or\b|\/)\s*/i).map((s) => s.trim()).filter(Boolean);
  for (const segment of segments) {
    const profile = parseJobQualRequirement(segment);
    if (profile.level > 0) paths.push({ ...profile, rawText: segment });
  }
  if (paths.length === 0) {
    const profile = parseJobQualRequirement(text);
    if (profile.level > 0) paths.push({ ...profile, rawText: text });
  }
  return paths;
}

function computeMinQualLevel(qualification: string): number {
  const paths = parseOrQualifications(qualification);
  if (paths.length === 0) return 0;
  return Math.min(...paths.map((p) => p.level));
}

function extractRequiredStreams(jobText: string): QualStream[] {
  const streams: QualStream[] = [];
  const text = jobText.toLowerCase();
  const streamMap: Record<QualStream, RegExp> = {
    engineering: /\b(engineering|b\.?tech|b\.?e\b|m\.?tech|m\.?e\b|diploma\s+in\s+engineering)\b/i,
    medical: /\b(medical|mbbs|bds|bams|bhms|nursing|gnm|anm)\b/i,
    teaching: /\b(teaching|b\.?ed|bed|tet|ctet|education)\b/i,
    law: /\b(law|llb|llm|legal|advocate)\b/i,
    nursing: /\b(nursing|gnm|anm|b\.?sc\s+nursing)\b/i,
    pharmacy: /\b(pharmacy|b\.?pharm|d\.?pharm|pharmacist)\b/i,
    general: /./,
  };
  for (const [stream, pattern] of Object.entries(streamMap)) {
    if (pattern.test(text) && stream !== "general") streams.push(stream as QualStream);
  }
  return [...new Set(streams)];
}

function parseJobQualRequirement(qualification: string): QualProfile {
  const text = qualification.toLowerCase();
  if (text.includes("b.tech") || text.includes("btech") || text.includes("b.e.") || text.includes("b.e ") || text.includes("b.e,") || (text.includes("engineering") && (text.includes("graduate") || text.includes("degree")))) return { level: 4, stream: "engineering" };
  if (text.includes("m.tech") || text.includes("mtech") || text.includes("m.e.") || text.includes("m.e ")) return { level: 5, stream: "engineering" };
  if (text.includes("mbbs") || text.includes("medical degree") || text.includes("bds")) return { level: 4, stream: "medical" };
  if (text.includes("nursing") || text.includes("b.sc nursing") || text.includes("gnm")) return { level: 4, stream: "nursing" };
  if (text.includes("pharmacy") || text.includes("b.pharm") || text.includes("d.pharm")) return { level: text.includes("d.pharm") ? 3.5 : 4, stream: "pharmacy" };
  if (text.includes("b.ed") || text.includes("bed") || text.includes("tet") || text.includes("ctet")) return { level: 4, stream: "teaching" };
  if (text.includes("llb") || text.includes("l.l.b") || text.includes("law degree") || text.includes("advocate")) return { level: 4, stream: "law" };
  if (text.includes("phd") || text.includes("doctorate")) return { level: 6, stream: "general" };
  if (text.includes("post") || text.includes("master") || text.includes("m.sc") || text.includes("m.a") || text.includes("m.com") || text.includes("mba") || text.includes("mca")) return { level: 5, stream: "general" };
  if (text.includes("graduate") || text.includes("graduation") || text.includes("bachelor") || text.includes("degree") || text.includes("b.sc") || text.includes("b.a") || text.includes("b.com") || text.includes("bca") || text.includes("bba")) return { level: 4, stream: "general" };
  if (text.includes("diploma")) return { level: 3.5, stream: "general" };
  if (text.includes("iti")) return { level: 3, stream: "general" };
  if (text.includes("12th") || text.includes("class xii") || text.includes("intermediate") || text.includes("higher secondary") || text.includes("+2")) return { level: 3, stream: "general" };
  if (text.includes("10th") || text.includes("class x") || text.includes("matriculation") || text.includes("ssc pass") || text.includes("10 pass")) return { level: 2, stream: "general" };
  if (text.includes("8th") || text.includes("class viii") || text.includes("middle")) return { level: 1, stream: "general" };
  return { level: 0, stream: "general" };
}

// ═════════════════════════════════════════════════════════════════════════
// AGE, EXPERIENCE, DOMICILE, GENDER (Preserved from v2)
// ═════════════════════════════════════════════════════════════════════════

export function computeAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

interface AgeRelaxation { years: number; appliesTo: string; }

function getAgeRelaxationDetails(category: string | null): AgeRelaxation {
  const cat = category?.toUpperCase() || "GENERAL";
  switch (cat) {
    case "OBC": case "OBC-NCL": return { years: 3, appliesTo: "OBC" };
    case "SC": return { years: 5, appliesTo: "SC" };
    case "ST": return { years: 5, appliesTo: "ST" };
    case "EWS": return { years: 0, appliesTo: "EWS" };
    case "PWBD": case "PWD": case "PH": return { years: 10, appliesTo: "PwBD" };
    case "EX-SERVICEMEN": case "EX-SM": return { years: 5, appliesTo: "Ex-Servicemen" };
    case "WIDOWS": case "DIVORCED": case "JUDICIALLY SEPARATED": return { years: 5, appliesTo: "Widows/Divorced Women" };
    default: return { years: 0, appliesTo: "General" };
  }
}

function getAgeRelaxation(category: string | null): number {
  return getAgeRelaxationDetails(category).years;
}

function parseExperienceRequirement(jobText: string): ExperienceRequirement | null {
  const text = jobText.toLowerCase();
  const mandatoryPatterns = [
    /(?:minimum|min\.?|at least|not less than)\s*(\d+)\s*(?:\+?\s*years?|yrs?|y\b).*?(?:experience|exp|service)/i,
    /(?:experience|exp|service).*?(?:of|required|minimum|at least)\s*(\d+)\s*(?:\+?\s*years?|yrs?|y\b)/i,
    /(?:\d+)\s*(?:\+?\s*years?|yrs?|y\b).*?(?:post-qualification|post qualification|relevant|professional).*?(?:experience|exp)/i,
  ];
  const desirablePatterns = [
    /(?:desirable|preferred|preferable|advantage|plus|added advantage).*?(?:\d+)\s*(?:years?|yrs?|y\b).*?(?:experience|exp)/i,
    /(?:experience|exp).*?(?:desirable|preferred).*?(?:\d+)\s*(?:years?|yrs?|y\b)/i,
  ];
  for (const pattern of mandatoryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[1]);
      if (!isNaN(years) && years > 0) return { minYears: years, maxYears: null, isMandatory: true, rawText: match[0] };
    }
  }
  const rangeMatch = text.match(/(\d+)\s*[-–to]\s*(\d+)\s*(?:years?|yrs?|y\b).*?(?:experience|exp)/i);
  if (rangeMatch) {
    return { minYears: parseInt(rangeMatch[1]), maxYears: parseInt(rangeMatch[2]), isMandatory: true, rawText: rangeMatch[0] };
  }
  for (const pattern of desirablePatterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[0].match(/\d+/)?.[0] || "0");
      if (years > 0) return { minYears: years, maxYears: null, isMandatory: false, rawText: match[0] };
    }
  }
  return null;
}

function checkExperience(userExperienceYears: number | null, req: ExperienceRequirement | null): { ok: boolean; gap: number } {
  if (!req) return { ok: true, gap: 0 };
  if (userExperienceYears === null) return { ok: !req.isMandatory, gap: req.minYears };
  const gap = Math.max(0, req.minYears - userExperienceYears);
  return { ok: gap === 0, gap };
}

function detectDomicileRequirement(jobText: string): DomicileRequirement {
  const text = jobText.toLowerCase();
  const result: DomicileRequirement = { required: false, states: [], isMandatory: false, rawText: "" };
  const mandatoryPatterns = [
    /(?:must be|should be|shall be|only)\s+(?:a\s+)?(?:domicile|resident|permanent resident|local)\s+(?:of|in)\s+([a-z\s]+?)(?:\s*(?:state|\.|,|;|$))/i,
    /(?:domicile|residence)\s+(?:of|in)\s+([a-z\s]+?)(?:\s*(?:state|is|shall|must|required|mandatory|essential|\.|,|;|$))/i,
    /(?:state\s+)?domicile\s+(?:of|in)\s+([a-z\s]+?)(?:\s*(?:is|required|mandatory|essential|\.|,|;|$))/i,
  ];
  const preferredPatterns = [
    /(?:preference|preferred|advantage)\s+(?:to|for)\s+(?:domicile|resident|local)\s+(?:of|in)\s+([a-z\s]+?)(?:\s*(?:state|\.|,|;|$))/i,
    /(?:domicile|resident|local)\s+(?:of|in)\s+([a-z\s]+?)(?:\s*(?:state|\.|,|;|$)).*?preference/i,
  ];
  for (const pattern of mandatoryPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.required = true; result.isMandatory = true; result.rawText = match[0];
      const stateName = match[1].trim();
      if (stateName.length > 2) result.states.push(stateName);
      return result;
    }
  }
  for (const pattern of preferredPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.required = true; result.isMandatory = false; result.rawText = match[0];
      const stateName = match[1].trim();
      if (stateName.length > 2) result.states.push(stateName);
      return result;
    }
  }
  if (/\b(?:domicile|resident of|local candidate)\b/i.test(text)) {
    result.required = true;
    result.isMandatory = /\b(?:must|shall|only|mandatory|essential)\b/i.test(text);
    result.rawText = "Domicile requirement mentioned";
  }
  return result;
}

function detectGenderRequirement(title: string, description: string | null): GenderRequirement {
  const text = `${title} ${description || ""}`.toLowerCase();
  const result: GenderRequirement = { required: null, isMandatory: false, reason: "" };
  const femalePatterns = [
    /\b(?:only\s+)?(?:women|female|mahila|lady|ladies|girl|girls)\s*(?:candidates?|applicants?|only|preferred)?\b/i,
    /\b(?:for\s+)?(?:women|female|mahila)\s*(?:only|candidates?|applicants?)?\b/i,
    /\b(?:post\s+is\s+)?(?:reserved\s+)?(?:for\s+)?(?:women|female|mahila)\b/i,
  ];
  const malePatterns = [
    /\b(?:only\s+)?(?:male|men|man)\s*(?:candidates?|applicants?|only|preferred)?\b/i,
    /\b(?:for\s+)?(?:male|men)\s*(?:only|candidates?|applicants?)?\b/i,
    /\b(?:post\s+is\s+)?(?:reserved\s+)?(?:for\s+)?(?:male|men)\b/i,
  ];
  for (const pattern of femalePatterns) {
    const match = text.match(pattern);
    if (match) { result.required = "female"; result.isMandatory = /\bonly\b|\breserved\b/i.test(match[0]); result.reason = match[0]; return result; }
  }
  for (const pattern of malePatterns) {
    const match = text.match(pattern);
    if (match) { result.required = "male"; result.isMandatory = /\bonly\b|\breserved\b/i.test(match[0]); result.reason = match[0]; return result; }
  }
  if (/\b(?:male\s*[/&]\s*female|both\s+genders|all\s+genders)\b/i.test(text)) result.required = "both";
  return result;
}


// ═════════════════════════════════════════════════════════════════════════
// SPECIALIZED QUALIFICATION & DOMAIN EXTRACTION (Preserved from v2)
// ═════════════════════════════════════════════════════════════════════════

const GENERIC_QUAL_WORDS = new Set([
  "any", "relevant", "recognized", "approved", "equivalent", "related",
  "appropriate", "concerned", "respective", "suitable", "corresponding",
]);

function detectSpecializedRequirements(jobText: string, userQualificationName: string | null): string[] {
  const missing: string[] = [];
  const userQualLower = (userQualificationName || "").toLowerCase();
  const seen = new Set<string>();
  const patterns: RegExp[] = [
    /\b(?:pg\s+)?(diploma)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
    /\b(?:bachelor'?s?|master'?s?)?\s*(degree)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
    /\b(b\.?\s*(?:sc|tech|e|a|com|pharm|ed|arch|lib)|m\.?\s*(?:sc|tech|e|a|com|pharm|ed))\s*\.?\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
    /\b(certificate|certification|cert\.?)\s+(?:course\s+)?(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
    /\b(?:post\s*[-\s]?graduate\s+)?(diploma|certificate)\s+(?:in|of)\s+([a-z][a-z\s&/,]+?)(?:\s+(?:from|issued|recognized|by|with|or|and\s+(?:its|any)|under)\b|[.;,]|$)/gi,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(jobText)) !== null) {
      const qualType = match[1].trim();
      const specialization = match[2].trim().replace(/\s+/g, " ");
      if (!specialization || specialization.length < 3) continue;
      if (GENERIC_QUAL_WORDS.has(specialization.toLowerCase())) continue;
      const firstWord = specialization.split(/\s+/)[0].toLowerCase();
      if (GENERIC_QUAL_WORDS.has(firstWord)) continue;
      const key = `${qualType.toLowerCase()}|${specialization.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const specLower = specialization.toLowerCase();
      const userHasSpec = userQualLower.includes(specLower) || specLower.split(/\s+/).filter((w) => w.length > 3).some((word) => userQualLower.includes(word));
      if (!userHasSpec) {
        const label = `${qualType.charAt(0).toUpperCase()}${qualType.slice(1)} in ${specialization.charAt(0).toUpperCase()}${specialization.slice(1)}`;
        missing.push(label);
      }
    }
  }
  return missing;
}

function extractDomainRequirements(eligibilityText: string | null, userQualificationName: string | null): string[] {
  if (!eligibilityText || !eligibilityText.includes("|")) return [];
  const missing: string[] = [];
  const userQualLower = (userQualificationName || "").toLowerCase();
  const seen = new Set<string>();
  const segments = eligibilityText.split("|").map((s) => s.trim()).filter(Boolean);
  const ELIGIBILITY_SENTENCE_PATTERN = /\b(candidates?\s+(from|should|must|who|are\s+eligible)|applicants?\s+(should|must|who)|eligible\s+to\s+apply|years?\s+of\s+(?:experience|service)|age\s+(?:limit|relaxat)|relaxation|reservation|upper\s+age|salary|pay\s+(?:scale|band|matrix)|probation|posting|selected\s+candidate|how\s+to\s+apply|not\s+essential|indian\s+citizen|domicile|residence\s+certificate|category\s+age|cumulative)\b/i;
  const AGE_RELAXATION_PATTERN = /^\s*(?:(?:SC|ST|OBC|EWS|PwBD|PwD|Ex[\s-]?Servicem|General|UR)[\s/]*(?:SC|ST|OBC|EWS|PwBD|PwD|NCL|Non[\s-]?Creamy)?[\s:]*\d|(?:Maximum|Minimum|Not exceeding|Max|Min)\s+\d+\s*years?|\d+\s*(?:to|-)\s*\d+\s*years?|Category\s+Age|Post\s+(?:Name|Max\s+Age)|Note:|Age\s+Relaxation|Only\s+Indian)/i;
  const TABLE_HEADER_PATTERN = /^\s*(?:Post\s+Name\s+Qualification|Educational\s+Qualification\s*&\s*Age|Essential\s+Qualification\s+Experience|Post\s+Max\s+Age)/i;
  const QUAL_LEVEL_PATTERN = /^\s*(graduation|graduate|post[\s-]?graduat|bachelor|master|diploma|iti|12th|10th|8th|class\s+(?:x|xii|viii)|matriculation|degree\s+in\s+any|any\s+(?:degree|graduate)|phd|doctorate|b\.?tech|m\.?tech|mbbs|llb|b\.?ed|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|b\.?com|m\.?com|bca|mca|mba|gnm|anm|d\.?pharm|b\.?pharm|bams|bhms|bums|bsms|bnys)\s*$/i;
  for (const segment of segments) {
    const wordCount = segment.trim().split(/\s+/).length;
    const segLower = segment.toLowerCase().trim();
    if (segLower.length < 3 || /^\d/.test(segLower)) continue;
    if (ELIGIBILITY_SENTENCE_PATTERN.test(segment)) continue;
    if (AGE_RELAXATION_PATTERN.test(segment)) continue;
    if (TABLE_HEADER_PATTERN.test(segment)) continue;
    if (wordCount <= 6) {
      if (QUAL_LEVEL_PATTERN.test(segment)) continue;
      if (GENERIC_QUAL_WORDS.has(segLower)) continue;
      if (seen.has(segLower)) continue;
      seen.add(segLower);
      const userHasDomain = userQualLower.includes(segLower) || segLower.split(/\s+/).filter((w) => w.length > 3).some((word) => userQualLower.includes(word));
      if (!userHasDomain) missing.push(segment.trim());
    } else {
      const expPattern = /(?:experience|expertise|proficiency|specialization|knowledge)\s+(?:in|of|with)\s+(.+?)(?:\s*[.;]\s*|$)/gi;
      expPattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = expPattern.exec(segment)) !== null) {
        const rawList = match[1];
        const parts = rawList.split(/,\s*|\s+and\s+/).map((p) => p.trim()).filter((p) => p.length > 3 && p.split(/\s+/).length <= 5);
        for (const part of parts) {
          const partLower = part.toLowerCase();
          if (seen.has(partLower)) continue;
          seen.add(partLower);
          if (!userQualLower.includes(partLower)) missing.push(part.charAt(0).toUpperCase() + part.slice(1));
        }
      }
      const slashPattern = /([a-z]+(?:\s+[a-z]+)?)\/([a-z]+(?:\s+[a-z]+)?)/gi;
      slashPattern.lastIndex = 0;
      let slashMatch: RegExpExecArray | null;
      while ((slashMatch = slashPattern.exec(segment)) !== null) {
        for (let i = 1; i < slashMatch.length; i++) {
          const part = slashMatch[i].trim();
          if (part.length > 3) {
            const partLower = part.toLowerCase();
            if (!seen.has(partLower) && !userQualLower.includes(partLower)) {
              seen.add(partLower);
              missing.push(part.charAt(0).toUpperCase() + part.slice(1));
            }
          }
        }
      }
    }
  }
  return missing;
}

// ═════════════════════════════════════════════════════════════════════════
// GRADE / CATEGORY INFERENCE
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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "UPSC": ["upsc", "union public service", "ias", "ips", "ifs", "civil services"],
  "SSC": ["ssc", "staff selection commission", "cgl", "chsl", "mts", "stenographer"],
  "State PSC": ["psc", "public service commission", "bpsc", "uppsc", "mpsc", "jpsc", "rpsc", "kpsc", "tnpsc", "appsc", "wbpsc"],
  "Railway": ["railway", "rrb", "indian railways", "irctc", "rail coach"],
  "Banking": ["bank", "ibps", "rbi", "sbi", "nabard"],
  "Insurance": ["insurance", "lic", "nicl", "uiicl", "oriental insurance", "new india assurance"],
  "Defence": ["defence", "defense", "army", "navy", "air force", "nda", "cds", "afcat"],
  "Police": ["police", "constable", "sub inspector", "si ", "home guard"],
  "Paramilitary": ["capf", "bsf", "crpf", "cisf", "itbp", "ssb", "assam rifles"],
  "Teaching": ["teacher", "teaching", "tgt", "pgt", "assistant professor", "lecturer", "tet", "ctet", "bed"],
  "Engineering": ["engineer", "engineering", "je", "ae", "junior engineer", "assistant engineer", "technical"],
  "Medical": ["medical", "doctor", "mbbs", "bds", "pharmacist", "lab technician", "health officer"],
  "Nursing": ["nursing", "nurse", "gnm", "anm"],
  "Pharmacy": ["pharmacy", "pharmacist", "b.pharm", "d.pharm"],
  "Clerical": ["clerk", "ldc", "udc", "assistant", "data entry", "deo"],
  "Judiciary": ["judicial", "judge", "court", "magistrate", "district judge"],
  "Forest": ["forest", "wildlife", "range officer", "forest guard"],
  "Post Office": ["post office", "postal", "gds", "gramin dak sevak", "india post"],
  "PSU": ["psu", "ongc", "ntpc", "bhel", "gail", "iocl", "sail", "drdo", "isro"],
};

function inferCategory(department: string, title: string): string | null {
  const text = `${department} ${title}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// LOCATION HELPERS
// ═════════════════════════════════════════════════════════════════════════

export function getBestJobLocation(job: Job): string {
  const genericLocations = ["india", "all india", "across india", "pan india", "various", "multiple"];
  const loc = (job.location || "").toLowerCase();
  const isGeneric = genericLocations.some((g) => loc.includes(g));
  if (isGeneric) {
    const inferred = extractLocationFromText(`${job.title} ${job.department}`);
    job.inferred_location = inferred;
    return cleanLocationString(inferred) || cleanLocationString(job.location);
  }
  job.inferred_location = null;
  return cleanLocationString(job.location);
}

// ═════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK — COMPREHENSIVE (Uses cached JobRequirements)
// ═════════════════════════════════════════════════════════════════════════

export interface EligibilityResult {
  eligible: boolean;
  ageOk: boolean | null;
  qualOk: boolean | null;
  genderOk: boolean | null;
  experienceOk: boolean | null;
  domicileOk: boolean | null;
  skillsMissing: JobSkill[];
  skillsDesirable: JobSkill[];
  skillsUpgradeNeeded: { jobSkill: JobSkill; userLevel: SkillLevel }[];
  specializedMissing: string[];
  domainMissing: string[];
  experienceGap: number;
  reasons: string[];
  warnings: string[];
  gapReport: QualificationGapReport;
}

export interface QualificationGapReport {
  additionalQualificationsNeeded: string[];
  skillsToAcquire: string[];
  skillsToUpgrade: string[];
  experienceGap: string;
  domicileIssue: string;
  canApplyWithGap: boolean;
  estimatedTimeToEligible: string;
}

export interface MatchPreferences {
  dob: string | null;
  qualificationType: string | null;
  qualificationStream: QualStream;
  qualificationName: string | null;
  sectors: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  locations: string[];
  grades: string[];
  skills: UserSkill[];                    // CHANGED: Now UserSkill[] with levels
  category: string | null;
  gender: string | null;
  experienceYears: number | null;
  domicileState: string | null;
}

export type EligibilityTier = "fully_eligible" | "near_eligible" | "skill_gap" | "not_eligible";

export function getEligibilityTier(result: EligibilityResult): EligibilityTier {
  if (result.eligible && result.skillsMissing.length === 0 && result.specializedMissing.length === 0) return "fully_eligible";
  if (result.eligible && (result.skillsMissing.length > 0 || result.specializedMissing.length > 0)) return "skill_gap";
  const hasHardBlock = result.reasons.some((r) => r.includes("Min age") || r.includes("Max age") || (r.includes("Requires") && !r.includes("specific stream")));
  if (!hasHardBlock && (result.skillsMissing.length <= 2 || result.experienceGap <= 1)) return "near_eligible";
  return "not_eligible";
}

/**
 * Main eligibility check — uses pre-computed JobRequirements for performance.
 * Falls back to on-the-fly parsing if JobRequirements not provided.
 */
export function checkEligibility(
  userAge: number | null,
  userQual: QualProfile | null,
  job: Job,
  category: string | null = null,
  gender: string | null = null,
  userSkills: UserSkill[] = [],
  userQualificationName: string | null = null,
  userExperienceYears: number | null = null,
  userDomicileState: string | null = null,
  cachedRequirements: JobRequirements | null = null
): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let ageOk: boolean | null = null;
  let qualOk: boolean | null = null;
  let genderOk: boolean | null = null;
  let experienceOk: boolean | null = null;
  let domicileOk: boolean | null = null;

  // Use cached requirements if available, otherwise compute on-the-fly
  const reqs = cachedRequirements || computeJobRequirements(job);
  const jobText = `${job.title || ""} ${job.qualification || ""} ${job.eligibility || ""} ${job.description || ""}`.toLowerCase();

  // ── Age Check ────────────────────────────────────────────────
  if (userAge !== null) {
    const hasAgeReq = reqs.ageMin !== null || reqs.ageMax !== null;
    if (hasAgeReq) {
      const relaxation = getAgeRelaxation(category);
      const relaxationDetails = getAgeRelaxationDetails(category);
      const min = reqs.ageMin ?? 0;
      const max = (reqs.ageMax ?? 100) + relaxation;
      ageOk = userAge >= min && userAge <= max;
      if (!ageOk) {
        if (userAge < min) reasons.push(`Min age ${min}, you are ${userAge}`);
        else reasons.push(`Max age ${max - relaxation}${relaxation > 0 ? ` (+${relaxation} ${relaxationDetails.appliesTo} relaxation)` : ""}, you are ${userAge}`);
      }
    }
  }

  // ── Qualification Check (with fuzzy matching) ────────────────
  if (userQual !== null && job.qualification) {
    qualOk = isQualificationEligibleFuzzy(userQualificationName, reqs.qualificationPaths);
    if (!qualOk) {
      const label = getJobQualLabel(job.qualification);
      const userLevel = userQual.level;
      const minJobLevel = reqs.minQualificationLevel;
      if (minJobLevel > 0 && userLevel < minJobLevel) reasons.push(`Requires ${label}`);
      else reasons.push(`Requires ${label} (specific stream)`);
    }
  }

  // ── Gender Check ─────────────────────────────────────────────
  if (gender && reqs.gender.required) {
    const userGender = gender.toLowerCase();
    if (reqs.gender.required === "female" && userGender !== "female") {
      genderOk = false;
      reasons.push(reqs.gender.isMandatory ? "Female candidates only" : "Female candidates preferred");
    } else if (reqs.gender.required === "male" && userGender !== "male") {
      genderOk = false;
      reasons.push(reqs.gender.isMandatory ? "Male candidates only" : "Male candidates preferred");
    } else {
      genderOk = true;
    }
  }

  // ── Experience Check ─────────────────────────────────────────
  const expCheck = checkExperience(userExperienceYears, reqs.experience);
  experienceOk = expCheck.ok;
  if (!experienceOk && reqs.experience) {
    if (reqs.experience.isMandatory) {
      reasons.push(`Requires ${reqs.experience.minYears}+ years experience (you have ${userExperienceYears ?? 0})`);
    } else {
      warnings.push(`Desirable: ${reqs.experience.minYears}+ years experience`);
    }
  }

  // ── Domicile Check ───────────────────────────────────────────
  if (reqs.domicile.required && userDomicileState) {
    const userStateLower = userDomicileState.toLowerCase();
    const hasMatchingState = reqs.domicile.states.some((s) =>
      userStateLower.includes(s.toLowerCase()) || s.toLowerCase().includes(userStateLower)
    );
    domicileOk = hasMatchingState;
    if (!domicileOk) {
      if (reqs.domicile.isMandatory) {
        reasons.push(`Requires domicile of ${reqs.domicile.states.join(" or ") || "specific state"}`);
      } else {
        warnings.push(`Preferred domicile: ${reqs.domicile.states.join(" or ") || "local candidate"}`);
      }
    }
  }

  // ── Skill Check (with levels) ────────────────────────────────
  const allJobSkills = [...reqs.requiredSkills, ...reqs.desirableSkills];
  const skillResult = checkSkillsWithLevels(allJobSkills, userSkills);

  // ── Specialized & Domain ───────────────────────────────────
  const specializedMissing = detectSpecializedRequirements(jobText, userQualificationName);
  const domainMissing = extractDomainRequirements(job.eligibility, userQualificationName);

  // ── Build Gap Report ───────────────────────────────────────
  const gapReport: QualificationGapReport = {
    additionalQualificationsNeeded: [],
    skillsToAcquire: [],
    skillsToUpgrade: [],
    experienceGap: "",
    domicileIssue: "",
    canApplyWithGap: false,
    estimatedTimeToEligible: "",
  };

  if (!qualOk && reqs.qualificationPaths.length > 0) {
    if (userQual && userQual.level < reqs.minQualificationLevel) {
      const levelGap = reqs.minQualificationLevel - userQual.level;
      if (levelGap <= 0.5) gapReport.additionalQualificationsNeeded.push("Complete your current qualification level");
      else if (levelGap <= 1.5) gapReport.additionalQualificationsNeeded.push("Higher secondary education or diploma needed");
      else gapReport.additionalQualificationsNeeded.push("Graduate degree required");
    }
    if (userQual && reqs.requiredStreams.length > 0 && !reqs.requiredStreams.includes(userQual.stream)) {
      gapReport.additionalQualificationsNeeded.push(`Degree in: ${reqs.requiredStreams.map(getQualStreamLabel).join(" or ")}`);
    }
  }

  gapReport.skillsToAcquire = skillResult.missing.map((s) => `${s.label} (${s.level})`);
  gapReport.skillsToUpgrade = skillResult.upgradeNeeded.map((u) => `${u.jobSkill.label}: ${u.userLevel} → ${u.jobSkill.level}`);

  if (reqs.experience && !experienceOk) {
    const gap = reqs.experience.minYears - (userExperienceYears ?? 0);
    gapReport.experienceGap = `${gap} year${gap !== 1 ? "s" : ""} of relevant experience needed`;
  }

  if (reqs.domicile.required && !domicileOk) {
    gapReport.domicileIssue = reqs.domicile.isMandatory
      ? `Must be domiciled in ${reqs.domicile.states.join(" or ") || "the required state"}`
      : `Local/domicile candidates preferred`;
  }

  const hardBlocks = reasons.length;
  const hasMandatoryDomicileBlock = reqs.domicile.required && reqs.domicile.isMandatory && !domicileOk;
  const hasMandatoryExpBlock = reqs.experience?.isMandatory && !experienceOk;
  gapReport.canApplyWithGap = hardBlocks === 0 || (!hasMandatoryDomicileBlock && !hasMandatoryExpBlock && reasons.every((r) => !r.includes("Min age") && !r.includes("Max age")));

  const gaps: string[] = [];
  if (gapReport.additionalQualificationsNeeded.length > 0) gaps.push("1-3 years (education)");
  if (gapReport.experienceGap) gaps.push(gapReport.experienceGap);
  if (gapReport.skillsToAcquire.length > 0) gaps.push("3-6 months (skills)");
  if (gapReport.skillsToUpgrade.length > 0) gaps.push("1-3 months (skill upgrade)");
  gapReport.estimatedTimeToEligible = gaps.length > 0 ? gaps.join("; ") : "You are eligible now!";

  // ── Final eligibility ────────────────────────────────────────
  const eligible =
    (ageOk === null || ageOk) &&
    (qualOk === null || qualOk) &&
    (genderOk === null || genderOk) &&
    (experienceOk === null || experienceOk) &&
    (domicileOk === null || domicileOk);

  return {
    eligible,
    ageOk,
    qualOk,
    genderOk,
    experienceOk,
    domicileOk,
    skillsMissing: skillResult.missing,
    skillsDesirable: reqs.desirableSkills,
    skillsUpgradeNeeded: skillResult.upgradeNeeded,
    specializedMissing,
    domainMissing,
    experienceGap: reqs.experience ? (reqs.experience.minYears - (userExperienceYears ?? 0)) : 0,
    reasons,
    warnings,
    gapReport,
  };
}


// ═════════════════════════════════════════════════════════════════════════
// FILTERS & SCORING
// ═════════════════════════════════════════════════════════════════════════

function passesSalaryFilter(job: Job, prefMin: number | null, prefMax: number | null): boolean {
  if (prefMin === null && prefMax === null) return true;
  if (job.salary_min === null && job.salary_max === null) return true;
  const jobMin = job.salary_min ?? 0;
  const jobMax = job.salary_max ?? Infinity;
  const pMin = prefMin ?? 0;
  const pMax = prefMax ?? Infinity;
  return jobMax >= pMin && jobMin <= pMax;
}

function passesGradeFilter(job: Job, prefGrades: string[]): boolean {
  if (prefGrades.length === 0) return true;
  const jobGrade = inferGrade(job.title, job.department);
  if (!jobGrade) return true;
  return prefGrades.includes(jobGrade);
}

function locationMatchScore(job: Job, prefLocations: string[]): number {
  if (prefLocations.length === 0) return 0;
  const bestLoc = getBestJobLocation(job);
  const resolvedState = resolveStateFromLocationText(bestLoc) || resolveStateFromLocationText(job.location);
  const isNationwide = isAllIndiaLocationText(job.location);
  const matchesPreferredState = prefLocations.some((pref) => {
    const prefLower = pref.toLowerCase();
    return bestLoc.toLowerCase().includes(prefLower) || (resolvedState ? resolvedState.toLowerCase() === prefLower : false);
  });
  if (matchesPreferredState) return 3;
  if (isNationwide) return 2;
  return 0;
}

// ═════════════════════════════════════════════════════════════════════════
// PRIORITY SCORING (Enhanced with skill levels)
// ═════════════════════════════════════════════════════════════════════════

export function scorePriority(job: Job, prefs: MatchPreferences, cachedReqs?: JobRequirements): number {
  let score = 0;
  const today = new Date();
  const reqs = cachedReqs || computeJobRequirements(job);

  // Location match
  score += locationMatchScore(job, prefs.locations);

  // Sector match
  if (prefs.sectors.length > 0) {
    const sectorMatch = prefs.sectors.some((s) => matchesSectorPreference(job.department, job.title, s));
    if (sectorMatch) score += 3;
  }

  // Skill match with level bonus
  const skillResult = checkSkillsWithLevels(reqs.requiredSkills, prefs.skills);
  score += skillResult.matched.length;
  score += skillResult.overqualified.length * 0.5; // Small bonus for being overqualified

  // Urgency boost
  const lastDate = parseJobDeadline(job.last_date);
  if (lastDate) {
    const daysLeft = (lastDate.getTime() - today.getTime()) / 86400000;
    if (daysLeft <= 7) score += 2;
    else if (daysLeft <= 15) score += 1;
  }

  // Higher vacancies boost
  if (job.vacancies && job.vacancies >= 100) score += 1;

  return score;
}

// ═════════════════════════════════════════════════════════════════════════
// MATCH & SORT — Uses cached JobRequirements for performance
// ═════════════════════════════════════════════════════════════════════════

export interface MatchedJob {
  job: Job;
  eligibility: EligibilityResult;
  priorityScore: number;
  eligibilityTier: EligibilityTier;
  cachedRequirements: JobRequirements;
}

export function matchAndSort(
  jobs: Job[],
  prefs: MatchPreferences,
  precomputedRequirements?: Map<string, JobRequirements>
): MatchedJob[] {
  const today = new Date();
  const userAge = prefs.dob ? computeAge(prefs.dob) : null;
  const userQual: QualProfile | null = prefs.qualificationType
    ? getUserQualProfileWithStream(prefs.qualificationType, prefs.qualificationStream)
    : null;

  return jobs
    .filter((job) => {
      const d = parseJobDeadline(job.last_date);
      if (!d) return true;
      return d >= today;
    })
    .filter((job) => passesSalaryFilter(job, prefs.salaryMin, prefs.salaryMax))
    .filter((job) => passesGradeFilter(job, prefs.grades))
    .map((job) => {
      // Use precomputed requirements if available, otherwise compute on-the-fly
      const cachedReqs = precomputedRequirements?.get(job.id) || computeJobRequirements(job);

      const eligibility = checkEligibility(
        userAge,
        userQual,
        job,
        prefs.category,
        prefs.gender,
        prefs.skills,
        prefs.qualificationName,
        prefs.experienceYears,
        prefs.domicileState,
        cachedReqs
      );
      const priorityScore = scorePriority(job, prefs, cachedReqs);
      const eligibilityTier = getEligibilityTier(eligibility);
      return { job, eligibility, priorityScore, eligibilityTier, cachedRequirements: cachedReqs };
    })
    .sort((a, b) => {
      const tierOrder: Record<EligibilityTier, number> = {
        fully_eligible: 0,
        near_eligible: 1,
        skill_gap: 2,
        not_eligible: 3,
      };
      const tierDiff = tierOrder[a.eligibilityTier] - tierOrder[b.eligibilityTier];
      if (tierDiff !== 0) return tierDiff;
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return (b.job.vacancies || 0) - (a.job.vacancies || 0);
    });
}

// ═════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS
// ═════════════════════════════════════════════════════════════════════════

export function getQualLabel(qualType: string): string {
  const labels: Record<string, string> = {
    "8th": "8th Pass", "10th": "10th Pass", "12th": "12th Pass",
    iti: "ITI", diploma: "Diploma", graduation: "Graduate",
    post_graduation: "Post Graduate", phd: "PhD",
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
    const streamLabels: Record<QualStream, string> = {
      engineering: "B.Tech/B.E", medical: "MBBS", teaching: "B.Ed",
      law: "LLB", nursing: "Nursing", pharmacy: "Pharmacy", general: base,
    };
    return streamLabels[profile.stream] ?? base;
  }
  return base;
}

export function getEducationRank(qualificationType: string): number {
  return QUAL_LEVELS[qualificationType.toLowerCase() as keyof typeof QUAL_LEVELS] ?? 0;
}

export function getSkillLabel(skill: string): string {
  const info = SKILL_TAXONOMY[skill];
  if (info) return info.label;
  return skill.replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
