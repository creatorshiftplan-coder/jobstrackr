/**
 * Html.gs — HTTP + regex-based HTML helpers for Apps Script.
 *
 * Apps Script has no DOM/BeautifulSoup, so the structural parsing the Python
 * relies on is reproduced with regex. FreeJobAlert tables/sections are simple
 * (no nesting), so this is sufficient. Date/salary/age/location parsers are
 * ported verbatim from api/scraper_v5.py.
 */

/** SSRF guard — only freejobalert.com may be fetched (api/auth.py allowlist). */
function isAllowedUrl(url) {
  if (!url) return false;
  const m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host === CONFIG.ALLOWED_HOST || host.endsWith('.' + CONFIG.ALLOWED_HOST);
}

// A fuller browser header set. FreeJobAlert sits behind Cloudflare, which scores
// each request on IP reputation AND fingerprint; a bare UA + Accept-Language is a
// weak fingerprint. These extra headers (Accept, sec-*, Upgrade-Insecure-Requests)
// make the request look like a real navigation, improving the odds a borderline
// Apps Script egress IP is let through instead of challenged.
function browserHeaders_() {
  return {
    'User-Agent': CONFIG.USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="123", "Not:A-Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };
}

/**
 * Fetch through a configured relay when the direct fetch is Cloudflare-blocked.
 * Set Script Property FETCH_PROXY_URL to a fetch-relay / scraping-API endpoint that
 * has a clean (non-Google) egress IP — e.g.
 *   ScraperAPI:  https://api.scraperapi.com/?api_key=KEY&url={url}
 *   ScrapingBee: https://app.scrapingbee.com/api/v1/?api_key=KEY&url={url}
 *   self-hosted: https://your-worker.example.com/fetch?target={url}
 * "{url}" is replaced with the URL-encoded target (if absent it is appended). The
 * relay does the actual freejobalert request from its own IP and returns the HTML,
 * so the article pages that Cloudflare denies to Apps Script come back 200.
 * Returns HTML or null; a missing/failing proxy is a silent no-op.
 */
function fetchViaProxy_(url) {
  const tmpl = PropertiesService.getScriptProperties().getProperty('FETCH_PROXY_URL');
  if (!tmpl) return null;
  const proxied = tmpl.indexOf('{url}') !== -1
    ? tmpl.replace('{url}', encodeURIComponent(url))
    : tmpl + encodeURIComponent(url);
  try {
    const resp = UrlFetchApp.fetch(proxied, {
      method: 'get', muteHttpExceptions: true, followRedirects: true, headers: browserHeaders_(),
    });
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) return resp.getContentText();
    log_('fetchViaProxy ' + code + ' for ' + url);
  } catch (e) {
    log_('fetchViaProxy failed for ' + url + ': ' + e);
  }
  return null;
}

/** Fetch a page with retries; returns HTML string or null. Enforces the allowlist. */
function fetchHtml(url, retries) {
  if (!isAllowedUrl(url)) {
    log_('fetchHtml blocked non-allowlisted url: ' + url);
    return null;
  }
  retries = retries == null ? 2 : retries;
  let blocked = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: browserHeaders_(),
      });
      const code = resp.getResponseCode();
      if (code >= 200 && code < 300) return resp.getContentText();
      // 403/429/503 are Cloudflare's block/challenge/rate-limit codes — flag so we
      // fall back to the relay once the direct attempts are exhausted.
      if (code === 403 || code === 429 || code === 503) blocked = true;
      log_('fetchHtml ' + code + ' for ' + url);
    } catch (e) {
      log_('fetchHtml attempt ' + (attempt + 1) + ' failed for ' + url + ': ' + e);
    }
    if (attempt < retries) Utilities.sleep(1500 * (attempt + 1));
  }
  // Direct fetch failed (likely a Cloudflare IP block) — try the relay if configured.
  const viaProxy = fetchViaProxy_(url);
  if (viaProxy) return viaProxy;
  if (blocked && !PropertiesService.getScriptProperties().getProperty('FETCH_PROXY_URL')) {
    log_('fetchHtml: ' + url + ' appears Cloudflare-blocked; set FETCH_PROXY_URL to a clean-IP relay to bypass.');
  }
  return null;
}

