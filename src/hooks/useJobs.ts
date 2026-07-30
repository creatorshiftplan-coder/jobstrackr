import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

interface UseJobsOptions {
  enabled?: boolean;
  bypassCache?: boolean;
}

/**
 * Columns the list/card views render. Mirrors JOB_LIST_COLUMNS in
 * api/cache/[key].ts — the two must agree, because this is the shape the client
 * falls back to when that endpoint is unavailable.
 */
const JOB_LIST_COLUMNS = [
  "id", "slug", "title", "department", "location",
  "last_date", "last_date_display", "vacancies", "vacancies_display",
  "qualification", "eligibility", "experience",
  "salary_min", "salary_max", "age_min", "age_max",
  "application_fee", "is_featured",
  "admin_refreshed_at", "created_at", "tags",
];

/** `job_metadata` sub-keys the list views read — see LIST_METADATA_KEYS server-side. */
const LIST_METADATA_KEYS = ["age_limit_text", "salary_text", "exam_date"];

/**
 * Selecting whole `job_metadata` here and discarding it in JS would still bill
 * the full column: this fallback runs in the browser, straight against
 * Supabase, once per visitor. During an `/api/cache/jobs` outage that is the
 * single most expensive query the site can issue, so it pulls only the sub-keys
 * the cards actually render — the same 46% saving the server-side query gets.
 */
const listSelect = (withEligibility: boolean) =>
  [
    ...JOB_LIST_COLUMNS,
    ...(withEligibility ? ["eligibility_summary", "required_skills"] : []),
    ...LIST_METADATA_KEYS.map((key) => `jm_${key}:job_metadata->${key}`),
  ].join(",");

/** Fold the flat `jm_*` aliases back into `job_metadata`, as the server does. */
function reshapeJobListRow(job: Record<string, any>): Record<string, any> {
  const meta: Record<string, any> = {};
  for (const key of LIST_METADATA_KEYS) {
    const alias = `jm_${key}`;
    const value = job[alias];
    delete job[alias];
    if (value !== null && value !== undefined) meta[key] = value;
  }
  job.job_metadata = Object.keys(meta).length > 0 ? meta : null;
  return job;
}

/**
 * Shared by the `useJobs` and `useHomepageData` fallbacks. Retries without the
 * eligibility columns first, matching the previous behaviour on databases that
 * predate them.
 */
export async function fetchJobListFromSupabase(): Promise<Job[]> {
  for (const withEligibility of [true, false]) {
    const { data, error } = await supabase
      .from("jobs")
      .select(listSelect(withEligibility))
      .order("created_at", { ascending: false })
      .range(0, 9999);

    if (!error) return ((data || []) as any[]).map(reshapeJobListRow) as any;
    if (!withEligibility) throw error;
    console.warn("[useJobs] Failed fetching with eligibility fields, retrying without them:", error);
  }
  return [];
}

