import { parseFlexibleDate, getExamDateText } from "@/lib/examStatus";
import { Job } from "@/types/job";
import { ExamAttempt } from "@/hooks/useExams";

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
  sourceType: "job" | "exam";
  sourceId: string; // job.id or exam_attempt.id
  sourceSlug: string | null; // job.slug for navigation
  isPast: boolean; // date < today (start of day)
  daysLeft: number | null; // null if past
}

export const EVENT_TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; badgeClass: string; dotClass: string }
> = {
  apply_start: {
    label: "Applications Open",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  apply_end: {
    label: "Last Date",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  exam_date: {
    label: "Exam",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
  admit_card: {
    label: "Admit Card",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  result: {
    label: "Result",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  answer_key: {
    label: "Answer Key",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
  },
};

/** Local-timezone YYYY-MM-DD key — toISOString() would shift dates for IST users */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildCalendarEvents(
  jobs: Job[],
  examAttempts: ExamAttempt[]
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
      sourceType: "job" | "exam";
      sourceId: string;
      sourceSlug: string | null;
      label: string;
      org: string;
    }
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
      title: `${source.label} — ${suffix}`,
      org: source.org,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceSlug: source.sourceSlug,
      isPast,
      daysLeft: isPast
        ? null
        : Math.round((date.getTime() - startOfToday.getTime()) / 86400000),
    });
  };

  // ── From profile-matched jobs ──────────────────────────
  for (const job of jobs) {
    const dates = job.job_metadata?.important_dates ?? {};
    const source = {
      sourceType: "job" as const,
      sourceId: job.id,
      sourceSlug: job.slug ?? null,
      label: job.title,
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

    // Application window
    for (const { date, phase } of predicted(ai, "application_open"))
      push(date, "apply_start", phaseSuffix("Applications Open", phase), source);
    for (const { date, phase } of predicted(ai, "application_close"))
      push(date, "apply_end", phaseSuffix("Last Date to Apply", phase), source);
    push(ai?.last_date_to_apply, "apply_end", "Last Date to Apply", source); // legacy flat field

    // Admit cards
    for (const { date, phase } of predicted(ai, "admit_card"))
      push(date, "admit_card", phaseSuffix("Admit Card", phase), source);

    // Exam dates — predicted events, structured phases, then resolved text
    for (const { date, phase } of predicted(ai, "exam_date"))
      push(date, "exam_date", phaseSuffix("Exam Date", phase), source);
    push(ai?.phases?.phase1?.exam_date, "exam_date", "Exam Date (Phase 1)", source);
    push(ai?.phases?.phase2?.exam_date, "exam_date", "Exam Date (Phase 2)", source);
    push(getExamDateText(ai), "exam_date", "Exam Date", source);

    // Results — predicted events, structured phases, legacy fields, expected date
    for (const { date, phase } of predicted(ai, "result"))
      push(date, "result", phaseSuffix("Result", phase), source);
    push(ai?.phases?.phase1?.result_date, "result", "Result (Phase 1)", source);
    push(ai?.phases?.phase2?.result_date, "result", "Result (Phase 2)", source);
    push(ai?.phase_1?.result_date, "result", "Result (Phase 1)", source);
    push(ai?.phase_2?.result_date, "result", "Result (Phase 2)", source);
    push(ai?.expected_result_date, "result", "Expected Result", source);
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
