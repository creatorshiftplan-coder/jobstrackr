import { useMemo } from "react";
import { useExams } from "@/hooks/useExams";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useUserCalendarEvents } from "@/hooks/useUserCalendarEvents";
import { Job } from "@/types/job";
import {
  buildCalendarEvents,
  dateKey,
  CalendarEvent,
  CalendarEventType,
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

  // De-dupe saved jobs by id so a job saved more than once is processed once.
  const jobs = useMemo(() => {
    const byId = new Map<string, Job>();
    for (const saved of savedJobsData ?? []) {
      if (saved.jobs) byId.set(saved.jobs.id, saved.jobs);
    }
    return [...byId.values()];
  }, [savedJobsData]);

  const allEvents = useMemo(
    () => buildCalendarEvents(jobs, userExams, userEvents),
    [jobs, userExams, userEvents]
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
    isLoading: examsLoading || savedLoading || customLoading,
    totalUpcoming: upcoming.length,
  };
}
