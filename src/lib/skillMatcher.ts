import {
  SkillObject,
  TypingSkillObject,
  StenographySkillObject,
  ComputerSkillObject,
  ItiSkillObject,
  DrivingSkillObject,
  LawSkillObject,
  NccSkillObject,
  ExperienceSkillObject,
  PhysicalSkillObject,
  CustomSkillObject
} from "../types/job";

export interface SkillMatchResult {
  matched: boolean;
  reason: string;
  skill: SkillObject;
  is_gap: boolean;
  is_optional: boolean;
}

export interface AllSkillsResult {
  eligible: boolean;
  skill_score: number;
  results: SkillMatchResult[];
  gap_skills: SkillObject[];
  optional_missing: SkillObject[];
}

export interface UserSkillInfo {
  type: string;
  language?: string;
  wpm?: number | null;
  cert?: string;
  level?: number;
  trades?: string[];
  license_types?: string[];
  min_years?: number;
  label?: string;
}

/**
 * Normalizes user skill strings from the wizard/localStorage into a structured format for comparison.
 */
export function normalizeUserSkills(skills: string[]): UserSkillInfo[] {
  return skills.map((s) => {
    const lower = s.trim().toLowerCase();
    if (lower === "typing_english") {
      return { type: "typing", language: "English", wpm: null };
    }
    if (lower === "typing_hindi") {
      return { type: "typing", language: "Hindi", wpm: null };
    }
    if (lower === "computer") {
      return { type: "computer", cert: "any", level: 0 };
    }
    if (lower === "driving") {
      return { type: "driving", license_types: ["LMV"] };
    }
    if (lower === "stenography") {
      return { type: "stenography", language: "English", wpm: null };
    }
    if (lower === "swimming") {
      return { type: "custom", label: "swimming" };
    }
    if (lower === "physical_fitness") {
      return { type: "physical" };
    }

    // Fuzzy matching for custom user skills
    if (lower.includes("typing")) {
      const language = lower.includes("hindi") ? "Hindi" : "English";
      return { type: "typing", language, wpm: null };
    }
    if (lower.includes("steno") || lower.includes("shorthand")) {
      return { type: "stenography", language: "English", wpm: null };
    }
    if (lower.includes("driving") || lower.includes("license") || lower.includes("lmv") || lower.includes("hmv")) {
      return { type: "driving", license_types: [lower.includes("hmv") ? "HMV" : "LMV"] };
    }
    if (lower.includes("iti") || lower.includes("electrician") || lower.includes("fitter")) {
      const trade = lower.includes("electrician") ? "Electrician" : lower.includes("fitter") ? "Fitter" : "";
      return { type: "iti", trades: trade ? [trade] : [] };
    }

    return { type: "custom", label: s };
  });
}

/**
 * Match a required skill from a job with the student's normalized skills list.
 */
