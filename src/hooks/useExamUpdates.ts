import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  job_id: string | null;
  exam_id: string | null;
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
          return byJobId as ExamUpdateItem[];
        }
      }

      // Fallback: keyword search on title
      if (jobTitle) {
        // Extract first 3-4 meaningful keywords from job title
        const keywords = jobTitle
          .replace(/[^a-zA-Z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .slice(0, 4);

        if (keywords.length >= 2) {
          const searchPattern = `%${keywords.join("%")}%`;
          const { data: byTitle, error: err2 } = await (supabase.from as any)("exam_updates")
            .select("*")
            .ilike("title", searchPattern)
            .order("scraped_at", { ascending: false })
            .limit(20);

          if (!err2 && byTitle) {
            return byTitle as ExamUpdateItem[];
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
          return byExamId as ExamUpdateItem[];
        }
      }

      // Fallback: keyword search on exam name
      if (examName) {
        const keywords = examName
          .replace(/[^a-zA-Z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .slice(0, 4);

        if (keywords.length >= 2) {
          const searchPattern = `%${keywords.join("%")}%`;
          const { data: byName, error: err2 } = await (supabase.from as any)("exam_updates")
            .select("*")
            .ilike("title", searchPattern)
            .order("scraped_at", { ascending: false })
            .limit(20);

          if (!err2 && byName) {
            return byName as ExamUpdateItem[];
          }
        }
      }

      return [];
    },
    enabled: !!(examId || examName),
    staleTime: 5 * 60 * 1000,
  });
}
