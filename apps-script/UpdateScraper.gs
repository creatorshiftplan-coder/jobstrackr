/**
 * UpdateScraper.gs — exam/job updates.
 * Ports api/article_scraper.py scrape_article (+ its junk/do-not filters,
 * category detection, table & link classification, sections).
 */

const JUNK_CLASSES = ['ad_div', 'adsbygoogle', 'fja-follow-bar', 'fja-alert-widget',
  'yarpp', 'mobile-app', 'social-bar', 'share-bar', 'related-posts', 'post-navigation',
  'author-box', 'comment-respond', 'sidebar', 'jp-relatedposts', 'code-block', 'widget'];

const NAV_PATTERNS = /(government-jobs|state-government-jobs|bank-jobs|teaching-faculty-jobs|engineering-jobs|railway-jobs|police-defence-jobs|latest-notifications|employment-news|search-jobs|sarkarijob|sarkari-naukri|admit-card|exam-results|answer-key|cutoff-marks|written-marks|interview-results|last-date-reminder|eligibility|syllabus|exam-pattern|selection-process|previous-papers|education|contact-us|policy|author|\/author\/|\/category\/|\/tag\/)/i;

const JUNK_TEXTS = ['view all', 'join whatsapp', 'join telegram', 'join instagram',
  'join youtube', 'download mobile app', 'free mock test', 'google news', 'follow us',
  'add as a preferred source', 'play fun games', 'image resizer', 'pdf to word',
  'image to pdf', 'word to pdf', 'free ai interview'];

const GENERIC_LINK_TEXTS = ['download pdf', 'click here', 'view', 'visit', 'link', 'download', 'here'];
const DOWNLOAD_KW = ['download', 'admit card', 'hall ticket', 'result', 'apply', 'login',
  'official', 'click here', 'direct link', 'answer key', 'scorecard'];

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (/admit card|hall ticket|call letter|admit\b/.test(t)) return 'admit_card';
  if (/cut.?off|cutoff marks|minimum qualifying marks/.test(t)) return 'cutoff';
  if (/answer key|objection|provisional key/.test(t)) return 'answer_key';
  if (/syllabus|exam pattern|new pattern/.test(t)) return 'syllabus';
  if (/result|scorecard|merit list|marks/.test(t)) return 'result';
  if (/recruitment|apply online|vacancy|vacancies|notification/.test(t)) return 'recruitment';
  return 'news';
}

function parseDateSimple(text) {
  const m = (text || '').match(/(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})/);
  return m ? m[1] : '';
}

function parseStatus(text) {
  const m = (text || '').match(/\b(Out|Released|Active|Available|Declared|Upcoming|Soon|Live Now)\b/i);
  return m ? m[1] : '';
}

function isJunkLink(href, text) {
  if (NAV_PATTERNS.test(href)) return true;
  const lo = (text || '').toLowerCase();
  return JUNK_TEXTS.some(function (j) { return lo.indexOf(j) !== -1; });
}

function rowsFrom(tableHtml) {
  // returns array of [c0, c1, c2...] text for a single table html
  const tables = extractTables(tableHtml);
  if (!tables.length) return [];
  return tables[0].rows.map(function (r) { return r.map(function (c) { return c.text; }); });
}

