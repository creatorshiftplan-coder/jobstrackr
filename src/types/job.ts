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