/** Decode the HTML entities that appear in scraped text. */
function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); });
}

/** Python clean(): strip tags is NOT done here — normalize whitespace + NBSP. */
function cleanText(s) {
  if (!s) return '';
  return decodeEntities(String(s).replace(/ /g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Remove whole tag blocks (script/style/ins/iframe) including their content. */
function removeBlocks(html, tags) {
  let out = html || '';
  tags.forEach(function (t) {
    out = out.replace(new RegExp('<' + t + '\\b[^>]*>[\\s\\S]*?<\\/' + t + '>', 'gi'), ' ');
  });
  return out;
}

/** Strip all tags → plain text (blocks separated by spaces), then cleanText. */
function stripTags(html) {
  if (!html) return '';
  return cleanText(String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

/** Like stripTags but keeps line breaks (for full_text), mirroring get_text(separator="\n"). */
function textWithNewlines(html) {
  if (!html) return '';
  let t = String(html)
    .replace(/<(script|style|ins|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t).replace(/ /g, ' ');
  t = t.split('\n').map(function (line) { return line.replace(/[ \t]+/g, ' ').trim(); }).join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract the article body HTML (entry-content/post-content/article). */
function articleBodyHtml(html) {
  // Balanced-div extraction: find the content <div>, then walk nested
  // <div>/</div> tokens to its TRUE closing tag. The old single-regex version
  // stopped at the first "</div></div>" it saw, which truncates the June-2026
  // redesigned pages ~9KB in — losing Important Dates and every later section.
  const open = html.match(/<div[^>]*class\s*=\s*["'][^"']*(?:entry-content|post-content|article-content|article__body)[^"']*["'][^>]*>/i);
  if (open) {
    const start = open.index + open[0].length;
    const tokRe = /<\/?div\b[^>]*>/gi;
    tokRe.lastIndex = start;
    let depth = 1, m;
    while ((m = tokRe.exec(html)) !== null) {
      depth += m[0].charAt(1) === '/' ? -1 : 1;
      if (depth === 0) return html.slice(start, m.index);
    }
    return html.slice(start);
  }
  const art = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (art) return art[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return main[1];
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1] : html;
}

/** Parse all <table> blocks → [{ text, rows:[[{text,html}]] }]. */
function extractTables(html) {
  const tables = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    const inner = tm[1];
    const rows = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm;
    while ((rm = trRe.exec(inner)) !== null) {
      const cells = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cm;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push({ tag: cm[1].toLowerCase(), html: cm[2], text: stripTags(cm[2]) });
      }
      if (cells.length) rows.push(cells);
    }
    tables.push({ html: inner, text: stripTags(inner).toLowerCase(), rows: rows });
  }
  return tables;
}

/** Find the chunk of body HTML under the first <h2> whose text contains ALL keywords. */
function sectionHtmlByH2(bodyHtml, keywords) {
  const hRe = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const heads = [];
  let m;
  while ((m = hRe.exec(bodyHtml)) !== null) {
    heads.push({ start: m.index, end: hRe.lastIndex, text: stripTags(m[1]).toLowerCase() });
  }
  for (let i = 0; i < heads.length; i++) {
    const ht = heads[i].text;
    const all = keywords.every(function (k) { return ht.indexOf(k.toLowerCase()) !== -1; });
    if (all) {
      const from = heads[i].end;
      const to = i + 1 < heads.length ? heads[i + 1].start : bodyHtml.length;
      return bodyHtml.slice(from, to);
    }
  }
  return '';
}

/** First table in a section → [[col0, col1], ...] (text). */
function tableRows(sectionHtml) {
  const tables = extractTables(sectionHtml);
  if (!tables.length) return [];
  return tables[0].rows
    .filter(function (r) { return r.length >= 2; })
    .map(function (r) { return [r[0].text, r[1].text]; });
}

/** 2-column key/value table → object (skips empties). */
function tableKV(sectionHtml) {
  const out = {};
  tableRows(sectionHtml).forEach(function (r) { if (r[0] && r[1]) out[r[0]] = r[1]; });
  return out;
}

/** Important-links table → { description: href } reading <a href> in the 2nd cell. */
function tableLinks(sectionHtml) {
  const out = {};
  const tables = extractTables(sectionHtml);
  if (!tables.length) return out;
  tables[0].rows.forEach(function (r) {
    if (r.length < 2) return;
    const desc = r[0].text;
    const a = r[1].html.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
    if (a) {
      const href = a[1].trim();
      if (href && href.charAt(0) !== '#') out[desc] = href;
    }
  });
  return out;
}

/** <li> texts inside a section. */
function bulletList(sectionHtml) {
  const items = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(sectionHtml)) !== null) {
    const t = stripTags(m[1]);
    if (t) items.push(t);
  }
  return items;
}

/** All anchors in an HTML chunk → [{ text, href }]. */
function anchors(html) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ href: m[1].trim(), text: stripTags(m[2]) });
  }
  return out;
}

/** Resolve a possibly-relative URL against a base (urljoin-lite). */
function absUrl(base, href) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  try {
    const root = base.match(/^(https?:\/\/[^\/]+)/i)[1];
    if (href.charAt(0) === '/') return root + href;
    return root + '/' + href.replace(/^\.?\//, '');
  } catch (e) {
    return href;
  }
}

// ─────────────────────────── date / salary / age (ported verbatim) ──────────

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07',
  aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const TIME_STRIP_RE = /\(?\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*\)?|from\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*onwards?|\bfrom\s+\d{1,2}\s*(?:AM|PM|am|pm)\s*onwards?/gi;
const DATE_RE = /(\d{1,2})[\s\-\/](\w+)[\s\-\/](\d{4})|(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})|(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/;

/** api/scraper_v5.py parse_date — ISO if parseable, raw text if tentative, null if empty. */
function parseDate(raw) {
  raw = cleanText(raw);
  if (!raw || ['n/a', 'not mentioned', '-', '–', 'na'].indexOf(raw.toLowerCase()) !== -1) return null;
  const low = raw.toLowerCase();
  if (['tentative', 'expected', 'to be'].some(function (w) { return low.indexOf(w) !== -1; })) return raw;
  let dateText = raw.replace(TIME_STRIP_RE, '').trim() || raw;
  const m = dateText.match(DATE_RE);
  if (m) {
    if (m[1]) {
      const day = m[1], monStr = m[2].toLowerCase().slice(0, 3), year = m[3];
      const mon = MONTH_MAP[monStr];
      if (mon) return year + '-' + mon + '-' + pad2(day);
      const monNum = parseInt(m[2], 10);
      if (monNum >= 1 && monNum <= 12) return year + '-' + pad2(monNum) + '-' + pad2(day);
    } else if (m[4]) {
      return m[4] + '-' + pad2(m[5]) + '-' + pad2(m[6]);
    } else if (m[7]) {
      return m[9] + '-' + pad2(m[8]) + '-' + pad2(m[7]);
    }
  }
  return raw || null;
}

function pad2(n) { return ('0' + parseInt(n, 10)).slice(-2); }

const NUM_RE = /[\d,]+/g;
const RANGE_RE = /([\d,.]+)\s*[-–to]+\s*([\d,.]+)/;
const MULTIPLIER_RE = /([\d,.]+)\s*(lakh|lac|lakhs|lacs|l|thousand|k|crore|cr)\b/gi;

/**
 * Lowest number accepted as a salary. Pay-matrix levels run 1–18 and pay bands
 * 1–4, so this rejects every one of them while keeping real grade-pay figures
 * (₹1,800 and up) and the smallest genuine stipends.
 */
const MIN_PLAUSIBLE_SALARY = 1000;

/**
 * Pay-structure phrases whose numbers are ordinals rather than money:
 * "Level 7", "Pay Level 10", "Academic Level 13A", "Cell-1", "PB 4",
 * "E-2 Grade", "Group B", "7th CPC". These used to win because parseSalary
 * took the first number it saw — which is how "Pay Level 7 as per 7th CPC"
 * ended up stored as a salary of ₹7.
 *
 * "Pay Band: ₹35,400" is deliberately NOT matched: the colon and ₹ break the
 * pattern, so the genuine figure survives the strip.
 */
const PAY_STRUCTURE_RE = /\b(?:academic\s+|pay\s+)?level[\s-]*\d+\s*[A-Za-z]?\b|\bcell[\s-]*\d+\b|\bpb[\s-]*\d+\b|\bpay\s*band[\s-]*\d+\b|\b[ES][\s-]*\d+\s*grade\b|\bgroup\s*[A-D]\b|\b\d+\s*(?:st|nd|rd|th)\s*cpc\b/gi;

/** A number carrying an explicit currency marker is almost certainly the pay. */
const CURRENCY_NUM_RE = /(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d+)?)/gi;

