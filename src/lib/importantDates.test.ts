import { describe, it, expect } from "vitest";
import {
  normalizeImportantDates,
  firstImportantDate,
  splitDateNote,
  normalizeDateMap,
  normalizeOverviewRows,
  partitionImportantDates,
} from "./importantDates";
import { isBlockedUrl } from "./urlUtils";

describe("normalizeImportantDates", () => {
  it("drops the scraped table's own header row", () => {
    const rows = normalizeImportantDates([
      { event: "Event", date: "Date" },
      { event: "Notification Date", date: "10/07/2026" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe("Notification Date");
  });

  it("drops other header shapes, with or without trailing punctuation", () => {
    // Every variant here appears verbatim in the live feed.
    const rows = normalizeImportantDates([
      { event: "Particulars", date: "Details" },
      { event: "S. No.", date: "Post Name" },
      { event: "Events:", date: "Dates:" },
      { event: "Event", date: "Date / Time" },
      { event: "Event", date: "Date and Time" },
      { event: "Event", date: "Date & Time" },
      { event: "Activity", date: "Date" },
      { event: "Item", date: "Details" },
    ]);
    expect(rows).toEqual([]);
  });

  it("keeps a real row whose event happens to read like a header", () => {
    // Only a row where BOTH cells are headings is a header row.
    const rows = normalizeImportantDates([{ event: "Last Date", date: "09/08/2026" }]);
    expect(rows).toHaveLength(1);
  });

  it("drops link rows scraped into the dates table", () => {
    // The scraper rephrases call-to-action text, so "Download" arrives as
    // "obtain" / "collect" / "access" / "visit" too.
    const rows = normalizeImportantDates([
      { event: "Official Website", date: "Click here", link: "https://cmti.res.in/" },
      { event: "Notification", date: "Click Here" },
      { event: "Apply Online", date: "Download" },
      { event: "Official Portal", date: "Visit Portal" },
      { event: "Hall Ticket", date: "obtain Here" },
      { event: "Scorecard", date: "collect PDF" },
      { event: "Answer Key", date: "Access Link" },
      { event: "Document", date: "Action" },
      { event: "Exam Date", date: "28 July 2026" },
    ]);
    expect(rows.map((r) => r.event)).toEqual(["Exam Date"]);
  });

  it("does not mistake a real date for a link label", () => {
    const rows = normalizeImportantDates([
      { event: "Admit Card", date: "Available from 12 August 2026" },
      { event: "Result", date: "Download starts 20 August 2026" },
    ]);
    expect(rows).toHaveLength(2);
  });

  it("drops source-site promo rows", () => {
    const rows = normalizeImportantDates([
      { event: "Join Arattai Channel", date: "05/08/2026" },
      { event: "Sarkari Result", date: "05/08/2026" },
      { event: "Join our Telegram", date: "05/08/2026" },
      { event: "Result Date", date: "05/08/2026" },
    ]);
    expect(rows.map((r) => r.event)).toEqual(["Result Date"]);
  });

  it("does not mistake application rows for the source site's app promo", () => {
    const rows = normalizeImportantDates([
      { event: "Download Application Form", date: "12 August 2026" },
      { event: "Application Start", date: "06 August 2026" },
      { event: "Get Appointment Letter", date: "20 August 2026" },
    ]);
    expect(rows).toHaveLength(3);
  });

  it("drops article-summary rows scraped in place of a schedule", () => {
    // Real shape, from RRB NTPC Graduate CBT 1 Cut Off 2026.
    const rows = normalizeImportantDates([
      { event: "Item", date: "Details" },
      { event: "Article Title", date: "RRB NTPC Graduate CBT 1 Cut Off 2026 (CEN 06/2025)" },
      { event: "Official Portal", date: "indianrailways.gov.in", link: "https://indianrailways.gov.in" },
      { event: "Cut Off Release Date", date: "11 June 2026" },
      { event: "Minimum Qualifying Marks", date: "UR/EWS: 40%; OBC/SC: 30%; ST: 25%" },
    ]);
    expect(rows.map((r) => r.event)).toEqual(["Cut Off Release Date", "Minimum Qualifying Marks"]);
  });

  it("keeps a website row whose value is not a URL", () => {
    const rows = normalizeImportantDates([
      { event: "Official Website", date: "Opens 12 August 2026" },
    ]);
    expect(rows).toHaveLength(1);
  });

  it("drops rows missing an event or a date", () => {
    expect(
      normalizeImportantDates([
        { event: "", date: "05/08/2026" },
        { event: "Exam Date", date: "   " },
        { event: null, date: null },
      ]),
    ).toEqual([]);
  });

  it("collapses whitespace and dedupes repeated rows", () => {
    const rows = normalizeImportantDates([
      { event: "Exam  Date", date: "28 July\n2026" },
      { event: "Exam Date", date: "28 July 2026" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "Exam Date", date: "28 July 2026" });
  });

  it("preserves source order", () => {
    const rows = normalizeImportantDates([
      { event: "Event", date: "Date" },
      { event: "Start", date: "01/07/2026" },
      { event: "End", date: "31/07/2026" },
    ]);
    expect(rows.map((r) => r.event)).toEqual(["Start", "End"]);
  });

  it("returns an empty array for null / non-array input", () => {
    expect(normalizeImportantDates(null)).toEqual([]);
    expect(normalizeImportantDates(undefined)).toEqual([]);
    expect(normalizeImportantDates({} as never)).toEqual([]);
  });

  it("carries status and link through untouched", () => {
    const [row] = normalizeImportantDates([
      { event: "Result", date: "05/08/2026", status: "Out", link: "https://x.gov.in/r.pdf" },
    ]);
    expect(row.status).toBe("Out");
    expect(row.link).toBe("https://x.gov.in/r.pdf");
  });
});

describe("blocked destinations", () => {
  it("drops a WhatsApp/Telegram row however innocuous its label is", () => {
    // The promo wording rule only catches rows that announce themselves. These
    // do not, so the URL is the only signal.
    const rows = normalizeImportantDates([
      { event: "Result Link", date: "Click Here", link: "https://t.me/somechannel" },
      { event: "Notification", date: "Click Here", link: "https://chat.whatsapp.com/xyz" },
      { event: "Admit Card", date: "Click Here", link: "https://wa.me/919999999999" },
      { event: "Updates", date: "Click Here", link: "tg://resolve?domain=x" },
      { event: "Exam Date", date: "28 July 2026" },
    ]);
    expect(rows.map((r) => r.event)).toEqual(["Exam Date"]);
  });

  it("drops the row when the value itself is a channel URL", () => {
    const rows = normalizeImportantDates([
      { event: "Result Date", date: "https://t.me/examalerts" },
      { event: "Admit Card", date: "https://whatsapp.com/channel/abc" },
    ]);
    expect(rows).toEqual([]);
  });

  it("drops a channel row even when it carries a date", () => {
    // Deliberate: a channel invite is never an exam date, so this is the one
    // case where the date-signal veto does not apply.
    const rows = normalizeImportantDates([
      { event: "Result Date", date: "12 August 2026", link: "https://t.me/examalerts" },
    ]);
    expect(rows).toEqual([]);
  });

  it("strips a freejobalert link but keeps the row's date", () => {
    const rows = normalizeImportantDates([
      { event: "Exam Date", date: "28 July 2026", link: "https://freejobalert.com/x" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("28 July 2026");
    expect(rows[0].link).toBe("");
  });

  it("never rescues a blocked destination into the links list", () => {
    const { dates, links } = partitionImportantDates([
      { event: "Official Website", date: "Click here", link: "https://www.freejobalert.com/jobs" },
      { event: "Result Link", date: "Click here", link: "https://t.me/x" },
      { event: "Notification", date: "Click here", link: "https://chat.whatsapp.com/y" },
      { event: "Official Notification PDF", date: "Click here", link: "https://x.gov.in/n.pdf" },
    ]);
    expect(dates).toEqual([]);
    expect(links).toEqual([{ text: "Official Notification PDF", url: "https://x.gov.in/n.pdf" }]);
  });

  it("holds the invariant against every blocked URL shape", () => {
    const blocked = [
      "https://www.freejobalert.com/x",
      "http://freejobalert.com/latest",
      "https://sub.freejobalert.com/a.pdf",
      "https://wa.me/919999999999",
      "https://chat.whatsapp.com/ABC",
      "https://api.whatsapp.com/send?phone=1",
      "https://www.whatsapp.com/channel/002",
      "whatsapp://send?text=hi",
      "https://t.me/examalerts",
      "https://telegram.me/x",
      "https://telegram.org/x",
      "https://telegram.dog/x",
      "tg://resolve?domain=x",
    ];
    // Every blocked URL, under a label chosen to defeat the wording rules.
    const rows = blocked.flatMap((url) => [
      { event: "Result Date", date: "12 August 2026", link: url },
      { event: "Notification PDF", date: "Click here", link: url },
      { event: "Official Website", date: "Download", link: url },
    ]);
    const { dates, links } = partitionImportantDates([
      ...rows,
      { event: "Exam Date", date: "28 July 2026", link: "https://rrb.gov.in/e.pdf" },
    ]);

    // The invariant: no blocked URL reaches a rendered row or the links list.
    for (const d of dates) expect(isBlockedUrl(d.link), `row link ${d.link}`).toBe(false);
    for (const l of links) expect(isBlockedUrl(l.url), `rescued ${l.url}`).toBe(false);
    expect(links).toEqual([]);

    // The two policies differ, on purpose. A channel invite is never a date, so
    // the row goes. A freejobalert row still states a real date, so the row
    // stays and only its URL is removed.
    expect(dates.map((d) => d.event)).toEqual(["Result Date", "Exam Date"]);
    expect(dates[0].link).toBe("");
    expect(dates[1].link).toBe("https://rrb.gov.in/e.pdf");
  });

  it("keeps an ordinary government link untouched", () => {
    const [row] = normalizeImportantDates([
      { event: "Result", date: "05/08/2026", link: "https://rrbcdg.gov.in/result.pdf" },
    ]);
    expect(row.link).toBe("https://rrbcdg.gov.in/result.pdf");
  });
});

describe("splitDateNote", () => {
  it("leaves a normal date alone", () => {
    expect(splitDateNote("20th March 2026")).toEqual({ date: "20th March 2026", note: "" });
  });

  it("leaves a long-but-still-a-date value inline", () => {
    // 44 chars — under the threshold, so it must not be split.
    const value = "13th, 16th, 17th, 18th February 2026";
    expect(splitDateNote(value)).toEqual({ date: value, note: "" });
  });

  it("splits a bracketed qualifier off a long date", () => {
    expect(
      splitDateNote("13th, 16th, 17th, 18th February 2026 (Re-exam: 11th March 2026)"),
    ).toEqual({ date: "13th, 16th, 17th, 18th February 2026", note: "Re-exam: 11th March 2026" });
  });

  it("splits a sentence-length date at the first sentence end", () => {
    const { date, note } = splitDateNote(
      "Not specified in the notification. The notification states that the interview will likely be held at short notice, and applicants must regularly check www.nsu.ac.in for updates.",
    );
    expect(date).toBe("Not specified in the notification");
    expect(note).toContain("interview will likely be held at short notice");
  });

  it("keeps an unsplittable long value as the date rather than dropping it", () => {
    const value =
      "One year from the date of publishing this advertisement with applications accepted throughout the year on a rolling basis";
    expect(splitDateNote(value)).toEqual({ date: value, note: "" });
  });

  it("is applied by the normalizer", () => {
    const [row] = normalizeImportantDates([
      { event: "Fee Payment", date: "18.08.2026 (fee not paid by this date makes the application liable to rejection)" },
    ]);
    expect(row.date).toBe("18.08.2026");
    expect(row.note).toBe("fee not paid by this date makes the application liable to rejection");
  });
});

describe("firstImportantDate", () => {
  it("skips the header row that leads most scraped tables", () => {
    expect(
      firstImportantDate([
        { event: "Event", date: "Date" },
        { event: "Last Date", date: "15 August 2026" },
      ])?.event,
    ).toBe("Last Date");
  });

  it("is undefined when nothing survives", () => {
    expect(firstImportantDate([{ event: "Event", date: "Date" }])).toBeUndefined();
  });
});

describe("normalizeDateMap", () => {
  it("turns a job_metadata date object into clean rows", () => {
    const rows = normalizeDateMap({ apply_start: "01/07/2026", apply_end: "31/07/2026", exam_date: null });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ event: "apply start", date: "01/07/2026" });
  });
});

describe("partitionImportantDates", () => {
  it("rescues the URL from a link row instead of discarding it", () => {
    const { dates, links } = partitionImportantDates([
      { event: "Official Notification PDF", date: "Click here", link: "https://iari.res.in/a.pdf" },
      { event: "Exam Date", date: "28 July 2026" },
    ]);
    expect(dates.map((d) => d.event)).toEqual(["Exam Date"]);
    // Labelled by the event cell — better than the "Click here" it replaces.
    expect(links).toEqual([{ text: "Official Notification PDF", url: "https://iari.res.in/a.pdf" }]);
  });

  it("rescues a website row's bare domain as a usable href", () => {
    const { links } = partitionImportantDates([
      { event: "Official Portal", date: "indianrailways.gov.in" },
    ]);
    expect(links).toEqual([{ text: "Official Portal", url: "https://indianrailways.gov.in" }]);
  });

  it("prefers the row's href over its text when both are present", () => {
    const { links } = partitionImportantDates([
      { event: "Official Website", date: "cmti.res.in", link: "https://cmti.res.in/jobs" },
    ]);
    expect(links[0].url).toBe("https://cmti.res.in/jobs");
  });

  it("never rescues a promo or metadata destination", () => {
    const { links } = partitionImportantDates([
      { event: "Join Telegram Channel", date: "Click Here", link: "https://t.me/xyz" },
      { event: "Sarkari Result", date: "Click Here", link: "https://sarkariresult.com" },
      { event: "Article Title", date: "Some Title", link: "https://example.com/a" },
    ]);
    expect(links).toEqual([]);
  });

  it("dedupes rescued URLs ignoring a trailing slash", () => {
    const { links } = partitionImportantDates([
      { event: "Official Website", date: "Click here", link: "https://x.gov.in/" },
      { event: "Home Page", date: "Click here", link: "https://x.gov.in" },
    ]);
    expect(links).toHaveLength(1);
  });

  it("rescues nothing when a dropped row has no destination at all", () => {
    const { links } = partitionImportantDates([{ event: "Event", date: "Date" }]);
    expect(links).toEqual([]);
  });

  it("leaves the link on rows that are kept, so it still renders inline", () => {
    const { dates, links } = partitionImportantDates([
      { event: "Result", date: "05/08/2026", link: "https://x.gov.in/r.pdf" },
    ]);
    expect(dates[0].link).toBe("https://x.gov.in/r.pdf");
    expect(links).toEqual([]);
  });
});

/**
 * Every distinct junk row seen across 1000 live updates (3640 rows). These two
 * properties are what make the filtering safe, so they are asserted over the
 * whole corpus rather than case by case: dropping a row must never remove a
 * date, and must never remove the only route to a link.
 */
const REAL_DROPPED_ROWS: { event: string; date: string; link?: string }[] = [
  { event: "Event", date: "Date" },
  { event: "Event", date: "Date & Time" },
  { event: "Event", date: "Date and Time" },
  { event: "Event", date: "Date / Time" },
  { event: "Event", date: "Details" },
  { event: "Activity", date: "Date" },
  { event: "Particulars", date: "Details" },
  { event: "Particular", date: "Details" },
  { event: "Particular", date: "Date" },
  { event: "Particulars", date: "Link" },
  { event: "S. No.", date: "Activity" },
  { event: "Item", date: "Details" },
  { event: "Link Description", date: "Link" },
  { event: "Job Openings", date: "Last Date" },
  { event: "Post Name", date: "Minimum Qualification" },
  { event: "Post Name", date: "Educational / Training Qualification (as per notification)" },
  { event: "Official Website", date: "Click here", link: "https://cmti.res.in/" },
  { event: "Official Notification PDF", date: "Click here", link: "https://iari.res.in/a.pdf" },
  { event: "Apply Online", date: "Click here", link: "https://x.gov.in/apply" },
  { event: "Application Form", date: "Click here", link: "https://x.gov.in/form.pdf" },
  { event: "Bio-Data Form", date: "Click here", link: "https://x.gov.in/bio.pdf" },
  { event: "Hall Ticket Download / Candidate Login", date: "Click Here", link: "https://x.gov.in/ht" },
  { event: "SSB PET PST Admit Card 2026 (Direct Link)", date: "Click Here", link: "https://x.gov.in/ac" },
  { event: "Official Notification (Final Answer Key)", date: "Download Here", link: "https://x.gov.in/ak" },
  { event: "Madhya Pradesh", date: "Check Here", link: "https://mp.gov.in/r" },
  { event: "Official Website", date: "dpcc.delhigovt.nic.in" },
  { event: "Official Website", date: "mahajyoti.org.in" },
  { event: "Join Arattai Channel", date: "Click Here", link: "https://arattai.example/x" },
  { event: "Join Telegram Channel", date: "Click Here", link: "https://t.me/x" },
  { event: "Join WhatsApp Channel", date: "Click Here", link: "https://chat.whatsapp.com/x" },
  { event: "Sarkari Result", date: "Click Here", link: "https://sarkariresult.com" },
  { event: "Download Mobile App", date: "Click Here", link: "https://play.google.com/x" },
];

const PROMO_EVENT_RE = /join|sarkari|mobile app/i;
const DATE_SIGNAL_RE =
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(19|20)\d{2}\b)/i;

describe("information loss", () => {
  it("drops every known junk row", () => {
    const kept = normalizeImportantDates(REAL_DROPPED_ROWS);
    expect(kept).toEqual([]);
  });

  it("never drops a row that carries a calendar date", () => {
    for (const row of REAL_DROPPED_ROWS) {
      expect(DATE_SIGNAL_RE.test(row.date), `${row.event} => ${row.date}`).toBe(false);
    }
    // …and a row with a date survives even when its label looks junk-adjacent.
    const kept = normalizeImportantDates([
      { event: "Official Website", date: "Opens 12 August 2026" },
      { event: "Link Description", date: "15/08/2026" },
      { event: "Job Openings", date: "31 August 2026" },
    ]);
    expect(kept).toHaveLength(3);
  });

  it("rescues the destination of every dropped non-promo link row", () => {
    const { links } = partitionImportantDates(REAL_DROPPED_ROWS);
    const rescued = new Set(links.map((l) => l.url.replace(/\/+$/, "").toLowerCase()));

    for (const row of REAL_DROPPED_ROWS) {
      const url = row.link || (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(row.date) ? `https://${row.date}` : "");
      if (!url) continue;
      const expected = PROMO_EVENT_RE.test(row.event) ? false : true;
      expect(
        rescued.has(url.replace(/\/+$/, "").toLowerCase()),
        `${row.event} -> ${url}`,
      ).toBe(expected);
    }
  });

  it("keeps every word when splitting a long date into date + note", () => {
    const longDates = [
      "13th, 16th, 17th, 18th February 2026 (Re-exam: 11th March 2026)",
      "18.08.2026 (fee not paid by this date makes the application incomplete and liable to rejection)",
      "September 2026, at Jaipur (subject to change at the discretion of Rajasthan High Court)",
      "Not specified in the notification. The notification states that the interview will likely be held at short notice.",
    ];
    const words = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    for (const value of longDates) {
      const { date, note } = splitDateNote(value);
      const after = new Set(words(`${date} ${note}`));
      const missing = words(value).filter((w) => !after.has(w));
      expect(missing, value).toEqual([]);
    }
  });
});

describe("normalizeOverviewRows", () => {
  it("drops the overview table's own header row", () => {
    const rows = normalizeOverviewRows([
      { field: "Particulars", value: "Details" },
      { field: "Organization", value: "National Sports University (NSU)" },
    ]);
    expect(rows).toEqual([{ field: "Organization", value: "National Sports University (NSU)" }]);
  });

  it("drops promo rows and empty cells, and dedupes", () => {
    const rows = normalizeOverviewRows([
      { field: "Sarkari Result", value: "Click" },
      { field: "Total Vacancies", value: "" },
      { field: "Job Location", value: "Imphal" },
      { field: "Job Location", value: "Imphal" },
    ]);
    expect(rows).toEqual([{ field: "Job Location", value: "Imphal" }]);
  });
});
