import { useMemo } from "react";
import { useAllExamUpdates, ExamUpdateItem } from "@/hooks/useExamUpdates";
import { parseFlexibleDate } from "@/lib/examStatus";
import { dateKey } from "@/lib/calendarEvents";

/**
 * A single upcoming-exam countdown entry derived from an exam_update's
 * `important_dates`. One exam_update can yield several entries (e.g. Phase 1 /
 * Phase 2 exam dates), but we de-dupe across updates by exam name + date so the
 * wall never shows the same exam twice.
 */
export interface CountdownItem {
  /** Stable key: `${normalizedTitle}_${YYYY-MM-DD}` */
  id: string;
  update: ExamUpdateItem;
  /** The raw event label from important_dates, e.g. "Exam Date (Tier I)" */
  eventLabel: string;
  /** Parsed exam date at local midnight */
  examDate: Date;
  /** Whole days from start-of-today to the exam date (>= 0) */
  daysLeft: number;
  /** Best link to the relevant page for this date, if any */
  link: string | null;
}

// Event labels that represent an actual sit-the-exam date.
const EXAM_EVENT_RE = /\b(exam|examination|cbt|prelims?|mains?|tier|written\s*test|paper\s*[12i]*)\b/i;
// Event labels that look exam-ish but are NOT a sit-down date — exclude them.
const EXCLUDE_EVENT_RE = /\b(result|admit|hall\s*ticket|answer\s*key|application|registration|last\s*date|apply|fee|notification|cut\s*off|merit)\b/i;
// Free-text dates that aren't concrete enough to count down to.
const UNCERTAIN_DATE_RE = /\b(tbd|to\s*be\s*(announced|declared|notified)|tentative|expected|awaited|soon|likely|provisional)\b/i;
// A bare 4-digit year ("2026") parses to Jan 1 — too coarse for a countdown.
const YEAR_ONLY_RE = /^\s*\d{4}\s*$/;

/** Parse a free-text important_dates value into a concrete future-safe Date, or null. */
function parseExamDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || YEAR_ONLY_RE.test(text) || UNCERTAIN_DATE_RE.test(text)) return null;

  const parsed = parseFlexibleDate(text);
  if (!parsed) return null;

  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  // Mirror buildCalendarEvents' garbage guards.
  if (date.getFullYear() < 2000) return null;
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 5);
  if (date > maxDate) return null;

  return date;
}

function isExamEvent(eventLabel: string | undefined): boolean {
  if (!eventLabel) return false;
  if (EXCLUDE_EVENT_RE.test(eventLabel)) return false;
  return EXAM_EVENT_RE.test(eventLabel);
}

/**
 * Build the Countdown Wall feed: exam dates that are *announced but not yet
 * expired*, drawn from the cached exam_updates, sorted soonest-first.
 *
 * @param category optional exam_updates category passthrough to useAllExamUpdates
 */
export function useCountdownExams(category?: string) {
  const { data: updates, isLoading, isError, refetch } = useAllExamUpdates(category);

  const items = useMemo<CountdownItem[]>(() => {
    if (!updates?.length) return [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const byKey = new Map<string, CountdownItem>();

    for (const update of updates) {
      const dates = update.important_dates ?? [];
      for (const d of dates) {
        if (!isExamEvent(d?.event)) continue;

        const examDate = parseExamDate(d?.date);
        if (!examDate) continue;
        if (examDate < startOfToday) continue; // expired

        const daysLeft = Math.round(
          (examDate.getTime() - startOfToday.getTime()) / 86400000
        );

        const key = `${(update.title || "").toLowerCase().trim()}_${dateKey(examDate)}`;
        // Keep the freshest update for a given exam+date (updates are already
        // ordered scraped_at desc, so the first one we see wins).
        if (byKey.has(key)) continue;

        byKey.set(key, {
          id: key,
          update,
          eventLabel: d.event,
          examDate,
          daysLeft,
          link: d.link || null,
        });
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => a.examDate.getTime() - b.examDate.getTime()
    );
  }, [updates]);

  return { items, isLoading, isError, refetch };
}
