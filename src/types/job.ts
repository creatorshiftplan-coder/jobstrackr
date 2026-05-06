export type EligibilityQualificationLevel = "8th" | "10th" | "12th" | "iti" | "diploma" | "graduation" | "post_graduation" | "phd";

export type EligibilityQualificationStream = "general" | "engineering" | "medical" | "teaching" | "law" | "nursing" | "pharmacy";

export interface EligibilitySourceSegment {
  type:
    | "qualification"
    | "experience"
    | "registration"
    | "language"
    | "residency"
    | "age"
    | "category"
    | "nationality"
    | "physical"
    | "negative"
    | "noise"
    | "other";
  text: string;
  applies_to_post?: string | null;
}

export interface EligibilityAgeRelaxationRule {
  category: string;
  years: number | null;
  source_text: string;
  confidence: number;
}

export interface EligibilityAgeRule {
  min: number | null;
  max: number | null;
  reference_date_text?: string | null;
  relaxations?: EligibilityAgeRelaxationRule[];
  source_text: string;
  confidence: number;
}

export interface EligibilityLanguageRule {
  key: string;
  label: string;
  modes: string[];
  level_text?: string | null;
  mandatory: boolean;
  source_text: string;
  confidence: number;
}

export interface EligibilityResidencyRule {
  type: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityRegistrationRule {
  key: string;
  label: string;
  authority?: string | null;
  source_text: string;
  confidence: number;
}

export interface EligibilitySkillRule {
  key: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityPhysicalRule {
  type: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityNegativeConstraint {
  type: string;
  label: string;
  value?: string | number | boolean | null;
  source_text: string;
  confidence: number;
}

export interface EligibilityDocumentConstraint {
  type: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityExperienceRule {
  minimum_years: number | null;
  domains: string[];
  post_qualification: boolean;
  source_text: string;
  confidence: number;
}

export interface EligibilityMarksRule {
  overall: number | null;
  category_overrides?: Record<string, number>;
  source_text: string;
  confidence: number;
}

export interface EligibilityQualificationStatusRule {
  type: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityProfessionRule {
  key: string;
  label: string;
  source_text: string;
  confidence: number;
}

export interface EligibilityAlternative {
  id: string;
  label: string;
  qualification_levels: EligibilityQualificationLevel[];
  qualification_streams: EligibilityQualificationStream[];
  specializations: string[];
  qualification_modes: string[];
  required_subjects: string[];
  minimum_marks?: EligibilityMarksRule | null;
  required_registrations: EligibilityRegistrationRule[];
  required_languages: EligibilityLanguageRule[];
  required_skills: EligibilitySkillRule[];
  experience_rule?: EligibilityExperienceRule | null;
  qualification_status_rules: EligibilityQualificationStatusRule[];
  profession_rules: EligibilityProfessionRule[];
  source_text: string;
  confidence: number;
}

export interface EligibilityGlobalRules {
  nationality: string[];
  age_rule?: EligibilityAgeRule | null;
  required_languages: EligibilityLanguageRule[];
  residency_rules: EligibilityResidencyRule[];
  required_registrations: EligibilityRegistrationRule[];
  required_skills: EligibilitySkillRule[];
  physical_rules: EligibilityPhysicalRule[];
  negative_constraints: EligibilityNegativeConstraint[];
  document_constraints: EligibilityDocumentConstraint[];
  experience_rule?: EligibilityExperienceRule | null;
}

export interface EligibilityProfile {
  version: number;
  raw_text: string;
  source_segments: EligibilitySourceSegment[];
  global_rules: EligibilityGlobalRules;
  alternatives: EligibilityAlternative[];
  quality_flags: string[];
  derived_tags: string[];
}

export interface JobMetadata {
  salary_text?: string;
  age_limit_text?: string;
  vacancies_detail?: Record<string, string>[];
  application_fees?: { category: string; fee: string }[];
  selection_process?: string[];
  important_dates?: {
    advertised_on?: string | null;
    apply_start?: string | null;
    apply_end?: string | null;
    exam_date?: string | null;
  };
  overview?: Record<string, string>;
  notification_pdf?: string | null;
  employment_type?: string;
  exam_date?: string | null;
  official_website?: string | null;
  eligibility_profile?: EligibilityProfile;
}

export interface Job {
  id: string;
  slug: string | null;
  title: string;
  department: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  age_min: number | null;
  age_max: number | null;
  application_fee: number | null;
  qualification: string;
  experience: string | null;
  vacancies: number | null;
  vacancies_display: string | null;
  application_start_date: string | null;
  last_date: string;
  last_date_display: string | null;
  description: string | null;
  eligibility: string | null;
  apply_link: string | null;
  official_website: string | null;
  is_featured: boolean | null;
  admin_refreshed_at: string | null;
  job_metadata: JobMetadata | null;
  created_at: string;
  updated_at: string;
  /** Rule-based tags for hybrid recommendations (sectors, qualification tier, org type) */
  tags?: string[] | null;
  /**
   * Location inferred from title/department if explicit location is generic (e.g. 'India', 'All India')
   */
  inferred_location?: string | null;
}

