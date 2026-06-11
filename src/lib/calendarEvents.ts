import { parseFlexibleDate, getExamDateText } from "@/lib/examStatus";
import { Job } from "@/types/job";
import { ExamAttempt } from "@/hooks/useExams";
import { ExamUpdateItem } from "@/hooks/useExamUpdates";

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

/** Local midnight of the given (or current) date */
export function startOfDay(d: Date = new Date()): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Map snake_case event_type keys (from ai_cached_response.predicted_events) to calendar types. */
function inferEventTypeFromKey(eventType: string): CalendarEventType {
  const t = eventType.toLowerCase().replace(/[-\s]+/g, "_");
  if (t.includes("admit") || t.includes("hall_ticket") || t.includes("call_letter")) return "admit_card";
  if (t.includes("result") || t.includes("merit") || t.includes("cutoff") || t.includes("cut_off")) return "result";
  if (t.includes("answer") || t.includes("response_sheet")) return "answer_key";
  if (
    t.includes("last_date") ||
    t.includes("apply_end") ||
    t.includes("apply_online_end") ||
    t.includes("application_end") ||
    t.includes("registration_end") ||
    t.includes("deadline")
  ) {
    return "apply_end";
  }
  if (
    t.includes("notification") ||
    t.includes("apply_start") ||
    t.includes("apply_online_start") ||
    t.includes("application_start") ||
    t.includes("registration_start") ||
    t.includes("publish")
  ) {
    return "apply_start";
  }
  return "exam_date";
}

function inferEventTypeFromEventName(event: string): CalendarEventType {
  const t = event.toLowerCase();
  if (t.includes("admit") || t.includes("hall ticket") || t.includes("call letter")) {
    return "admit_card";
  }
  if (t.includes("result") || t.includes("score") || t.includes("merit") || t.includes("cutoff") || t.includes("cut-off")) {
    return "result";
  }
  if (t.includes("answer") || t.includes("key") || t.includes("response")) {
    return "answer_key";
  }
  if (t.includes("exam") || t.includes("written") || t.includes("cbt") || t.includes("test") || t.includes("schedule")) {
    return "exam_date";
  }
  if (t.includes("apply start") || t.includes("applications open") || t.includes("apply online start") || t.includes("start date")) {
    return "apply_start";
  }
  if (t.includes("apply") || t.includes("last date") || t.includes("deadline") || t.includes("registration") || t.includes("end date")) {
    return "apply_end";
  }
  return "exam_date";
}

