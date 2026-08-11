import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortByTitleMatch, tokenizeTitle, hasExamIdentityConflict } from "@/lib/titleMatcher";
import { isFreeJobAlertUrl } from "@/lib/urlUtils";

/**
 * Columns needed by list/card views. Deliberately omits the heavy `sections`
 * (full scraped article bodies), `overview`, and `related_articles` JSON — those
 * are only rendered on the detail page (useExamUpdateById, which keeps select("*")).
 * Fetching only these columns is the main lever for cutting Supabase PostgREST egress.
 */
const LIGHT_UPDATE_COLS =
  "id, slug, url, title, category, status, published_date, summary, important_dates, download_links, official_links, related_links, tags, scraped_at, created_at, updated_at, job_id, exam_id";

/**
 * Narrower still: the exact columns `ExamUpdatesSection` on the job detail page
 * renders. That page aggregates important dates, download links and summaries —
 * it never touches official_links, related_links, tags, status, published_date
 * or the timestamps, so shipping them is pure waste on the hottest query in the
 * app. `scraped_at` is dropped too; PostgREST can still order by it without it
 * being selected.
 *
 * This matters because only a handful of exam_updates rows have `job_id` set,
 * so nearly every job page falls through to the fuzzy title search below and
 * pays for 50 rows. Measured: 43.7 KB -> 23.2 KB per job page view.
 */
const JOB_PAGE_UPDATE_COLS =
  "id, title, url, category, summary, important_dates, download_links";

/** Clean freejobalert URLs from nested links inside updates (but keep the updates themselves) */
function filterFreeJobAlertFromUpdates(updates: ExamUpdateItem[]): ExamUpdateItem[] {
  return updates.map((u) => ({
    ...u,
    download_links: u.download_links?.filter((dl) => !isFreeJobAlertUrl(dl.url)) ?? [],
    important_dates: u.important_dates?.map((d) => ({
      ...d,
      link: isFreeJobAlertUrl(d.link) ? "" : d.link,
    })) ?? [],
    related_articles: u.related_articles?.filter((a) => !isFreeJobAlertUrl(a.url)) ?? [],
  }));
}

export interface ExamUpdateItem {
  id: string;
  slug?: string | null;
  url: string;
  title: string;
  category: string;
  status: string | null;
  published_date: string | null;
  summary: string | null;
  important_dates: { event: string; date: string; status: string; link: string }[];
  overview: { field: string; value: string }[];
  download_links: { text: string; url: string }[];
  official_links?: { text: string; url: string }[];
  related_links?: { text: string; url: string }[];
  tags: string[];
  sections: { heading: string; level: string; content: string[] }[];
  related_articles: { title: string; url: string }[];
  scraped_at: string;
  created_at: string;
  updated_at: string;
  job_id: string | null;
  exam_id: string | null;
}

/**
 * Fetch all recent exam_updates for the trending page, optionally filtered by category.
 * Uses Redis-cached API endpoint with direct Supabase fallback.
 */