export function matchSkill(
  requiredSkill: SkillObject,
  userSkills: UserSkillInfo[]
): { matched: boolean; reason: string } {
  const type = requiredSkill.type;

  switch (type) {
    case "typing": {
      const req = requiredSkill as TypingSkillObject;
      const userTy = userSkills.find(
        (us) => us.type === "typing" && us.language?.toLowerCase() === req.language?.toLowerCase()
      );
      if (!userTy) {
        return { matched: false, reason: `Need ${req.min_wpm || 35} WPM typing in ${req.language}` };
      }
      if (req.min_wpm && userTy.wpm && userTy.wpm < req.min_wpm) {
        return { matched: false, reason: `Need ${req.min_wpm} WPM typing (you have ${userTy.wpm} WPM)` };
      }
      return { matched: true, reason: `Typing ✓ (${userTy.language} ${userTy.wpm ? `${userTy.wpm} WPM` : ""})` };
    }

    case "stenography": {
      const req = requiredSkill as StenographySkillObject;
      const userSt = userSkills.find((us) => us.type === "stenography");
      if (!userSt) {
        return { matched: false, reason: `Need ${req.min_wpm || 80} WPM stenography in ${req.language || "English"}` };
      }
      if (req.min_wpm && userSt.wpm && userSt.wpm < req.min_wpm) {
        return { matched: false, reason: `Need ${req.min_wpm} WPM stenography (you have ${userSt.wpm} WPM)` };
      }
      return { matched: true, reason: "Stenography ✓" };
    }

    case "computer": {
      const req = requiredSkill as ComputerSkillObject;
      const userCp = userSkills.find((us) => us.type === "computer" || us.label?.toLowerCase().includes("computer"));
      if (!userCp) {
        return { matched: false, reason: `Need computer certificate (${req.accepted?.join(" or ") || "CCC"})` };
      }
      return { matched: true, reason: "Computer Certificate ✓" };
    }

    case "iti": {
      const req = requiredSkill as ItiSkillObject;
      const userIti = userSkills.find((us) => us.type === "iti" || us.label?.toLowerCase().includes("iti"));
      if (!userIti) {
        return { matched: false, reason: `Need ITI Trade (${req.trades?.join(", ") || "Any"})` };
      }
      if (!req.any_trade && req.trades && req.trades.length > 0) {
        const userTrades = userIti.trades || [userIti.label || ""];
        const matchesTrade = userTrades.some((ut) =>
          req.trades.some((rt) => rt.toLowerCase() === ut.toLowerCase() || ut.toLowerCase().includes(rt.toLowerCase()))
        );
        if (!matchesTrade) {
          return { matched: false, reason: `Need ITI in ${req.trades.join(" or ")}` };
        }
      }
      return { matched: true, reason: "ITI Trade matched ✓" };
    }

    case "driving": {
      const req = requiredSkill as DrivingSkillObject;
      const userDr = userSkills.find((us) => us.type === "driving" || us.label?.toLowerCase().includes("driving"));
      if (!userDr) {
        return { matched: false, reason: `Need driving license (${req.license_types?.join("/") || "LMV"})` };
      }
      if (req.license_types && req.license_types.length > 0) {
        const userLicenses = userDr.license_types || [];
        const matchesLicense = req.license_types.some((rl) =>
          userLicenses.some((ul) => ul.toLowerCase() === rl.toLowerCase())
        );
        if (!matchesLicense) {
          return { matched: false, reason: `Need driving license type: ${req.license_types.join("/")}` };
        }
      }
      return { matched: true, reason: "Driving License ✓" };
    }

    case "law": {
      const req = requiredSkill as LawSkillObject;
      const userLaw = userSkills.find((us) => us.type === "law" || us.label?.toLowerCase().includes("law") || us.label?.toLowerCase().includes("llb"));
      if (!userLaw) {
        return { matched: false, reason: `Need Law degree (${req.accepted?.join("/") || "LLB"})` };
      }
      return { matched: true, reason: "Law Degree ✓" };
    }

    case "ncc": {
      const req = requiredSkill as NccSkillObject;
      const userNcc = userSkills.find((us) => us.type === "ncc" || us.label?.toLowerCase().includes("ncc"));
      if (!userNcc) {
        return { matched: false, reason: `NCC Certificate ${req.min_certificate || "B"} preferred` };
      }
      return { matched: true, reason: "NCC Certificate ✓" };
    }

    case "experience": {
      const req = requiredSkill as ExperienceSkillObject;
      const userExp = userSkills.find(
        (us) => us.type === "experience" || us.label?.toLowerCase().includes("experience")
      );
      if (!userExp) {
        return { matched: false, reason: `Need ${req.min_years || 1} years of experience in ${req.domain || "relevant field"}` };
      }
      if (req.min_years && userExp.min_years && userExp.min_years < req.min_years) {
        return {
          matched: false,
          reason: `Need ${req.min_years} years experience (you have ${userExp.min_years} years)`,
        };
      }
      return { matched: true, reason: "Experience matched ✓" };
    }

    case "physical": {
      const req = requiredSkill as PhysicalSkillObject;
      const userPh = userSkills.find((us) => us.type === "physical" || us.label?.toLowerCase().includes("physical"));
      if (!userPh) {
        return { matched: false, reason: "Physical standards check required" };
      }
      return { matched: true, reason: "Physical standards met ✓" };
    }

    case "custom":
    default: {
      const req = requiredSkill as CustomSkillObject;
      const label = req.label || "";
      const hasCustom = userSkills.some(
        (us) =>
          us.label?.toLowerCase().includes(label.toLowerCase()) ||
          label.toLowerCase().includes(us.label?.toLowerCase() || "")
      );
      if (!hasCustom) {
        return { matched: false, reason: `${label} required` };
      }
      return { matched: true, reason: `${label} ✓` };
    }
  }
}

/**
 * Validates all required skills for a job, determining gaps and optional missing items.
 */
export function checkAllSkills(
  requiredSkills: SkillObject[] | null | undefined,
  userSkillStrings: string[]
): AllSkillsResult {
  const normalizedUser = normalizeUserSkills(userSkillStrings);
  const results: SkillMatchResult[] = [];
  const skills = requiredSkills || [];

  for (const skill of skills) {
    const { matched, reason } = matchSkill(skill, normalizedUser);
    results.push({
      matched,
      reason,
      skill,
      is_gap: !!skill.required && !matched,
      is_optional: !skill.required,
    });
  }

  const gap_skills = results.filter((r) => r.is_gap).map((r) => r.skill);
  const optional_missing = results.filter((r) => r.is_optional && !r.matched).map((r) => r.skill);
  const eligible = gap_skills.length === 0;

  // Calculate skill score: percent of required skills matched
  const requiredCount = skills.filter((s) => s.required).length;
  const matchedRequiredCount = results.filter((r) => r.skill.required && r.matched).length;
  const skill_score = requiredCount > 0 ? matchedRequiredCount / requiredCount : 1.0;

  return {
    eligible,
    skill_score,
    results,
    gap_skills,
    optional_missing,
  };
}
