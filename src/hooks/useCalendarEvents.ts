import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useExams } from "@/hooks/useExams";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useUserCalendarEvents } from "@/hooks/useUserCalendarEvents";
import { fetchExamUpdatesForExam, ExamUpdateItem } from "@/hooks/useExamUpdates";
import { Job } from "@/types/job";
import {
  buildCalendarEvents,
  dateKey,
  CalendarEvent,
  CalendarEventType,
  ScrapedExamDates,
} from "@/lib/calendarEvents";

interface UseCalendarEventsOptions {
  filter?: CalendarEventType | "all";
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const { filter = "all" } = options;

  // Reuse existing hooks — no new bespoke queries.
  // Dates come only from what the user explicitly chose: saved jobs + tracked exams + custom dates.
  const { userExams, isLoading: examsLoading } = useExams({ includeExamCatalog: false });
  const { data: savedJobsData, isLoading: savedLoading } = useSavedJobs();
  const { userEvents, isLoading: customLoading } = useUserCalendarEvents();

  // Scraped, exam-matched important_dates for each tracked exam. Same query
  // keys as useExamUpdatesForExam (TrackedJobCard), so the cache is shared and
  // visiting My Exams or the calendar warms the other for free.
  const scrapedDates = useQueries({
    queries: userExams.map((attempt) => ({
      queryKey: ["exam-updates-for-exam", attempt.exams?.id, attempt.exams?.name],
      queryFn: () => fetchExamUpdatesForExam(attempt.exams?.id, attempt.exams?.name),
      enabled: !!(attempt.exams?.id || attempt.exams?.name),
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const out: ScrapedExamDates[] = [];
      results.forEach((result, i) => {
        const attempt = userExams[i];
        if (!attempt) return;
        const updates = (result.data ?? []) as ExamUpdateItem[];
        const dates = updates
          .slice(0, 5)
          .flatMap((u) => u.important_dates || [])
          .filter((d) => d?.event && d?.date);
        if (dates.length > 0) {
          out.push({
            attemptId: attempt.id,
            examName: attempt.exams?.name ?? "Exam",
            org: attempt.exams?.conducting_body ?? "",
            dates,
          });
        }
      });
      // Stable identity between renders: recompute only when payload changes
      return out;
    },
  });

  // De-dupe saved jobs by id so a job saved more than once is processed once.
  const jobs = useMemo(() => {
    const byId = new Map<string, Job>();
    for (const saved of savedJobsData ?? []) {
      if (saved.jobs) byId.set(saved.jobs.id, saved.jobs);
    }
    return [...byId.values()];
  }, [savedJobsData]);

  const allEvents = useMemo(
    () => buildCalendarEvents(jobs, userExams, userEvents, scrapedDates),
    [jobs, userExams, userEvents, scrapedDates]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return allEvents;
    return allEvents.filter((e) => e.type === filter);
  }, [allEvents, filter]);

  const upcoming = useMemo(() => filtered.filter((e) => !e.isPast), [filtered]);
  const past = useMemo(() => filtered.filter((e) => e.isPast), [filtered]);

  // Map of 'YYYY-MM-DD' → events[] for calendar grid dots (respects active filter).
  // Built from `upcoming`, not `filtered`, so the grid dots and the chip counts
  // both reflect only future events — otherwise a user whose tracked dates are
  // mostly in the past sees marker dots the "upcoming" counts don't explain.
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of upcoming) {
      const key = dateKey(e.date);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [upcoming]);

  return {
    allEvents,
    events: filtered,
    upcoming,
    past,
    byDate,
    isLoading: examsLoading || savedLoading || customLoading,
    totalUpcoming: upcoming.length,
  };
}
