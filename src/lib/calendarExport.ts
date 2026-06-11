import { CalendarEvent, dateKey } from "@/lib/calendarEvents";

/** YYYYMMDD in the event's local timezone — all-day events must not shift across timezones */
function formatICSDateValue(date: Date): string {
  return dateKey(date).replace(/-/g, "");
}

function formatICSTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escape per RFC 5545 TEXT rules */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function eventUrl(event: CalendarEvent): string {
  return event.sourceSlug
    ? `https://jobstrackr.in/jobs/${event.sourceSlug}`
    : "https://jobstrackr.in/calendar";
}

export function generateICS(events: CalendarEvent[]): string {
  const now = formatICSTimestamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JobsTrackr//ExamCalendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:JobsTrackr Exam Calendar",
    "X-WR-CALDESC:Your personalised govt exam dates",
  ];

  for (const event of events) {
    const dtStart = formatICSDateValue(event.date);
    const dtEnd = formatICSDateValue(new Date(event.date.getTime() + 86400000));

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@jobstrackr.in`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeICS(event.title)}`,
      `DESCRIPTION:${escapeICS(`${event.org}\nJobsTrackr.in`)}`,
      `URL:${eventUrl(event)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D", // 1 day reminder
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(`Tomorrow: ${event.title}`)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(events: CalendarEvent[], filename = "jobstrackr-exams.ics") {
  const ics = generateICS(events);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const start = formatICSDateValue(event.date);
  const end = formatICSDateValue(new Date(event.date.getTime() + 86400000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: `${event.org}\n\nView on JobsTrackr: ${eventUrl(event)}`,
    sf: "true",
    output: "xml",
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}