/** Currency markers only, used to normalise before range matching. */
const CURRENCY_MARK_RE = /(?:₹|rs\.?|inr)\s*/gi;

function toInt(s) {
  const n = parseInt(String(s).replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

function isPlausibleSalary(v) {
  return v !== null && v !== undefined && v >= MIN_PLAUSIBLE_SALARY && v < 10000000;
}

/**
 * Drop pay-structure ordinals and bare years so neither can be mistaken for
 * money. A year is only dropped when it is not currency-prefixed, so a genuine
 * "₹2,017" survives while "as per ORSP Rules, 2017" does not.
 */
function stripNonSalaryNumbers(text) {
  const withoutStructure = text.replace(PAY_STRUCTURE_RE, ' ');
  return withoutStructure.replace(/(.?)\b((?:19|20)\d{2})\b/g, function (m, prev) {
    return /[₹\d.,]/.test(prev) ? m : prev + ' ';
  });
}

/** api/scraper_v5.py parse_salary → { min, max, text }. */
function parseSalary(raw) {
  const text = cleanText(raw);
  if (!text || ['n/a', '-', '–', 'na'].indexOf(text.toLowerCase()) !== -1) return { min: null, max: null, text: null };
  const lower = text.toLowerCase();
  const hasMult = ['lakh', 'lac', 'lakhs', 'lacs', 'thousand', 'crore'].some(function (w) { return lower.indexOf(w) !== -1; });
  if (hasMult) {
    const matches = [];
    let mm; MULTIPLIER_RE.lastIndex = 0;
    while ((mm = MULTIPLIER_RE.exec(text)) !== null) matches.push([mm[1], mm[2]]);
    const conv = function (numS, w) {
      const n = parseFloat(numS.replace(/,/g, ''));
      w = w.toLowerCase();
      if (['lakh', 'lac', 'lakhs', 'lacs', 'l'].indexOf(w) !== -1) return Math.round(n * 100000);
      if (['thousand', 'k'].indexOf(w) !== -1) return Math.round(n * 1000);
      if (['crore', 'cr'].indexOf(w) !== -1) return Math.round(n * 10000000);
      return Math.round(n);
    };
    const vals = matches.map(function (p) { return conv(p[0], p[1]); })
      .filter(isPlausibleSalary);
    if (vals.length >= 2) {
      return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals), text: text };
    } else if (vals.length === 1) {
      return { min: vals[0], max: vals[0], text: text };
    }
  }

  // Everything below reads numbers positionally, so strip the ordinals first.
  const scan = stripNonSalaryNumbers(text);

  // Range: "Rs.56100-177500", "PB 4, Rs.37400-67000". Currency markers are
  // removed first because RANGE_RE's [\d,.]+ would otherwise latch onto the
  // dot in "Rs." and parse as NaN.
  const rm = scan.replace(CURRENCY_MARK_RE, ' ').match(RANGE_RE);
  if (rm) {
    const lo = toInt(rm[1]), hi = toInt(rm[2]);
    if (isPlausibleSalary(lo) && isPlausibleSalary(hi) && hi > lo) {
      return { min: lo, max: hi, text: text };
    }
  }

  // Currency-anchored values: "₹35,400 (Minimum) – ₹1,12,400 (Maximum)" reads
  // as two separate figures because the words between them defeat RANGE_RE.
  const currency = [];
  let cm;
  CURRENCY_NUM_RE.lastIndex = 0;
  while ((cm = CURRENCY_NUM_RE.exec(scan)) !== null) {
    const v = toInt(cm[1]);
    if (isPlausibleSalary(v)) currency.push(v);
  }
  if (currency.length >= 2) {
    return { min: Math.min.apply(null, currency), max: Math.max.apply(null, currency), text: text };
  }
  if (currency.length === 1) return { min: currency[0], max: currency[0], text: text };

  // Fall back to the first plausible bare number — not simply the first number,
  // which is what let level ordinals through.
  const nums = scan.match(NUM_RE);
  if (nums) {
    for (let i = 0; i < nums.length; i++) {
      const v = toInt(nums[i]);
      if (isPlausibleSalary(v)) return { min: v, max: v, text: text };
    }
  }
  return { min: null, max: null, text: text };
}

