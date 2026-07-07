import { parseFlexibleDate, getExamDateText, hasDayPrecision } from "@/lib/examStatus";
import { Job } from "@/types/job";
import { ExamAttempt } from "@/hooks/useExams";
import { UserCalendarEvent } from "@/hooks/useUserCalendarEvents";

export type CalendarEventType =
  | "apply_start"
  | "apply_end"
  | "exam_date"
  | "admit_card"
  | "result"
  | "answer_key";

export interface CalendarEvent {
  id: string; // unique: `${sourceId}_${type}_${dateKey}`
  type: CalendarEventType;
  date: Date; // parsed, always a real Date (local midnight)
  title: string; // e.g. 'SSC CGL — Last Date to Apply'
  org: string; // conducting body / department
  sourceType: "job" | "exam" | "custom";
  sourceId: string; // job.id, exam_attempt.id, or user_calendar_event.id
  sourceSlug: string | null; // job.slug for navigation
  isPast: boolean; // date < today (start of day)
  daysLeft: number | null; // null if past
  // True when the raw date had no exact day ("August 2026", "expected July") —
  // Date parsing lands those on the 1st of the month, so the plotted day is a guess.
  isTentative: boolean;
}

/** Scraped important_dates for one tracked exam attempt (from exam_updates) */
export interface ScrapedExamDates {
  attemptId: string;
  examName: string;
  org: string;
  dates: { event: string; date: string }[];
}

/**
 * Map a scraped important_dates event label to a calendar event type.
 * Returns null for labels that don't correspond to a calendar type
 * (notification, fee, city slip …) — those are skipped rather than guessed.
 * Order matters: "Last Date to Apply" contains both "apply" and "date".
 */
export function classifyImportantDate(event: string): CalendarEventType | null {
  const t = (event || "").toLowerCase();
  if (!t) return null;
  if (t.includes("admit") || t.includes("hall ticket") || t.includes("call letter")) return "admit_card";
  if (t.includes("answer key") || t.includes("answer")) return "answer_key";
  if (t.includes("result") || t.includes("merit") || t.includes("score")) return "result";
  if (t.includes("apply") || t.includes("application") || t.includes("registration") || t.includes("online form")) {
    if (t.includes("start") || t.includes("begin") || t.includes("open") || t.includes("from")) return "apply_start";
    if (t.includes("last") || t.includes("end") || t.includes("clos") || t.includes("till") || t.includes("final") || t.includes("reopen")) return "apply_end";
    return null; // correction windows, fee payment, etc.
  }
  if (t.includes("last date")) return "apply_end";
  if (t.includes("city") || t.includes("slip")) return null; // city-intimation slips aren't exam days
  if (t.includes("exam") || t.includes("cbt") || t.includes("written") || t.includes("interview") || t.includes("pet") || t.includes("pst") || t.includes(" dv")) return "exam_date";
  return null;
}

