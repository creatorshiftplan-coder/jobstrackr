import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExamUpdateItem } from "@/hooks/useExamUpdates";
import { useJobs } from "@/hooks/useJobs";
import { Job } from "@/types/job";
import { dateKey, trimTitleToYear } from "@/lib/calendarEvents";

export type CountdownSource = "exam_update" | "job";

/**
 * A single upcoming-exam countdown entry. Source-agnostic: it can come from an
 * exam_update (`important_dates`) or a job posting (`job_metadata.exam_date`).
 * De-duped across sources by title + date so the wall never shows a duplicate.
 */
export interface CountdownItem {
  /** Stable dedupe key: `${normalizedTitle}_${YYYY-MM-DD}` */
  id: string;
  /** Exam / posting title shown on the card */
  title: string;
  /** Where this date came from — drives bookmarking + link target */
  sourceType: CountdownSource;
  /** Underlying row id (exam_update.id or job.id) — used for bookmarking */
  sourceId: string;
  /** Slug for share URLs, if any */
  slug: string | null;
  /** In-app navigation target for the card */
  href: string;
  /** The raw event label, e.g. "Exam Date (Tier I)" */
  eventLabel: string;
  /** Parsed exam date at local midnight */
  examDate: Date;
  /** Whole days from start-of-today to the exam date (>= 0) */
  daysLeft: number;
  /** External link to the relevant page for this date, if any */
  link: string | null;
}

// Event labels that represent an actual sit-the-exam date.
const EXAM_EVENT_RE = /\b(exam|examination|cbt|prelims?|mains?|tier|written\s*test|paper\s*[12i]*)\b/i;
// Event labels that look exam-ish but are NOT a sit-down date — exclude them.
const EXCLUDE_EVENT_RE =
  /\b(result|admit|hall\s*ticket|answer\s*key|application|registration|last\s*date|apply|fee|notification|cut\s*off|merit|scorecard|intimation|slip|interview|name)\b/i;
// Free-text dates that aren't concrete enough to count down to.
const UNCERTAIN_DATE_RE =
  /\b(tbd|to\s*be\s*(announced|declared|notified)|tentative|expected|awaited|soon|likely|provisional|monitor|communicated|click\s*here|login|relevant|official\s*website)\b/i;
// A bare 4-digit year ("2026") parses to Jan 1 — too coarse for a countdown.
const YEAR_ONLY_RE = /^\s*\d{4}\s*$/;

// Article categories that summarise a *past* or non-schedulable event. A
// countdown built from one of these shows the article's own title — e.g.
// "RRB NTPC CBT 1 Result 2026" — over an exam date scraped from its body (often
// a tentative next-phase date), which reads as a mismatch. Upcoming exams always
// have their own notification / admit-card / news article carrying the date with
// a correct title, so dropping these categories loses no genuine countdown.
const NON_COUNTDOWN_CATEGORIES = new Set([
  "result",
  "cutoff",
  "answer_key",
  "answerkey",
  "syllabus",
]);

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
function monthIndex(name: string): number | null {
  const k = name.slice(0, 3).toLowerCase();
  return k in MONTHS ? MONTHS[k] : null;
}

/**
 * Parse the free-text date strings found in exam_updates.important_dates into a
 * concrete Date. Govt sources write dates many ways — ISO, Indian DD/MM/YYYY,
 * "27 July 2026", "1st week of July 2026", "25th to 27th April 2026" — and the
 * native Date parser chokes on most of them, so we handle the common shapes
 * explicitly before falling back. Returns local-midnight Date, or null.
 */
function parseExamDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || YEAR_ONLY_RE.test(s) || UNCERTAIN_DATE_RE.test(s)) return null;

  let date: Date | null = null;
  let m: RegExpMatchArray | null;

  // ISO YYYY-MM-DD
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    date = new Date(+m[1], +m[2] - 1, +m[3]);
  }
  // Indian DD/MM/YYYY or DD-MM-YYYY (day first)
  else if ((m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    const dd = +m[1];
    const mm = +m[2];
    let yy = +m[3];
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) date = new Date(yy, mm - 1, dd);
  }
  // "1st week of July 2026" → ~ (week-1)*7 + 1
  else if ((m = s.match(/(\d)(?:st|nd|rd|th)?\s*week\s*(?:of\s*)?([A-Za-z]+)[, ]+(\d{4})/i))) {
    const mi = monthIndex(m[2]);
    if (mi != null) date = new Date(+m[3], mi, (+m[1] - 1) * 7 + 1);
  }
  // "25th to 27th April 2026" / "6th, 7th & 14th December 2025" → first day listed
  else if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?(?:[^A-Za-z0-9]+\d{1,2}(?:st|nd|rd|th)?)*[^A-Za-z0-9]+([A-Za-z]+)[, ]+(\d{4})/))) {
    const mi = monthIndex(m[2]);
    if (mi != null) date = new Date(+m[3], mi, +m[1]);
  }
  // "July 27, 2026" (month first)
  else if ((m = s.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[, ]+(\d{4})/))) {
    const mi = monthIndex(m[1]);
    if (mi != null) date = new Date(+m[3], mi, +m[2]);
  }
  // "April 2026" (month + year only) → 1st of month
  else if ((m = s.match(/\b([A-Za-z]+)[, ]+(\d{4})\b/))) {
    const mi = monthIndex(m[1]);
    if (mi != null) date = new Date(+m[2], mi, 1);
  }
  // Last resort: native parser (handles a few remaining shapes)
  else {
    const d = new Date(s);
    if (!isNaN(d.getTime())) date = d;
  }

  if (!date || isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);

  // Garbage guards (mirror buildCalendarEvents).
  if (date.getFullYear() < 2000) return null;
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 5);
  if (date > maxDate) return null;

  return date;
}

function isExamEvent(eventLabel: string | undefined): boolean {
  if (!eventLabel) return false;
  if (EXCLUDE_EVENT_RE.test(eventLabel)) return false;
  // A label like "CBT 2 Tentative Date" names an exam but isn't a firm date —
  // never count down to a tentative / expected / provisional sitting.
  if (UNCERTAIN_DATE_RE.test(eventLabel)) return false;
  return EXAM_EVENT_RE.test(eventLabel);
}

// Trim a title to end at its first 4-digit year (drops ": register Online",
// "Notification Out", etc.). Defined in calendarEvents so both the countdown
// wall and the calendar share one implementation; re-exported here to preserve
// the existing `@/hooks/useCountdownExams` import path used across the app.
export { trimTitleToYear };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Extract the upcoming (announced, not-yet-expired) exam-date countdown items
 * from a single exam_update, soonest-first. Shared by the wall hook and the
 * /countdown/:slug share page.
 */
export function examUpdateToCountdownItems(update: ExamUpdateItem): CountdownItem[] {
  const today = startOfToday();
  const out: CountdownItem[] = [];

  // Result / cutoff / answer-key / syllabus articles are about exams already
  // sat — skip them wholesale so their titles never head an "upcoming" card.
  if (NON_COUNTDOWN_CATEGORIES.has((update.category || "").trim().toLowerCase())) {
    return out;
  }

  for (const d of update.important_dates ?? []) {
    if (!isExamEvent(d?.event)) continue;
    const examDate = parseExamDate(d?.date);
    if (!examDate || examDate < today) continue;

    const slug = update.slug || null;
    const title = trimTitleToYear(update.title);
    out.push({
      id: `${title.toLowerCase()}_${dateKey(examDate)}`,
      title,
      sourceType: "exam_update",
      sourceId: update.id,
      slug,
      href: `/exam-update/${slug || update.id}`,
      eventLabel: d.event,
      examDate,
      daysLeft: daysBetween(today, examDate),
      link: d.link || null,
    });
  }
  return out.sort((a, b) => a.examDate.getTime() - b.examDate.getTime());
}