/** api/scraper_v5.py parse_age → { min, max, text }. */
function parseAge(text) {
  if (!text) return { min: null, max: null, text: null };
  const ct = cleanText(text);
  const explicit = [];
  const expRe = /(?:max(?:imum)?|min(?:imum)?|upto|up\s*to|between|age[:\s]*)\s*(\d{1,2})\s*(?:years?|yrs?)?/gi;
  let em;
  while ((em = expRe.exec(ct)) !== null) explicit.push(parseInt(em[1], 10));
  const rangeMatch = ct.match(/\b(\d{1,2})\s*(?:to|[-–])\s*(\d{1,2})\s*(?:years?|yrs?)/i);
  let ages = [];
  if (rangeMatch) {
    ages = [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)];
  } else if (explicit.length) {
    ages = explicit.filter(function (n) { return n >= 15 && n <= 70; });
  }
  if (!ages.length) {
    let cleaned = ct.replace(/\b\d{1,2}[\s\-\/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s\-\/]\s*\d{4}\b/gi, '');
    cleaned = cleaned.replace(/\b\d{4}\b/g, '');
    const two = cleaned.match(/\b\d{2}\b/g) || [];
    ages = two.map(Number).filter(function (n) { return n >= 15 && n <= 70; });
  }
  if (!ages.length) return { min: null, max: null, text: ct };
  return { min: Math.min.apply(null, ages), max: Math.max.apply(null, ages), text: ct };
}

/** api/scraper_v5.py clean_location — cleans junk; returns '' if nothing left (NO "India" fallback). */
function cleanLocation(raw) {
  if (!raw) return '';
  let s = cleanText(raw);
  s = s.replace(/[\d]+[)]*\s*$/, '');
  s = s.replace(/^[\d()]+\s*/, '');
  s = s.replace(/\(\d+\)/g, '');
  s = s.replace(/[)(/,;]+$/, '');
  s = s.trim();
  return s; // caller substitutes "Not Available" if empty — never fabricate
}

/** Is href an absolute URL that is NOT freejobalert (the core do-not rule). */
function isExternalNonFja(href) {
  if (!href) return false;
  if (!/^https?:\/\//i.test(href)) return false;
  return href.toLowerCase().indexOf('freejobalert') === -1;
}