export function useJobs(options: UseJobsOptions = {}) {
  const { enabled = true, bypassCache = false } = options;

  return useQuery({
    queryKey: bypassCache ? ["jobs", "bypass-cache"] : ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      if (bypassCache) {
        const columns = [
          "id", "slug", "title", "department", "location",
          "last_date", "last_date_display", "vacancies", "vacancies_display",
          "qualification", "eligibility", "experience",
          "salary_min", "salary_max", "age_min", "age_max",
          "application_fee", "job_metadata", "is_featured",
          "admin_refreshed_at", "created_at", "tags",
          "eligibility_summary", "required_skills"
        ].join(",");
        const { data, error } = await supabase
          .from("jobs")
          .select(columns)
          .order("created_at", { ascending: false })
          .range(0, 9999);
        if (error) throw error;
        return (data || []) as any;
      }

      const res = await fetch("/api/cache/jobs");
      // Fallback to direct Supabase if the cache endpoint fails
      if (!res.ok) return fetchJobListFromSupabase();
      return res.json();
    },
    enabled,
    // The bypassCache path pulls the whole jobs table (~14 MB) straight from
    // Supabase with no Redis in front, so a 0 stale time meant every Admin
    // remount re-downloaded all of it — a single admin session burned ~250 MB
    // of the 5 GB monthly egress budget. Freshness after an edit does not rely
    // on staleTime: Admin.tsx invalidates ["jobs"] at every mutation site, and
    // React Query matches keys by prefix, so those calls already invalidate
    // ["jobs", "bypass-cache"] and force an immediate refetch.
    staleTime: bypassCache ? 1000 * 60 * 5 : 1000 * 60 * 15,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
}

/**
 * Columns the job detail page actually renders. Deliberately omits `embedding`
 * (a vector(384) that will add ~5 KB per visitor once the embedding cron
 * backfills it), the `embedding_attempts` / `embedding_error` / `dedupe_key` /
 * `auto_discovered` bookkeeping columns, and `eligibility_summary` /
 * `required_skills` (matcher-only). Scalar columns the page does not currently
 * read are kept — they cost a few bytes and guard against a missed reference.
 */
const JOB_DETAIL_COLUMNS = [
  "id", "slug", "title", "department", "location", "description",
  "qualification", "eligibility", "experience",
  "application_fee", "apply_link", "official_website",
  "last_date", "last_date_display", "application_start_date",
  "salary_min", "salary_max", "age_min", "age_max",
  "vacancies", "vacancies_display", "is_featured",
  "created_at", "updated_at", "admin_refreshed_at", "tags",
];

/**
 * `job_metadata` sub-keys the detail page renders, mapped from their PostgREST
 * alias. Selecting these individually instead of the whole JSONB column leaves
 * `eligibility_profile` on the server — it is ~8 KB on enriched rows (about
 * half the row) and is only used by the eligibility matcher and the admin
 * editor, never by the detail page.
 */
const JOB_METADATA_ALIASES: Record<string, string> = {
  jm_salary_text: "salary_text",
  jm_age_limit_text: "age_limit_text",
  jm_application_fees: "application_fees",
  jm_important_dates: "important_dates",
  jm_notification_pdf: "notification_pdf",
  jm_overview: "overview",
  jm_selection_process: "selection_process",
  jm_vacancies_detail: "vacancies_detail",
  jm_official_website: "official_website",
};

const JOB_DETAIL_SELECT = [
  ...JOB_DETAIL_COLUMNS,
  ...Object.entries(JOB_METADATA_ALIASES).map(([alias, key]) => `${alias}:job_metadata->${key}`),
].join(",");

/**
 * Fold the flat `jm_*` aliases back into a `job_metadata` object so consumers
 * see the same shape they did under `select("*")`. Returns a null
 * `job_metadata` when every sub-key is empty, matching the previous behaviour
 * for jobs that have no scraped metadata (the detail page renders the whole
 * metadata block conditionally on it).
 */
function reshapeJobDetailRow(row: Record<string, any> | null): Job | null {
  if (!row) return null;

  const job: Record<string, any> = {};
  const meta: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    const metaKey = JOB_METADATA_ALIASES[key];
    if (metaKey) {
      if (value !== null && value !== undefined) meta[metaKey] = value;
    } else {
      job[key] = value;
    }
  }

  job.job_metadata = Object.keys(meta).length > 0 ? meta : null;
  return job as Job;
}

/** Fetch a job by slug, with UUID fallback for backward compatibility */
export function useJobBySlug(slugOrId: string) {
  return useQuery({
    queryKey: ["job", "slug", slugOrId],
    queryFn: async (): Promise<Job | null> => {
      // First try finding by slug. maybeSingle() returns null for a missing slug
      // (HTTP 200) instead of single()'s 406, so a not-found job doesn't spam the
      // console with errors — the UUID fallback / null return handles it.
      const { data: bySlug } = await (supabase.from as any)("jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("slug", slugOrId)
        .maybeSingle();

      if (bySlug) return reshapeJobDetailRow(bySlug);

      // Fallback: try by UUID (for transition period)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_REGEX.test(slugOrId)) {
        const { data: byId, error } = await (supabase.from as any)("jobs")
          .select(JOB_DETAIL_SELECT)
          .eq("id", slugOrId)
          .single();
        if (error) throw error;
        return reshapeJobDetailRow(byId);
      }

      return null;
    },
    enabled: !!slugOrId,
  });
}