/**
 * Extract an upcoming exam-date countdown from a job posting. Job exam dates
 * live at `job_metadata.exam_date` (and sometimes `important_dates.exam_date`),
 * both of which survive the /api/cache/jobs payload — so this needs no extra
 * fetching. Returns at most one item (a job has a single exam date).
 */
export function jobToCountdownItems(job: Job): CountdownItem[] {
  const raw =
    job.job_metadata?.important_dates?.exam_date ?? job.job_metadata?.exam_date ?? null;
  const examDate = parseExamDate(raw);
  if (!examDate) return [];

  const today = startOfToday();
  if (examDate < today) return [];

  const slug = job.slug || null;
  const title = trimTitleToYear(job.title);
  return [
    {
      id: `${title.toLowerCase()}_${dateKey(examDate)}`,
      title,
      sourceType: "job",
      sourceId: job.id,
      slug,
      href: slug ? `/jobs/${slug}` : `/job/${job.id}`,
      eventLabel: "Exam Date",
      examDate,
      daysLeft: daysBetween(today, examDate),
      link: null,
    },
  ];
}

// Light columns — the wall/cards never render the heavy section bodies.
const LIGHT_COLS =
  "id, slug, url, title, category, status, published_date, summary, important_dates, download_links, tags, scraped_at, created_at, updated_at, job_id, exam_id";

/**
 * Fetch the wide exam_updates set the countdown wall needs. The shared
 * /api/cache/exam-updates endpoint only returns the 100 most-recently-scraped
 * rows (mostly results/admit cards = past exams), so upcoming-exam notifications
 * get pushed out of view. This dedicated, Redis-cached key returns a far wider
 * window so future exam dates actually surface.
 */
function useCountdownUpdates() {
  return useQuery({
    queryKey: ["exam-countdown-updates"],
    queryFn: async (): Promise<ExamUpdateItem[]> => {
      // Try the cached endpoint, but only trust an actual JSON response — in
      // some environments an unknown /api path falls through to the SPA and
      // returns HTML with a 200, which must NOT be treated as data.
      try {
        const res = await fetch("/api/cache/exam-countdown");
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          return (await res.json()) as ExamUpdateItem[];
        }
      } catch {
        // ignore — fall through to direct Supabase
      }

      // Fallback: direct Supabase (also covers pre-deploy / dev without proxy).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("exam_updates")
        .select(LIGHT_COLS)
        .order("scraped_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as ExamUpdateItem[];
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Build the Countdown Wall feed: upcoming, not-yet-expired exam dates merged
 * from exam_updates AND job postings, de-duped by title+date, soonest-first.
 */
export function useCountdownExams() {
  const updatesQuery = useCountdownUpdates();
  const jobsQuery = useJobs();

  const items = useMemo<CountdownItem[]>(() => {
    const byKey = new Map<string, CountdownItem>();

    // exam_updates first — they carry the richer event labels (Tier I, etc.),
    // so when a job and an update describe the same exam, the update wins.
    for (const update of updatesQuery.data ?? []) {
      for (const item of examUpdateToCountdownItems(update)) {
        if (!byKey.has(item.id)) byKey.set(item.id, item);
      }
    }
    for (const job of jobsQuery.data ?? []) {
      for (const item of jobToCountdownItems(job)) {
        if (!byKey.has(item.id)) byKey.set(item.id, item);
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => a.examDate.getTime() - b.examDate.getTime()
    );
  }, [updatesQuery.data, jobsQuery.data]);

  return {
    items,
    // Show skeletons only while both are loading; render as soon as either lands.
    isLoading: updatesQuery.isLoading && jobsQuery.isLoading,
    isError: updatesQuery.isError && jobsQuery.isError,
    refetch: () => {
      updatesQuery.refetch();
      jobsQuery.refetch();
    },
  };
}
