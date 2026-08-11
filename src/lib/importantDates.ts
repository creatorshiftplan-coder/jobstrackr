/**
 * Cleanup for the scraped `important_dates` arrays.
 *
 * Every row in `exam_updates.important_dates` came out of an HTML table on a
 * source site, and those tables are only loosely "date tables":
 *
 *   • the table's own header row is scraped as data — `{event:"Event",
 *     date:"Date"}` leads 72 of the 100 most recent updates;
 *   • link tables share the shape, so rows arrive as
 *     `{event:"Official Website", date:"Click here"}`;
 *   • source sites inject their own promos as rows ("Sarkari Result",
 *     "Join Arattai Channel");
 *   • the "date" cell is free text, and regularly holds a whole sentence —
 *     the longest in a single feed pull ran to 177 characters.
 *
 * Rendering those rows verbatim is what distorts the Important Dates block: a
 * sentence in a `whitespace-nowrap` date column squeezes the event column to
 * nothing and the label wraps one letter per line. Normalizing here (rather
 * than in each of the six places that render dates) means a new junk shape from
 * the scraper cannot reach any surface, and the layout in ImportantDatesList
 * stays valid whatever text survives.
 */

import {
  isBlockedUrl,
  isFreeJobAlertUrl,
  isWhatsAppUrl,
  isWhatsAppContent,
  isTelegramUrl,
  isTelegramContent,
} from "./urlUtils";

export interface RawImportantDate {
  event?: string | null;
  date?: string | null;
  status?: string | null;
  link?: string | null;
}

export interface CleanImportantDate {
  event: string;
  /** Short, headline part of the date cell — always safe to show on one line. */
  date: string;
  /** Trailing qualifier split off a long date cell ("subject to change…"). */
  note: string;
  status: string;
  link: string;
}

/**
 * Labels that are *only* ever column headings — no real schedule row is called
 * "Event" or "S. No.". Because they cannot be a genuine event name, a row is
 * dropped on this cell alone, whatever sits beside it. That matters: sources
 * pair these with arbitrary second columns ("Event | Date/Status",
 * "S. No. | Interview Date"), which a both-cells-must-match rule never catches.
 */
const HEADER_ONLY_EVENT_RE =
  /^(events?|activit(y|ies)|particulars?|items?|link\s*descriptions?|descriptions?|sl\.?\s*no\.?|s\.?\s*no\.?|serial\s*no\.?|#|post\s*names?)$/i;

/**
 * A value that carries an actual calendar date.
 *
 * This is the safety net for the rule above: however that word list grows, a
 * row whose value holds a date is never treated as a header. Filtering can
 * therefore never remove a date from the page, by construction rather than by
 * getting every label right.
 */
const DATE_SIGNAL_RE =
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2}|(19|20)\d{2})\b/i;

/**
 * A cell that *may* be a table heading but can also be a real label — "Last
 * Date" and "Job Openings" head a column on one site and name a real row on
 * another. These only count as a header when BOTH cells match, so a row like
 * "Last Date | 09/08/2026" survives. Sources word the same two columns a dozen
 * ways ("Event/Date", "Date & Time", "Date/Status"), hence the alternatives.
 */
const HEADER_CELL_RE =
  /^(events?|activit(y|ies)|dates?(\s*(&|and|\/)\s*(times?|status|details?))?|times?|schedules?|items?|documents?|actions?|remarks?|status|particulars?|details?|links?|descriptions?|sl\.?\s*no\.?|s\.?\s*no\.?|post\s*names?|job\s*openings?|last\s*date)$/i;

/**
 * Some sources publish an article-summary table where the dates table belongs,
 * so rows arrive that just restate the page ("Article Title — <the title>").
 */
const METADATA_EVENT_RE =
  /^(article\s*(title|name|type|link|url)|page\s*title|source|post\s*name)$/i;

/** A row pointing at a website — Important Links already carries it. */
const WEBSITE_EVENT_RE =
  /^(official\s*(portal|website|site|link)|website|home\s*page|apply\s*(online\s*)?link)$/i;