/** Port of scrape_article → exam_updates dict. */
function scrapeUpdateArticle(url, html) {
  const out = {
    url: url, scraped_at: new Date().toISOString(), title: '', category: '',
    published_date: '', summary: '', status: '', full_text: '',
    important_dates: [], overview: [], vacancy_table: [], fee_table: [],
    eligibility_table: [], cutoff_table: [], download_links: [], official_links: [],
    related_links: [], images: [], tags: [], sections: [], related_articles: [],
  };

  // Title
  let h1 = html.match(/<h1\b[^>]*class\s*=\s*["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    out.title = stripTags(h1[1]);
    out.category = detectCategory(out.title);
    out.status = parseStatus(out.title);
  }

  // Published date (meta)
  const pub = html.match(/<meta[^>]*(?:property|name)\s*=\s*["'](?:article:published_time|og:updated_time)["'][^>]*content\s*=\s*["']([^"']+)["']/i);
  if (pub) out.published_date = pub[1];

  // Summary (meta)
  const desc = html.match(/<meta[^>]*(?:name|property)\s*=\s*["'](?:description|og:description)["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  if (desc) out.summary = decodeEntities(desc[1]);

  // Body
  let body = articleBodyHtml(html);
  body = removeBlocks(body, ['script', 'style', 'ins', 'iframe']);

  // Tags
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(body)) !== null) {
    const txt = stripTags(pm[1]);
    if (/Tags\s*:/i.test(txt)) {
      out.tags = txt.replace(/Tags\s*:/i, '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      break;
    }
  }

  // Full text
  const fullText = textWithNewlines(body).slice(0, 3000);
  out.full_text = fullText;

  // Summary fallback
  if (!out.summary || out.summary.length < 50) {
    const paras = fullText.split('\n').map(function (s) { return s.trim(); })
      .filter(function (p) { return p.length > 30 && !/^Tags?:/i.test(p); });
    if (paras.length) out.summary = paras[0].slice(0, 500);
  }
  if (!out.published_date) {
    const d = parseDateSimple(fullText);
    if (d && /\d{4}/.test(d)) out.published_date = d;
  }

  // Images
  const imgRe = /<img\b[^>]*src\s*=\s*["']([^"']+)["']/gi;
  let im;
  while ((im = imgRe.exec(body)) !== null) {
    if (im[1].indexOf('wp-content/uploads') !== -1) out.images.push(absUrl(url, im[1]));
    if (out.images.length >= 5) break;
  }

  // Tables — classify
  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  let tb;
  while ((tb = tableRe.exec(body)) !== null) {
    const tHtml = tb[0];
    const ttext = stripTags(tHtml).toLowerCase();
    const isDates = ['exam date', 'result date', 'admit card', 'last date', 'release date', 'notification', 'tier', 'phase', 'answer key', 'hall ticket', 'city intimation'].some(function (k) { return ttext.indexOf(k) !== -1; });
    const isOverview = ['conducting body', 'exam name', 'official website', 'vacancies', 'total posts', 'total vacancy', 'post name'].some(function (k) { return ttext.indexOf(k) !== -1; });
    const isVacancy = ['post name', 'vacancy', 'total posts'].some(function (k) { return ttext.indexOf(k) !== -1; }) && !isOverview;
    const isFee = (['application fee', 'fee', 'category'].some(function (k) { return ttext.indexOf(k) !== -1; })) && ttext.indexOf('fee') !== -1;
    const isCutoff = ['cutoff', 'category', 'marks', 'score', 'qualifying'].some(function (k) { return ttext.indexOf(k) !== -1; });
    const rows = rowsFrom(tHtml);
    if (isOverview && !out.overview.length) {
      rows.forEach(function (r) { if (r.length >= 2 && r[0] && r[1]) out.overview.push({ field: r[0], value: r[1] }); });
    } else if (isDates && !out.important_dates.length) {
      out.important_dates = parseDatesRows(tHtml);
    } else if (isVacancy && !out.vacancy_table.length) {
      rows.forEach(function (r) { if (r.length >= 2 && r[0] && r[1] && ['post name', 'post'].indexOf(r[0].toLowerCase()) === -1) out.vacancy_table.push({ post_name: r[0], vacancies: r[1] }); });
    } else if (isFee && !out.fee_table.length) {
      rows.forEach(function (r) { if (r.length >= 2 && r[0] && r[1] && ['category', 'fee'].indexOf(r[0].toLowerCase()) === -1) out.fee_table.push({ category: r[0], fee: r[1] }); });
    } else if (isCutoff && !out.cutoff_table.length) {
      rows.forEach(function (r) { if (r.length >= 2 && r[0] && r[1] && ['category', 'marks'].indexOf(r[0].toLowerCase()) === -1) out.cutoff_table.push({ category: r[0], marks: r[1] }); });
    }
  }

  // Links — classify (download / official / related) with do-nots
  const seen = {};
  anchors(body).forEach(function (a) {
    let href = absUrl(url, a.href);
    let text = a.text;
    if (!text || !href) return;
    if (!/^https?:\/\//i.test(href)) return;
    if (/^javascript|^mailto/i.test(a.href)) return;
    if (isJunkLink(href, text)) return;
    if (seen[href]) return;
    seen[href] = true;
    if (href.toLowerCase().indexOf('freejobalert') !== -1) return;
    if (!text || GENERIC_LINK_TEXTS.some(function (g) { return text.toLowerCase().indexOf(g) !== -1; })) {
      if (!text) text = 'Direct Link';
    }
    const loH = href.toLowerCase(), loT = text.toLowerCase();
    const isOfficial = ['gov.in', 'nic.in', 'org.in', 'ac.in', 'edu.in', 'res.in'].some(function (d) { return loH.indexOf(d) !== -1; });
    const isDownload = DOWNLOAD_KW.some(function (k) { return loT.indexOf(k) !== -1 || loH.indexOf(k) !== -1; });
    if (isOfficial) out.official_links.push({ text: text, url: href });
    else if (isDownload) out.download_links.push({ text: text, url: href });
    else out.related_links.push({ text: text, url: href });
  });

  // Sections (h2/h3/h4 headings with following p/ul/ol)
  out.sections = parseSections(body);

  // Related articles (external non-fja, not already seen)
  anchors(body).forEach(function (a) {
    if (out.related_articles.length >= 10) return;
    const href = absUrl(url, a.href);
    const text = a.text;
    if (!text || !href || href === url) return;
    if (seen[href]) return;
    if (out.related_articles.some(function (r) { return r.url === href; })) return;
    if (!/^https?:\/\//i.test(href)) return;
    if (href.toLowerCase().indexOf('freejobalert') !== -1) return;
    if (isJunkLink(href, text)) return;
    out.related_articles.push({ title: text, url: href });
  });

  return out;
}

function parseDatesRows(tableHtml) {
  const rows = [];
  const tables = extractTables(tableHtml);
  if (!tables.length) return rows;
  tables[0].rows.forEach(function (cells) {
    if (cells.length < 2) return;
    const texts = cells.map(function (c) { return c.text; });
    let link = '';
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i].html.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
      if (a && !/^javascript|^#|^mailto/i.test(a[1])) { link = absUrl('https://www.freejobalert.com', a[1]); break; }
    }
    const event = texts[0];
    const dateStr = parseDateSimple(texts[1]) || texts[1];
    const status = texts.length > 2 ? parseStatus(texts.slice(2).join(' ')) : '';
    if (event) {
      if (link && link.toLowerCase().indexOf('freejobalert') !== -1) link = '';
      rows.push({ event: event, date: dateStr, status: status, link: link });
    }
  });
  return rows;
}

function parseSections(body) {
  const sections = [];
  let current = null;
  const skipRe = /follow us|join|advertisement|share|about the author|other posts|job notifications|jobs by|state job|other active|other ssc/i;
  const re = /<(h2|h3|h4|p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const heading = stripTags(m[2]);
      if (skipRe.test(heading)) { current = null; continue; }
      if (current) sections.push(current);
      current = { heading: heading, level: tag, content: [], type: 'paragraph' };
    } else if (current) {
      if (tag === 'ul' || tag === 'ol') {
        const items = bulletList(m[2]);
        if (items.length) { current.content = current.content.concat(items); current.type = 'list'; }
      } else {
        const txt = stripTags(m[2]);
        if (txt) current.content.push(txt);
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** Convert a scraped update dict → ExamUpdates sheet row (JSON columns stringified). */
function buildUpdateRow(a) {
  if (CONFIG.REPHRASE_UPDATES) a = rephraseArticle(a);
  return {
    url: a.url,
    title: a.title || CONFIG.NA_TEXT,
    category: a.category || 'news',
    status: a.status || '',
    published_date: a.published_date || '',
    summary: a.summary || '',
    full_text: a.full_text || '',
    important_dates: JSON.stringify(a.important_dates || []),
    overview: JSON.stringify(a.overview || []),
    vacancy_table: JSON.stringify(a.vacancy_table || []),
    fee_table: JSON.stringify(a.fee_table || []),
    eligibility_table: JSON.stringify(a.eligibility_table || []),
    cutoff_table: JSON.stringify(a.cutoff_table || []),
    download_links: JSON.stringify(a.download_links || []),
    official_links: JSON.stringify(a.official_links || []),
    related_links: JSON.stringify(a.related_links || []),
    images: JSON.stringify(a.images || []),
    tags: JSON.stringify(a.tags || []),
    sections: JSON.stringify(a.sections || []),
    related_articles: JSON.stringify(a.related_articles || []),
    scraped_at: a.scraped_at || new Date().toISOString(),
  };
}
