import { useMemo } from "react";
import { useForYouJobs } from "@/hooks/useForYouJobs";
import { useExams } from "@/hooks/useExams";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { Job } from "@/types/job";
import {
  buildCalendarEvents,
  dateKey,
  CalendarEvent,
  CalendarEventType,
} from "@/lib/calendarEvents";

interface UseCalendarEventsOptions {
  filter?: CalendarEventType | "all";
  /** Pre-fetched jobs (e.g. from useHomepageData) to avoid a redundant Supabase call */
  initialJobs?: Job[];
  /** How many profile-matched jobs to include — keeps the calendar personal, not exhaustive */
  jobLimit?: number;
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const { filter = "all", initialJobs, jobLimit = 30 } = options;

  // Reuse existing hooks — no new bespoke queries
  const { forYouJobs, isLoading: jobsLoading } = useForYouJobs(jobLimit, true, initialJobs);
  const { userExams, isLoading: examsLoading } = useExams({ includeExamCatalog: false });
  const { data: savedJobsData, isLoading: savedLoading } = useSavedJobs();

  // Saved jobs are the primary source; for-you matched jobs enrich the schedule.
  // Merge + de-dupe by job id so a job saved AND matched is only processed once.
  const jobs = useMemo(() => {
    const byId = new Map<string, Job>();
    for (const saved of savedJobsData ?? []) {
      if (saved.jobs) byId.set(saved.jobs.id, saved.jobs);
    }
    for (const job of forYouJobs) {
      if (!byId.has(job.id)) byId.set(job.id, job);
    }
    return [...byId.values()];
  }, [savedJobsData, forYouJobs]);

  const allEvents = useMemo(
    () => buildCalendarEvents(jobs, userExams),
    [jobs, userExams]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return allEvents;
    return allEvents.filter((e) => e.type === filter);
  }, [allEvents, filter]);

  const upcoming = useMemo(() => filtered.filter((e) => !e.isPast), [filtered]);
  const past = useMemo(() => filtered.filter((e) => e.isPast), [filtered]);

  // Map of 'YYYY-MM-DD' → events[] for calendar grid dots (respects active filter)
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const key = dateKey(e.date);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [filtered]);

  return {
    allEvents,
    events: filtered,
    upcoming,
    past,
    byDate,
    isLoading: jobsLoading || examsLoading || savedLoading,
    totalUpcoming: upcoming.length,
  };
}