/** Bare domain or URL. The last label must be alphabetic so "12.06.2026" is not one. */
const URL_VALUE_RE = /^(https?:\/\/\S+|[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}([/?#]\S*)?)$/i;

/**
 * A "date" cell that is really a link label — the row belongs in Quick Links.
 * Titles and cells are rephrased on the way in ("Download" becomes "obtain" /
 * "collect" / "access"), so the call-to-action verbs are all listed here.
 */
const LINK_LABEL_RE =
  /^(click|here|links?|download|view|check|apply|visit|obtain|collect|access|get|open|read\s*more|active\s*now|available(\s*soon)?)(\s*(here|now|link|pdf|online|portal|site|website|more))?$/i;

/** Rows the source site added to advertise itself or its channels. */
const PROMO_ROW_RE =
  /sarkari\s*(result|exam|job)|freejobalert|free\s*job\s*alert|rojgar\s*result|join\s*(our\s*)?(the\s*)?(telegram|whatsapp|arattai|youtube|instagram|facebook)|(telegram|whatsapp|arattai)\s*(channel|group|link)|follow\s*us|subscribe\s*(to\s*)?(our|us)|(download|get|install)\s*(our\s*|the\s*|mobile\s*|android\s*|ios\s*)*app\b/i;

/**
 * Above this the date cell is prose, not a date, so we try to split a headline
 * date off the front and demote the rest to a note. 48 characters still fits
 * the longest genuine multi-date value we see ("13th, 16th, 17th, 18th
 * February 2026") without splitting it.
 */
const MAX_INLINE_DATE = 48;

/**
 * Break points where a date cell stops being a date and starts qualifying it:
 * an opening bracket, a sentence end, a semicolon, or a spaced dash.
 */
const DATE_TAIL_RE = /\s*[([]\s*|\.\s+|;\s*|\s+[–—-]\s+/;

const collapse = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

const isHeaderCell = (value: string): boolean => HEADER_CELL_RE.test(value.replace(/[:.]+$/, "").trim());

/**
 * Split an over-long date cell into a headline date plus a trailing note.
 * Returns the original string as the date when there is no natural break, so
 * nothing is ever silently dropped — the renderer wraps it instead.
 */
export function splitDateNote(raw: string): { date: string; note: string } {
  const value = collapse(raw);
  if (value.length <= MAX_INLINE_DATE) return { date: value, note: "" };

  const match = DATE_TAIL_RE.exec(value);
  if (match && match.index > 0 && match.index <= MAX_INLINE_DATE) {
    const date = value.slice(0, match.index).replace(/[,;:]$/, "").trim();
    const note = value
      .slice(match.index + match[0].length)
      .replace(/^[\s([]+/, "")
      .replace(/[)\]]+$/, "")
      .trim();
    if (date && note) return { date, note };
  }
  return { date: value, note: "" };
}

/** A link rescued from a row that is not a date row. */
export interface HarvestedLink {
  /** The row's event cell — a far better label than the "Click here" it replaces. */
  text: string;
  url: string;
}

/** Make a bare domain ("iari.res.in") usable as an href. */
function asHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return URL_VALUE_RE.test(value) ? `https://${value}` : "";
}

/**
 * Split a scraped date table into the rows worth showing and the links that
 * were hiding inside the rows that are not dates.
 *
 * Dropping a "Official Notification PDF — Click here" row is right for the
 * dates table, but the URL on that row is sometimes the *only* copy: on the
 * job page and the tracked-exam card, which fetch `download_links` but not
 * `official_links`, 10 of 16 such URLs appear nowhere else. Returning them
 * here lets those surfaces show them under Quick Links, labelled with the
 * event text instead of "Click here".
 *
 * Promo and article-metadata rows are dropped outright — their destinations
 * are the source site's own channels, not the exam's.
 *
 * Row order is preserved; source tables list dates chronologically and callers
 * rely on that.
 */
export function partitionImportantDates(
  rows: RawImportantDate[] | null | undefined,
): { dates: CleanImportantDate[]; links: HarvestedLink[] } {
  if (!Array.isArray(rows)) return { dates: [], links: [] };

  const dates: CleanImportantDate[] = [];
  const links: HarvestedLink[] = [];
  const seen = new Set<string>();
  const seenUrls = new Set<string>();

  const harvest = (text: string, rawUrl: string) => {
    const url = asHref(rawUrl);
    // freejobalert / WhatsApp / Telegram destinations are blocked app-wide and
    // must never be rescued out of a date row into a links section.
    if (!url || isBlockedUrl(url)) return;
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seenUrls.has(key)) return;
    seenUrls.add(key);
    links.push({ text, url });
  };

  for (const row of rows) {
    if (!row) continue;
    const event = collapse(row.event);
    const rawDate = collapse(row.date);
    const rawLink = collapse(row.link);
    if (!event || !rawDate) continue;

    // A WhatsApp / Telegram row is a channel invite, never an exam date. Match
    // on the URL as well as the wording: the promo text below only catches rows
    // that announce themselves ("Join Telegram Channel"), so a row labelled
    // anything at all — "Result Link", "Notification" — still reaches users if
    // we only read the label. Drop the row and never rescue the destination.
    if (isWhatsAppUrl(rawLink) || isTelegramUrl(rawLink)) continue;
    if (isWhatsAppUrl(rawDate) || isTelegramUrl(rawDate)) continue;
    if (isWhatsAppContent(`${event} ${rawDate}`) || isTelegramContent(`${event} ${rawDate}`)) continue;

    // freejobalert is blocked app-wide, but the row's *date* is still real, so
    // strip the URL rather than the row — matching filterFreeJobAlertFromUpdates.
    const link = isFreeJobAlertUrl(rawLink) ? "" : rawLink;
    if (isFreeJobAlertUrl(rawDate)) continue;

    // The source site's own promos — the row *and* wherever it points.
    if (PROMO_ROW_RE.test(event) || PROMO_ROW_RE.test(rawDate)) continue;
    // The table's own header row, scraped as data. A value holding a real date
    // vetoes both checks — see DATE_SIGNAL_RE.
    const hasDate = DATE_SIGNAL_RE.test(rawDate);
    if (!hasDate) {
      if (HEADER_ONLY_EVENT_RE.test(event.replace(/[:.]+$/, "").trim())) continue;
      if (isHeaderCell(event) && isHeaderCell(rawDate)) continue;
    }
    // The article restating itself.
    if (METADATA_EVENT_RE.test(event)) continue;

    // A link row wearing a date row's clothes — keep the destination, drop the row.
    if (LINK_LABEL_RE.test(rawDate)) {
      harvest(event, link);
      continue;
    }
    // A website row: the value is the address, the link (if any) is the href.
    if (WEBSITE_EVENT_RE.test(event) && URL_VALUE_RE.test(rawDate)) {
      harvest(event, link || rawDate);
      continue;
    }

    const { date, note } = splitDateNote(rawDate);
    const key = `${event.toLowerCase()}|${date.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    dates.push({ event, date, note, status: collapse(row.status), link });
  }

  return { dates, links };
}

/**
 * Drop the junk rows, tidy the survivors, and dedupe. Use
 * `partitionImportantDates` instead when the surface also renders a links
 * section — otherwise the links on the dropped rows go nowhere.
 */
export function normalizeImportantDates(
  rows: RawImportantDate[] | null | undefined,
): CleanImportantDate[] {
  return partitionImportantDates(rows).dates;
}

/**
 * The first row worth showing on a card. Same rules as the full normalizer, so
 * a card can never lead with "Event — Date".
 */
export function firstImportantDate(
  rows: RawImportantDate[] | null | undefined,
): CleanImportantDate | undefined {
  return normalizeImportantDates(rows)[0];
}

/**
 * The `overview` array is scraped from a sibling table on the same pages, so it
 * arrives with the same junk — its header row ("Particulars | Details") and the
 * source site's promos. Same rules, different field names.
 */
export function normalizeOverviewRows(
  rows: { field?: string | null; value?: string | null }[] | null | undefined,
): { field: string; value: string }[] {
  if (!Array.isArray(rows)) return [];
  const out: { field: string; value: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row) continue;
    const field = collapse(row.field);
    const value = collapse(row.value);
    if (!field || !value) continue;
    if (isHeaderCell(field) && isHeaderCell(value)) continue;
    if (PROMO_ROW_RE.test(field)) continue;

    const key = `${field.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ field, value });
  }

  return out;
}

/** Convenience for `{ label: value }` shaped dates (job_metadata.important_dates). */
export function normalizeDateMap(
  map: Record<string, string | null | undefined> | null | undefined,
): CleanImportantDate[] {
  if (!map || typeof map !== "object") return [];
  return normalizeImportantDates(
    Object.entries(map).map(([key, value]) => ({
      event: key.replace(/_/g, " "),
      date: value,
    })),
  );
}
