import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortByTitleMatch, tokenizeTitle } from "@/lib/titleMatcher";
import { isFreeJobAlertUrl } from "@/lib/urlUtils";

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
  url: string;
  title: string;
  category: string;
  status: string | null;
  published_date: string | null;
  summary: string | null;
  important_dates: { event: string; date: string; status: string; link: string }[];
  overview: { field: string; value: string }[];
  download_links: { text: string; url: string }[];
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
 * Fetch all recent exam_updates for the trending page, optionally filtered by category
 */
export function useAllExamUpdates(category?: string) {
  return useQuery({
    queryKey: ["all-exam-updates", category],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      let query = (supabase.from as any)("exam_updates")
        .select("*")
        .order("scraped_at", { ascending: false })
        .limit(100);

      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return filterFreeJobAlertFromUpdates((data || []) as ExamUpdateItem[]);
    },
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
          .select("*")
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
            .select("*")
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
 * Fetch exam_updates linked to a tracked exam (by exam_id or exam name keyword fallback)
 */
export function useExamUpdatesForExam(examId: string | undefined, examName: string | undefined) {
  return useQuery({
    queryKey: ["exam-updates-for-exam", examId, examName],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      // First try direct exam_id link
      if (examId) {
        const { data: byExamId, error: err1 } = await (supabase.from as any)("exam_updates")
          .select("*")
          .eq("exam_id", examId)
          .order("scraped_at", { ascending: false })
          .limit(20);

        if (!err1 && byExamId && byExamId.length > 0) {
          return filterFreeJobAlertFromUpdates(byExamId as ExamUpdateItem[]);
        }
      }

      // Fallback: fuzzy keyword search on exam name
      if (examName) {
        const keywords = tokenizeTitle(examName)
          .filter((w) => w.length > 2)
          .slice(0, 8);

        if (keywords.length > 0) {
          const orQuery = keywords.map((keyword) => `title.ilike.%${keyword}%`).join(",");
          const { data: byName, error: err2 } = await (supabase.from as any)("exam_updates")
            .select("*")
            .or(orQuery)
            .order("scraped_at", { ascending: false })
            .limit(50);

          if (!err2 && byName && byName.length > 0) {
            const matched = sortByTitleMatch(examName, byName as ExamUpdateItem[], (update) => update.title, 30).slice(0, 20);
            if (matched.length > 0) return filterFreeJobAlertFromUpdates(matched);
          }

          // Secondary fallback: use only first 3 core tokens for broader matching
          const coreKeywords = keywords.slice(0, 3);
          if (coreKeywords.length > 0) {
            const coreOrQuery = coreKeywords.map((keyword) => `title.ilike.%${keyword}%`).join(",");
            const { data: byCore, error: err3 } = await (supabase.from as any)("exam_updates")
              .select("*")
              .or(coreOrQuery)
              .order("scraped_at", { ascending: false })
              .limit(50);

            if (!err3 && byCore && byCore.length > 0) {
              return filterFreeJobAlertFromUpdates(
                sortByTitleMatch(examName, byCore as ExamUpdateItem[], (update) => update.title, 25).slice(0, 20)
              );
            }
          }
        }
      }

      return [];
    },
    enabled: !!(examId || examName),
    staleTime: 5 * 60 * 1000,
  });
}
