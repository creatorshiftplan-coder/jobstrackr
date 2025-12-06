export interface Job {
  id: string;
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
  last_date: string;
  last_date_display: string | null;
  description: string | null;
  eligibility: string | null;
  apply_link: string | null;
  is_featured: boolean | null;
  created_at: string;
  updated_at: string;
}
