import { describe, expect, it } from "vitest";
import { buildCalendarEvents, classifyImportantDate, CalendarEvent } from "./calendarEvents";
import type { ExamAttempt } from "@/hooks/useExams";

function makeAttempt(ai: unknown): ExamAttempt {
  return {
    id: "attempt-1",
    user_id: "u1",
    exam_id: "exam-1",
    exams: {
      id: "exam-1",
      name: "SSC CGL",
      conducting_body: "SSC",
      ai_cached_response: ai,
    },
  } as unknown as ExamAttempt;
}

function eventsOfType(events: CalendarEvent[], type: string) {
  return events.filter((e) => e.type === type);
}

describe("buildCalendarEvents — tentative dates", () => {
  it("marks month-only dates as tentative", () => {
    const events = buildCalendarEvents([], [makeAttempt({ expected_result_date: "August 2026" })]);
    expect(events).toHaveLength(1);
    expect(events[0].isTentative).toBe(true);
  });

  it("marks exact-day dates as not tentative", () => {
    const events = buildCalendarEvents([], [
      makeAttempt({ predicted_events: [{ event_type: "exam_date", predicted_date: "2026-08-15" }] }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].isTentative).toBe(false);
  });
});

describe("buildCalendarEvents — fallbacks are not additive", () => {
  it("uses predicted_events only, ignoring stale phase fields for the same type", () => {
    const events = buildCalendarEvents([], [
      makeAttempt({
        predicted_events: [{ event_type: "exam_date", predicted_date: "2026-08-12", phase: 1 }],
        phases: { phase1: { exam_date: "2026-08-20" } }, // stale copy — must not appear
      }),
    ]);
    const examDates = eventsOfType(events, "exam_date");
    expect(examDates).toHaveLength(1);
    expect(examDates[0].date.getDate()).toBe(12);
  });

  it("falls back to phase fields when predicted_events has none", () => {
    const events = buildCalendarEvents([], [
      makeAttempt({ phases: { phase1: { exam_date: "2026-08-20" } } }),
    ]);
    const examDates = eventsOfType(events, "exam_date");
    expect(examDates).toHaveLength(1);
    expect(examDates[0].date.getDate()).toBe(20);
  });
});

describe("buildCalendarEvents — scraped dates take precedence", () => {
  const scraped = [
    {
      attemptId: "attempt-1",
      examName: "SSC CGL",
      org: "SSC",
      dates: [
        { event: "Exam Date", date: "2026-09-01" },
        { event: "Last Date to Apply", date: "2026-07-20" },
      ],
    },
  ];

  it("skips AI-cache dates for types covered by scraped data", () => {
    const events = buildCalendarEvents(
      [],
      [makeAttempt({ predicted_events: [{ event_type: "exam_date", predicted_date: "2026-08-12" }] })],
      [],
      scraped
    );
    const examDates = eventsOfType(events, "exam_date");
    expect(examDates).toHaveLength(1);
    expect(examDates[0].date.getMonth()).toBe(8); // September (scraped), not August (AI)
  });

  it("keeps AI-cache dates for types the scraped data does not cover", () => {
    const events = buildCalendarEvents(
      [],
      [makeAttempt({ predicted_events: [{ event_type: "admit_card", predicted_date: "2026-08-25" }] })],
      [],
      scraped
    );
    expect(eventsOfType(events, "admit_card")).toHaveLength(1);
    expect(eventsOfType(events, "exam_date")).toHaveLength(1);
    expect(eventsOfType(events, "apply_end")).toHaveLength(1);
  });
});

describe("classifyImportantDate", () => {
  it.each([
    ["Admit Card Release Date", "admit_card"],
    ["Hall Ticket Download", "admit_card"],
    ["Answer Key Release", "answer_key"],
    ["Result Declaration Date", "result"],
    ["Merit List", "result"],
    ["Apply Online Start Date", "apply_start"],
    ["Last Date to Apply Online", "apply_end"],
    ["Registration Closing Date", "apply_end"],
    ["Last Date for Fee Payment", "apply_end"],
    ["Exam Date", "exam_date"],
    ["CBT 1 Date", "exam_date"],
  ])("maps %s → %s", (label, expected) => {
    expect(classifyImportantDate(label)).toBe(expected);
  });

  it.each([
    "Notification Date",
    "Exam City Slip Release",
    "Application Correction Window",
    "Join Telegram Channel",
  ])("skips unmappable label: %s", (label) => {
    expect(classifyImportantDate(label)).toBeNull();
  });
});
