/**
 * Check if a URL contains "freejobalert" (case-insensitive).
 * Used to filter out freejobalert links across the entire app.
 */
export function isFreeJobAlertUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes("freejobalert");
}

/**
 * Check if a URL is a WhatsApp link (groups, chats, api links).
 */
export function isWhatsAppUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes("wa.me") ||
    u.includes("chat.whatsapp.com") ||
    u.includes("api.whatsapp.com") ||
    u.includes("whatsapp.com/") ||
    u.includes("whatsapp://")
  );
}

/**
 * Check if text content promotes a WhatsApp group or link.
 */
export function isWhatsAppContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("whatsapp group") ||
    t.includes("whatsapp channel") ||
    t.includes("join whatsapp") ||
    t.includes("whatsapp link") ||
    t.includes("join our whatsapp")
  );
}

/**
 * Check if a URL is a Telegram link (groups, channels, bots, share links).
 */
export function isTelegramUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes("t.me/") ||
    u.includes("//t.me") ||
    u.includes("telegram.me") ||
    u.includes("telegram.org") ||
    u.includes("telegram.dog") ||
    u.includes("tg://") ||
    u.includes("telegram://")
  );
}

/**
 * Check if text content promotes a Telegram group or channel.
 */
export function isTelegramContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("telegram group") ||
    t.includes("telegram channel") ||
    t.includes("join telegram") ||
    t.includes("telegram link") ||
    t.includes("join our telegram")
  );
}

/**
 * True when a URL is a real link worth surfacing to users — an exam PDF,
 * notification, or official website — and NOT a WhatsApp / Telegram
 * share-or-join link. Used to keep only PDF/website links on cards.
 */
export function isPdfOrWebsiteLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return !isWhatsAppUrl(url) && !isTelegramUrl(url);
}

/**
 * Combined check: returns true if the URL should be blocked (freejobalert,
 * WhatsApp, or Telegram).
 */
export function isBlockedUrl(url: string | null | undefined): boolean {
  return isFreeJobAlertUrl(url) || isWhatsAppUrl(url) || isTelegramUrl(url);
}

// Bare domain like "www.ukmssb.org" or "ukmssb.org/page". The final label must
// be alphabetic so numeric strings such as dates ("05.08.2026") never match.
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}([/?#]\S*)?$/i;

/**
 * Normalize a raw website value into a clickable URL.
 * Scraped overview tables often store bare domains ("www.ukmssb.org") with no
 * protocol; browsers treat those as relative paths, so prepend "https://".
 * Returns null when the value is blocked (freejobalert) or doesn't look like
 * a URL/domain at all (e.g. "Online only").
 */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/[.,;)\]]+$/, "");
  if (!value) return null;
  if (/\s/.test(value)) {
    // Not a bare URL — salvage a URL-looking token if one is embedded in text
    const token = value
      .split(/\s+/)
      .find((t) => /^https?:\/\//i.test(t) || BARE_DOMAIN_RE.test(t));
    if (!token) return null;
    value = token.replace(/[.,;)\]]+$/, "");
  }
  if (!/^https?:\/\//i.test(value)) {
    if (!BARE_DOMAIN_RE.test(value)) return null;
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    if (!parsed.hostname.includes(".")) return null;
  } catch {
    return null;
  }
  return isFreeJobAlertUrl(value) ? null : value;
}

/**
 * Pull an official-website URL out of a job's Overview table (job_metadata.overview).
 * Scrapers snake_case the row labels ("Official Website" → official_website), but
 * older rows may keep other casings/spellings, so keys are matched loosely.
 */
export function getWebsiteFromOverview(overview: unknown): string | null {
  if (!overview || typeof overview !== "object" || Array.isArray(overview)) return null;
  const entries = Object.entries(overview as Record<string, unknown>);
  const keyMatchers = [
    /official\s*(website|web\s*site|web|site)/i,
    /application\s*website/i,
    /^(web\s*site|website)$/i,
  ];
  for (const matcher of keyMatchers) {
    for (const [key, val] of entries) {
      if (typeof val !== "string") continue;
      const label = key.replace(/[_-]+/g, " ").trim();
      if (!matcher.test(label)) continue;
      const url = normalizeWebsiteUrl(val);
      if (url) return url;
    }
  }
  return null;
}

export interface LinkItem {
  text?: string | null;
  url: string;
}

/**
 * Collect the real PDF / official-website links for an exam update, in priority
 * order (official → download → related), de-duplicated, with WhatsApp, Telegram
 * and freejobalert links removed. This is what we surface on cards and detail
 * pages: "only the PDF or website link of the exam page".
 *
 * The scraper stores the useful links across three columns — official_links
 * (the exam site / notification PDFs, populated on most updates), download_links
 * (direct PDFs), and related_links (mostly WhatsApp/Telegram, occasionally a real
 * site) — so we merge all three and filter rather than reading just one.
 */
export function getExamPdfWebsiteLinks(update: {
  official_links?: LinkItem[] | null;
  download_links?: LinkItem[] | null;
  related_links?: LinkItem[] | null;
}): { text: string; url: string }[] {
  const out: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (arr?: LinkItem[] | null) => {
    for (const l of arr || []) {
      if (!l?.url || !isPdfOrWebsiteLink(l.url) || isFreeJobAlertUrl(l.url)) continue;
      // Dedupe on the URL ignoring a trailing slash / case (homepage links repeat).
      const key = l.url.replace(/\/+$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: (l.text || "").trim() || l.url, url: l.url });
    }
  };
  push(update.official_links);
  push(update.download_links);
  push(update.related_links);
  return out;
}