export const EVENT_TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; short: string; badgeClass: string; dotClass: string }
> = {
  apply_start: {
    label: "Applications Open",
    short: "Open",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  apply_end: {
    label: "Last Date",
    short: "Last Date",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  exam_date: {
    label: "Exam",
    short: "Exam",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
  admit_card: {
    label: "Admit Card",
    short: "Admit",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  result: {
    label: "Result",
    short: "Result",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  answer_key: {
    label: "Answer Key",
    short: "Key",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
  },
};

/**
 * Trim a scraped title to end at its first 4-digit year, dropping trailing
 * action/marketing tails like ": Apply Online 25 May to 23 June" or
 * "Notification Out – get Link Here". Without this a job's exam-date row reads
 * "RSSB … Recruitment 2026 - Apply Online by 23 June — Exam Date", which looks
 * like an application deadline sitting under the Exams filter. Returns the input
 * unchanged when no year is present. (Also re-exported from useCountdownExams.)
 */
export function trimTitleToYear(title: string | null | undefined): string {
  const t = (title || "").trim();
  const m = t.match(/\b(20\d{2})\b/);
  if (!m) return t;
  return t.slice(0, (m.index ?? 0) + m[1].length).trim();
}

/** Local-timezone YYYY-MM-DD key — toISOString() would shift dates for IST users */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildCalendarEvents(
  jobs: Job[],
  examAttempts: ExamAttempt[],
  customEvents: UserCalendarEvent[] = [],
  scrapedExamDates: ScrapedExamDates[] = []
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const maxDate = new Date(startOfToday);
  maxDate.setFullYear(maxDate.getFullYear() + 5);

  const push = (
    rawDate: string | null | undefined,
    type: CalendarEventType,
    suffix: string,
    source: {
      sourceType: "job" | "exam" | "custom";
      sourceId: string;
      sourceSlug: string | null;
      label: string;
      org: string;
    },
    titleOverride?: string
  ) => {
    if (!rawDate || typeof rawDate !== "string") return;
    const parsed = parseFlexibleDate(rawDate);
    if (!parsed) return;
    const date = new Date(parsed);
    date.setHours(0, 0, 0, 0);
    // Discard garbage parses (e.g. year-only or malformed strings)
    if (date.getFullYear() < 2000 || date > maxDate) return;

    const id = `${source.sourceId}_${type}_${dateKey(date)}`;
    if (seen.has(id)) return;
    seen.add(id);

    const isPast = date < startOfToday;
    events.push({
      id,
      type,
      date,
      title: titleOverride ?? `${source.label} — ${suffix}`,
      org: source.org,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceSlug: source.sourceSlug,
      isPast,
      daysLeft: isPast
        ? null
        : Math.round((date.getTime() - startOfToday.getTime()) / 86400000),
      isTentative: !hasDayPrecision(rawDate),
    });
    return true;
  };

  // ── From profile-matched jobs ──────────────────────────
  for (const job of jobs) {
    const dates = job.job_metadata?.important_dates ?? {};
    const source = {
      sourceType: "job" as const,
      sourceId: job.id,
      sourceSlug: job.slug ?? null,
      label: trimTitleToYear(job.title),
      org: job.department,
    };

    push(dates.apply_start ?? job.application_start_date, "apply_start", "Applications Open", source);
    push(dates.apply_end ?? job.last_date, "apply_end", "Last Date to Apply", source);
    push(dates.exam_date ?? job.job_metadata?.exam_date, "exam_date", "Exam Date", source);
  }

  // ── From tracked exam attempts ─────────────────────────
  // The AI cache (ai_cached_response) stores dates in `predicted_events[]`
  // (event_type: application_open | application_close | admit_card | exam_date | result)
  // and in structured `phases.phase1/phase2`. Older caches use a few flat fields.
  // We read every variant so no date type is missed.
  const phaseSuffix = (base: string, phase?: number) =>
    phase === 1 || phase === 2 ? `${base} (Phase ${phase})` : base;

  const predicted = (
    ai: any,
    eventType: string
  ): { date: string; phase?: number }[] => {
    const list = Array.isArray(ai?.predicted_events) ? ai.predicted_events : [];
    return list
      .filter((e: any) => {
        const t = (e?.event_type ?? "").toString().toLowerCase();
        const d = e?.predicted_date;
        return (
          t === eventType &&
          typeof d === "string" &&
          d.trim() &&
          d.trim().toLowerCase() !== "null"
        );
      })
      .map((e: any) => ({
        date: e.predicted_date as string,
        phase: e?.phase === 1 || e?.phase === 2 ? e.phase : undefined,
      }));
  };

  // Scraped important_dates (exam-matched exam_updates) are the freshest source,
  // so they're processed first; any type they cover is skipped in the AI cache
  // below to avoid showing two contradictory dates for the same thing.
  const scrapedTypes = new Map<string, Set<CalendarEventType>>();
  for (const scraped of scrapedExamDates) {
    const source = {
      sourceType: "exam" as const,
      sourceId: scraped.attemptId,
      sourceSlug: null,
      label: scraped.examName,
      org: scraped.org,
    };
    for (const d of scraped.dates) {
      const type = classifyImportantDate(d.event);
      if (!type) continue;
      if (push(d.date, type, d.event.trim(), source)) {
        let covered = scrapedTypes.get(scraped.attemptId);
        if (!covered) scrapedTypes.set(scraped.attemptId, (covered = new Set()));
        covered.add(type);
      }
    }
  }

  for (const attempt of examAttempts) {
    const ai = attempt.exams?.ai_cached_response as any;
    if (!ai) continue;
    const source = {
      sourceType: "exam" as const,
      sourceId: attempt.id,
      sourceSlug: null,
      label: attempt.exams?.name ?? "Exam",
      org: attempt.exams?.conducting_body ?? "",
    };
    const covered = scrapedTypes.get(attempt.id);
    const skip = (type: CalendarEventType) => covered?.has(type) ?? false;

    // Application window — predicted events, else legacy flat field
    if (!skip("apply_start")) {
      for (const { date, phase } of predicted(ai, "application_open"))
        push(date, "apply_start", phaseSuffix("Applications Open", phase), source);
    }
    if (!skip("apply_end")) {
      const closes = predicted(ai, "application_close");
      for (const { date, phase } of closes)
        push(date, "apply_end", phaseSuffix("Last Date to Apply", phase), source);
      if (closes.length === 0)
        push(ai?.last_date_to_apply, "apply_end", "Last Date to Apply", source); // legacy flat field
    }

    // Admit cards
    if (!skip("admit_card")) {
      for (const { date, phase } of predicted(ai, "admit_card"))
        push(date, "admit_card", phaseSuffix("Admit Card", phase), source);
    }

    // Exam dates — predicted events, ELSE structured phases, ELSE resolved text.
    // These are fallbacks, not additions: the cache's shape variants often hold
    // stale copies of the same date, and pushing all of them shows contradictory
    // "Exam Date (Phase 1)" entries side by side.
    if (!skip("exam_date")) {
      const examDates = predicted(ai, "exam_date");
      for (const { date, phase } of examDates)
        push(date, "exam_date", phaseSuffix("Exam Date", phase), source);
      if (examDates.length === 0) {
        const p1 = push(ai?.phases?.phase1?.exam_date, "exam_date", "Exam Date (Phase 1)", source);
        const p2 = push(ai?.phases?.phase2?.exam_date, "exam_date", "Exam Date (Phase 2)", source);
        if (!p1 && !p2) push(getExamDateText(ai), "exam_date", "Exam Date", source);
      }
    }

    // Results — predicted events, ELSE structured/legacy phases, ELSE expected date
    if (!skip("result")) {
      const results = predicted(ai, "result");
      for (const { date, phase } of results)
        push(date, "result", phaseSuffix("Result", phase), source);
      if (results.length === 0) {
        const anyPhase =
          [
            push(ai?.phases?.phase1?.result_date, "result", "Result (Phase 1)", source),
            push(ai?.phases?.phase2?.result_date, "result", "Result (Phase 2)", source),
            push(ai?.phase_1?.result_date, "result", "Result (Phase 1)", source),
            push(ai?.phase_2?.result_date, "result", "Result (Phase 2)", source),
          ].some(Boolean);
        if (!anyPhase) push(ai?.expected_result_date, "result", "Expected Result", source);
      }
    }
  }

  // ── User-added personal dates ──────────────────────────
  for (const custom of customEvents) {
    push(
      custom.event_date,
      custom.event_type,
      "",
      {
        sourceType: "custom",
        sourceId: custom.id,
        sourceSlug: null,
        label: custom.title,
        org: custom.note?.trim() || "Added by you",
      },
      custom.title // use the user's title verbatim, no suffix
    );
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