export function useAllExamUpdates(category?: string) {
  return useQuery({
    queryKey: ["all-exam-updates", category],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      const params = category && category !== "all" ? `?category=${category}` : "";
      const res = await fetch(`/api/cache/exam-updates${params}`);

      if (!res.ok) {
        // Fallback to direct Supabase if cache endpoint fails
        let query = (supabase.from as any)("exam_updates")
          .select(LIGHT_UPDATE_COLS)
          .order("scraped_at", { ascending: false })
          .limit(100);

        if (category && category !== "all") {
          query = query.eq("category", category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return filterFreeJobAlertFromUpdates((data || []) as ExamUpdateItem[]);
      }

      return res.json();
    },
    staleTime: 15 * 60 * 1000, // matches the lengthened server cache TTL
  });
}

/**
 * Search the whole exam_updates table, not just the cached feed.
 *
 * `useAllExamUpdates` returns the 100 most recent rows — at current scrape
 * volume that is roughly a six-hour window, so filtering it in the browser
 * answers "ntpc" with nothing and the Updates page falls back to stale
 * tracked-exam cards. The server does the filtering here and returns matches
 * newest-first, Redis-cached per query.
 */
export function useExamUpdateSearch(query: string | undefined) {
  const q = (query || "").trim();
  // Below three characters the query matches half the table; not worth a round
  // trip, and the in-memory feed still covers it.
  const enabled = q.length >= 3;

  return useQuery({
    queryKey: ["exam-update-search", q.toLowerCase()],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      const res = await fetch(`/api/cache/search-updates?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const rows = (await res.json()) as ExamUpdateItem[];
      return Array.isArray(rows) ? rows : [];
    },
    enabled,
    staleTime: 15 * 60 * 1000, // matches the server cache TTL
    placeholderData: (prev) => prev, // keep the last results while retyping
  });
}

/**
 * Fetch a single exam_update by its UUID (for the detail page)
 */
// Matches a v4-style UUID; anything else is treated as a slug.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useExamUpdateById(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ["exam-update-by-id", idOrSlug],
    queryFn: async (): Promise<ExamUpdateItem | null> => {
      if (!idOrSlug) return null;
      // The /exam-update/:id route param may be a UUID (legacy links) or a slug
      // (links the Sheets poster builds from the title). Resolve either.
      const column = UUID_RE.test(idOrSlug) ? "id" : "slug";
      const { data, error } = await (supabase.from as any)("exam_updates")
        .select("*")
        .eq(column, idOrSlug)
        .single();
      if (error) throw error;
      if (!data) return null;
      const [filtered] = filterFreeJobAlertFromUpdates([data as ExamUpdateItem]);
      return filtered;
    },
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch exam_updates linked to a specific job (by job_id or title keyword fallback)
 */
export function useExamUpdatesForJob(jobId: string | undefined, jobTitle: string | undefined) {
  return useQuery({
    queryKey: ["exam-updates-for-job", jobId, jobTitle],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      // First try direct job_id link
      if (jobId) {
        const { data: byJobId, error: err1 } = await (supabase.from as any)("exam_updates")
          .select(JOB_PAGE_UPDATE_COLS)
          .eq("job_id", jobId)
          .order("scraped_at", { ascending: false })
          .limit(20);

        if (!err1 && byJobId && byJobId.length > 0) {
          return filterFreeJobAlertFromUpdates(byJobId as ExamUpdateItem[]);
        }
      }

      // Fallback: fuzzy keyword search on title
      if (jobTitle) {
        const keywords = tokenizeTitle(jobTitle)
          .filter((w) => w.length > 2)
          .slice(0, 6);

        if (keywords.length > 0) {
          const orQuery = keywords.map((keyword) => `title.ilike.%${keyword}%`).join(",");
          const { data: byTitle, error: err2 } = await (supabase.from as any)("exam_updates")
            .select(JOB_PAGE_UPDATE_COLS)
            .or(orQuery)
            .order("scraped_at", { ascending: false })
            .limit(50);

          if (!err2 && byTitle) {
            return filterFreeJobAlertFromUpdates(
              sortByTitleMatch(jobTitle, byTitle as ExamUpdateItem[], (update) => update.title).slice(0, 20)
            );
          }
        }
      }

      return [];
    },
    enabled: !!(jobId || jobTitle),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch exam_updates linked to a tracked exam (by exam_id or exam name keyword fallback).
 * Exported so other hooks (e.g. the exam calendar) can share the same query
 * cache — always pair it with the ["exam-updates-for-exam", examId, examName] key.
 */
export async function fetchExamUpdatesForExam(
  examId: string | undefined,
  examName: string | undefined
): Promise<ExamUpdateItem[]> {
      // First try direct exam_id link
      if (examId) {
        const { data: byExamId, error: err1 } = await (supabase.from as any)("exam_updates")
          .select(LIGHT_UPDATE_COLS)
          .eq("exam_id", examId)
          .order("scraped_at", { ascending: false })
          .limit(20);

        if (!err1 && byExamId && byExamId.length > 0) {
          return filterFreeJobAlertFromUpdates(byExamId as ExamUpdateItem[]);
        }
      }

      // Fallback: fuzzy keyword search on exam name.
      // Precision matters more than recall here — these results render as the
      // exam's own Important Dates / Quick Links / Latest Updates, so a wrong
      // match pollutes the whole card. Candidates that name a different exam
      // identity (org, tier, state, force) are rejected before scoring.
      if (examName) {
        const keywords = tokenizeTitle(examName)
          .filter((w) => w.length > 2)
          .slice(0, 8);

        if (keywords.length > 0) {
          const orQuery = keywords.map((keyword) => `title.ilike.%${keyword}%`).join(",");
          const { data: byName, error: err2 } = await (supabase.from as any)("exam_updates")
            .select(LIGHT_UPDATE_COLS)
            .or(orQuery)
            .order("scraped_at", { ascending: false })
            .limit(50);

          if (!err2 && byName && byName.length > 0) {
            const sameExam = (byName as ExamUpdateItem[]).filter(
              (update) => !hasExamIdentityConflict(examName, update.title)
            );
            const matched = sortByTitleMatch(examName, sameExam, (update) => update.title).slice(0, 20);
            if (matched.length > 0) return filterFreeJobAlertFromUpdates(matched);
          }
        }
      }

      return [];
}

/**
 * Fetch exam_updates linked to a tracked exam (by exam_id or exam name keyword fallback)
 */
export function useExamUpdatesForExam(examId: string | undefined, examName: string | undefined) {
  return useQuery({
    queryKey: ["exam-updates-for-exam", examId, examName],
    queryFn: () => fetchExamUpdatesForExam(examId, examName),
    enabled: !!(examId || examName),
    staleTime: 5 * 60 * 1000,
  });
}