export function buildCalendarEvents(
  jobs: Job[],
  savedJobs: Job[],
  examAttempts: ExamAttempt[],
  relatedUpdates: ExamUpdateItem[],
  /** Injectable for midnight-rollover refresh and tests */
  today: Date = new Date()
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  const startOfToday = startOfDay(today);
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

  // Deduplicate matched jobs and saved jobs
  const jobsMap = new Map<string, Job>();
  for (const j of jobs) {
    if (j?.id) jobsMap.set(j.id, j);
  }
  for (const j of savedJobs) {
    if (j?.id) jobsMap.set(j.id, j);
  }
  const allJobs = Array.from(jobsMap.values());

  // ── From user custom dates on exam attempts (HIGHEST priority) ─────
  for (const attempt of examAttempts) {
    const custom = attempt.custom_dates as Record<string, string | null> | null;
    if (!custom) continue;
    const source = {
      sourceType: "exam" as const,
      sourceId: attempt.id,
      sourceSlug: null,
      label: attempt.exams?.name ?? "Exam",
      org: attempt.exams?.conducting_body ?? "",
    };

    push(custom.notification_date, "apply_start", "Notification Date (My Date)", source);
    push(custom.apply_start, "apply_start", "Applications Open (My Date)", source);
    push(custom.apply_end, "apply_end", "Last Date to Apply (My Date)", source);
    push(custom.exam_date, "exam_date", "Exam Date (My Date)", source);
    push(custom.admit_card, "admit_card", "Admit Card (My Date)", source);
    push(custom.result, "result", "Result (My Date)", source);
    push(custom.answer_key, "answer_key", "Answer Key (My Date)", source);
  }

  // ── From profile-matched and saved jobs ────────────────
  for (const job of allJobs) {
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
    push(dates.admit_card, "admit_card", "Admit Card", source);
    push(dates.result, "result", "Result", source);
    push(dates.answer_key, "answer_key", "Answer Key", source);
    push(dates.notification_date ?? dates.advertised_on, "apply_start", "Notification Out", source);
  }

  // ── From tracked exam attempts ─────────────────────────
  for (const attempt of examAttempts) {
    const ai = attempt.exams?.ai_cached_response;
    if (!ai) continue;
    const source = {
      sourceType: "exam" as const,
      sourceId: attempt.id,
      sourceSlug: null,
      label: attempt.exams?.name ?? "Exam",
      org: attempt.exams?.conducting_body ?? "",
    };

    // Main exam date — reuses the same resolution logic as exam status badges
    push(getExamDateText(ai), "exam_date", "Exam Date", source);

    // Phased exams (both naming variants seen in ai_cached_response)
    push(ai?.phases?.phase1?.exam_date ?? ai?.phase_1?.exam_date, "exam_date", "Exam (Phase 1)", source);
    push(ai?.phases?.phase2?.exam_date ?? ai?.phase_2?.exam_date, "exam_date", "Exam (Phase 2)", source);

    push(ai?.admit_card_date ?? ai?.admit_card_release, "admit_card", "Admit Card", source);
    push(ai?.result_date ?? ai?.result_release, "result", "Result", source);
    push(ai?.answer_key_date, "answer_key", "Answer Key", source);
    push(ai?.last_date_to_apply, "apply_end", "Last Date to Apply", source);
    push(ai?.application_start_date ?? ai?.apply_start ?? ai?.apply_online_start, "apply_start", "Applications Open", source);
    push(ai?.notification_date ?? ai?.published_date, "apply_start", "Notification Out", source);

    // Canonical AI schema stores upcoming dates in predicted_events; without this
    // loop the admit-card / result / answer-key / apply-window dates are dropped.
    const predictedEvents = Array.isArray(ai?.predicted_events) ? ai.predicted_events : [];
    for (const ev of predictedEvents) {
      const evType: string = ev?.event_type ?? "";
      const evDate: string = ev?.predicted_date ?? ev?.date ?? "";
      if (!evDate || evDate === "TBD") continue;
      const type = inferEventTypeFromKey(evType);
      const labelText =
        ev?.event_label ||
        (evType ? evType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Date");
      push(evDate, type, labelText, source);
    }
  }

  // ── From related updates ───────────────────────────────
  for (const update of relatedUpdates) {
    // 1. Resolve source details (name/conducting body/id/type) from related exam or job
    let label = update.title;
    let org = "";
    let sourceId = update.id;
    let sourceType: "exam" | "job" = "exam";
    let sourceSlug: string | null = null;

    if (update.exam_id) {
      const attempt = examAttempts.find((a) => a.exam_id === update.exam_id);
      if (attempt) {
        label = attempt.exams?.name ?? label;
        org = attempt.exams?.conducting_body ?? org;
        sourceId = attempt.id;
        sourceType = "exam";
      }
    } else if (update.job_id) {
      const job = allJobs.find((j) => j.id === update.job_id);
      if (job) {
        label = job.title;
        org = job.department;
        sourceId = job.id;
        sourceType = "job";
        sourceSlug = job.slug ?? null;
      }
    }

    const source = { sourceType, sourceId, sourceSlug, label, org };

    // 2. Parse dates from important_dates list
    let hasParsedDates = false;
    if (update.important_dates && Array.isArray(update.important_dates)) {
      for (const d of update.important_dates) {
        if (d.date && d.date !== "TBD") {
          const type = inferEventTypeFromEventName(d.event);
          push(d.date, type, d.event, source);
          hasParsedDates = true;
        }
      }
    }

    // 3. Fallback: if no structured dates were parsed, use published_date/scraped_at
    if (!hasParsedDates) {
      const fallbackDate = update.published_date || update.scraped_at;
      if (fallbackDate) {
        let type: CalendarEventType = "exam_date";
        let suffix = "New Update";
        const cat = update.category?.toLowerCase() || "";

        if (cat.includes("admit") || cat.includes("hall")) {
          type = "admit_card";
          suffix = "Admit Card Released";
        } else if (cat.includes("result") || cat.includes("merit")) {
          type = "result";
          suffix = "Result Declared";
        } else if (cat.includes("answer") || cat.includes("key")) {
          type = "answer_key";
          suffix = "Answer Key Available";
        } else if (cat.includes("apply") || cat.includes("recruit")) {
          type = "apply_end";
          suffix = "Last Date to Apply";
        }

        push(fallbackDate, type, suffix, source);
      }
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
