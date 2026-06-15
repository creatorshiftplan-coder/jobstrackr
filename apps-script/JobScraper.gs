/**
 * JobScraper.gs — job listings.
 * Ports api/scraper_v5.py parse_page + api/job_insert_helper.py build_job_record
 * (with NO fabricated fallbacks) + api/scraper_v3.py extract_links_from_master.
 */

// City/state names sometimes embedded in titles (api/scraper_v5.py).
const TITLE_LOCATIONS = [
  'New Delhi', 'Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Bangalore',
  'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Patna', 'Bhopal',
  'Bhubaneswar', 'Chandigarh', 'Dehradun', 'Guwahati', 'Jodhpur', 'Raipur', 'Ranchi',
  'Shimla', 'Srinagar', 'Thiruvananthapuram', 'Trivandrum', 'Vijayawada', 'Visakhapatnam',
  'Nagpur', 'Indore', 'Coimbatore', 'Surat', 'Vadodara', 'Agra', 'Varanasi', 'Kanpur',
  'Noida', 'Gurugram', 'Gurgaon', 'Faridabad', 'Allahabad', 'Prayagraj', 'Meerut',
  'Nashik', 'Aurangabad', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Kochi', 'Kozhikode',
  'Madurai', 'Tiruchirappalli', 'Mysuru', 'Mysore', 'Hubli', 'Mangaluru', 'Mangalore',
  'Rajkot', 'Jammu', 'Leh', 'Imphal', 'Shillong', 'Aizawl', 'Kohima', 'Itanagar',
  'Agartala', 'Gangtok', 'Panaji', 'Goa', 'Port Blair',
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

const STATE_DOMAINS = {
  kerala: 'Kerala', rajasthan: 'Rajasthan', gujarat: 'Gujarat', maharashtra: 'Maharashtra',
  karnataka: 'Karnataka', tamilnadu: 'Tamil Nadu', tnpsc: 'Tamil Nadu', telangana: 'Telangana',
  andhra: 'Andhra Pradesh', odisha: 'Odisha', bihar: 'Bihar', bpsc: 'Bihar', punjab: 'Punjab',
  psssb: 'Punjab', haryana: 'Haryana', hpsc: 'Himachal Pradesh', mpsc: 'Maharashtra',
  rpsc: 'Rajasthan', uppsc: 'Uttar Pradesh', wbpsc: 'West Bengal', assam: 'Assam',
  jkpsc: 'Jammu & Kashmir', cgpsc: 'Chhattisgarh', jpsc: 'Jharkhand', gpsc: 'Gujarat',
};

/** Extract article links from a listing page (formats edthr + lattrbord). */
function extractListingLinks(html, baseUrl) {
  const out = [];
  const seen = {};
  const add = function (date, title, href) {
    if (!href) return;
    href = absUrl(baseUrl, href.trim());
    if (seen[href]) return;
    seen[href] = true;
    out.push({ update_date: cleanText(date), title: cleanText(title), url: href });
  };
  const trRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let tm;
  while ((tm = trRe.exec(html)) !== null) {
    const attrs = tm[1] || '';
    const cls = (attrs.match(/class\s*=\s*["']([^"']*)["']/i) || [, ''])[1].toLowerCase();
    const cells = [];
    const cellRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let cm;
    while ((cm = cellRe.exec(tm[2])) !== null) cells.push(cm[1]);
    if (cls.indexOf('edthr') !== -1 && cells.length >= 3) {
      const a = cells[2].match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
      if (a) add(stripTags(cells[0]), stripTags(cells[1]), a[1]);
    } else if (cls.indexOf('lattrbord') !== -1 && cells.length >= 7) {
      const a = cells[6].match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
      if (a) add(stripTags(cells[0]), stripTags(cells[2]), a[1]);
    }
  }

  // FORMAT 3 — <div class="org_tab"> card layout (search-jobs / jobs-in-<city> pages),
  // ported from api/lib/scraper_v3.py extract_links_from_master. Each card carries an
  // <a class="kc_btn"> "Apply/Get Details" link; the title comes from the header tag.
  const cardRe = /<div\b[^>]*class\s*=\s*["'][^"']*\borg_tab\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let dm;
  while ((dm = cardRe.exec(html)) !== null) {
    const card = dm[1] || '';
    const a = card.match(/<a\b[^>]*class\s*=\s*["'][^"']*\bkc_btn\b[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i)
      || card.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*class\s*=\s*["'][^"']*\bkc_btn\b[^"']*["']/i);
    if (!a) continue;
    const header = card.match(/<(?:span|h2|h6)\b[^>]*>([\s\S]*?)<\/(?:span|h2|h6)>/i);
    add('', header ? stripTags(header[1]) : '', a[1]);
  }

  return out;
}

/**
 * Return forward pagination URLs from a listing page, oldest-page-first in document
 * order. Ports api/lib/scraper_v3.py get_pagination_urls (Style A `li.disp_inblock`,
 * Style B `ul.pagination`). The caller walks forward by picking the first URL it has
 * not yet visited, so the shifting [1..5][NEXT] window advances one page at a time.
 */
function paginationUrls_(html, baseUrl) {
  const urls = [];
  const seen = {};
  const push = function (href) {
    if (!href) return;
    href = absUrl(baseUrl, href.trim());
    if (!href || seen[href]) return;
    seen[href] = true;
    urls.push(href);
  };
  // Style A — <li class="disp_inblock"> (skip the active/current one).
  const liRe = /<li\b([^>]*class\s*=\s*["'][^"']*\bdisp_inblock\b[^"']*["'][^>]*)>([\s\S]*?)<\/li>/gi;
  let lm;
  while ((lm = liRe.exec(html)) !== null) {
    if (/\bactive\b/i.test(lm[1])) continue;
    const a = lm[2].match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
    if (a) push(a[1]);
  }
  // Style B — <ul class="pagination"> (skip current/dots/prev controls).
  const ulRe = /<ul\b[^>]*class\s*=\s*["'][^"']*\bpagination\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi;
  let um;
  while ((um = ulRe.exec(html)) !== null) {
    const liRe2 = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
    let l2;
    while ((l2 = liRe2.exec(um[1])) !== null) {
      if (/\b(currentpage|dots|prev)\b/i.test(l2[1] || '')) continue;
      const a = l2[2].match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
      if (a) push(a[1]);
    }
  }
  return urls;
}

/** Port of api/scraper_v5.py parse_page → scraped job dict. */
function parseJobPage(url, html) {
  const body = articleBodyHtml(html);

  // Title
  let examName = '';
  const h1 = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) examName = stripTags(h1[1]);
  if (!examName) {
    const t = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (t) examName = stripTags(t[1]);
  }

  // Description (first paragraph > 30 chars before first h2/table)
  let description = '';
  const beforeH2 = body.split(/<h2\b/i)[0];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(beforeH2)) !== null) {
    const t = stripTags(pm[1]);
    if (t && t.length > 30) { description = t; break; }
  }

  // Overview table
  const ovHtml = sectionHtmlByH2(body, ['overview']);
  const ovKv = tableKV(ovHtml);
  const ovNorm = {};
  Object.keys(ovKv).forEach(function (k) {
    ovNorm[k.toLowerCase().replace(/^[*\s]+|[*\s]+$/g, '').replace(/\s+/g, '_')] = ovKv[k];
  });
  const ovGet = function () {
    for (let i = 0; i < arguments.length; i++) {
      const kn = String(arguments[i]).toLowerCase().replace(/\s+/g, '_');
      if (ovNorm[kn]) return ovNorm[kn];
    }
    return null;
  };

  // Agency
  let agency = ovGet('Company Name', 'Conducting Authority', 'Recruitment Board',
    'Organization', 'Organisation', 'Department', 'Board') || '';
  if (!agency) {
    const m = examName.match(/^([\w\s]+?)(?:Recruitment|Jobs|Vacancy|Notification)/);
    if (m) agency = cleanText(m[1]);
  }

  // Vacancies (raw table)
  let vacHtml = sectionHtmlByH2(body, ['vacancy', 'detail']) ||
    sectionHtmlByH2(body, ['vacancies']) || sectionHtmlByH2(body, ['post', 'detail']);
  let vacancies = null;
  if (vacHtml) {
    const tables = extractTables(vacHtml);
    for (let ti = 0; ti < tables.length; ti++) {
      const tbl = tables[ti];
      let headers = [];
      for (let ri = 0; ri < tbl.rows.length; ri++) {
        const ths = tbl.rows[ri].filter(function (c) { return c.tag === 'th'; });
        if (ths.length) { headers = ths.map(function (c) { return c.text; }); break; }
      }
      const entries = [];
      tbl.rows.forEach(function (row) {
        const tds = row.filter(function (c) { return c.tag === 'td'; });
        if (!tds.length) return;
        const vals = tds.map(function (c) { return c.text; });
        if (!vals.some(function (v) { return v; })) return;
        if (headers.length && headers.length === vals.length) {
          const obj = {}; headers.forEach(function (h, i) { obj[h] = vals[i]; }); entries.push(obj);
        } else if (vals.length >= 2) {
          const obj = { post_name: vals[0], total_posts: vals[1] };
          for (let i = 2; i < vals.length; i++) obj['col_' + (i)] = vals[i];
          entries.push(obj);
        } else if (vals.length === 1) {
          entries.push({ post_name: vals[0] });
        }
      });
      if (entries.length) { vacancies = entries; break; }
    }
  }
  if (!vacancies) {
    const vacRaw = ovGet('No of Posts', 'Total Posts', 'Total Post', 'total_post', 'total_posts',
      'Number of Posts', 'Total Number of Posts', 'Vacancies', 'Total Vacancies', 'Posts');
    if (vacRaw) vacancies = [{ total_posts: vacRaw }];
  }

  // Location (4 sources)
  let locationRaw = ovGet('Location', 'Place of Posting', 'Job Location', 'Work Location',
    'Place of Work', 'Posting Location', 'State', 'City') || '';
  if (!locationRaw) {
    const tagRe = /<(?:p|li|td)\b[^>]*>([\s\S]*?)<\/(?:p|li|td)>/gi;
    let g;
    while ((g = tagRe.exec(body)) !== null) {
      const mm = stripTags(g[1]).match(/location\s*[:–-]\s*(.+)/i);
      if (mm) {
        const cand = mm[1].split('|')[0].trim();
        if (cand && cand.length < 80 && cand.indexOf('http') === -1) { locationRaw = cand; break; }
      }
    }
  }
  if (!locationRaw) {
    const titleLower = examName.toLowerCase();
    for (let i = 0; i < TITLE_LOCATIONS.length; i++) {
      const loc = TITLE_LOCATIONS[i];
      if (new RegExp('\\b' + loc.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(titleLower)) {
        locationRaw = loc; break;
      }
    }
  }
  if (!locationRaw) {
    const site = (ovGet('Application Website', 'Official Website', 'Website', 'Apply Online') || '').toLowerCase();
    if (site) {
      const keys = Object.keys(STATE_DOMAINS);
      for (let i = 0; i < keys.length; i++) { if (site.indexOf(keys[i]) !== -1) { locationRaw = STATE_DOMAINS[keys[i]]; break; } }
    }
  }
  const location = cleanLocation(locationRaw); // may be '' — build step marks Not Available

  // Employment type
  const jobTypeRaw = (ovGet('Job Type', 'Employment Type', 'Type') || '').toLowerCase();
  let employmentType = 'FULL_TIME';
  if (jobTypeRaw.indexOf('part') !== -1) employmentType = 'PART_TIME';
  else if (jobTypeRaw.indexOf('contract') !== -1) employmentType = 'CONTRACT';
  else if (jobTypeRaw.indexOf('intern') !== -1) employmentType = 'INTERNSHIP';

  // Eligibility / qualification
  let eligRaw = ovGet('Qualification', 'Educational Qualification', 'Education Qualification',
    'Education', 'Eligibility');
  if (!eligRaw) {
    const elHtml = sectionHtmlByH2(body, ['eligibility']);
    const bullets = bulletList(elHtml);
    eligRaw = bullets.length ? bullets.join(' | ') : stripTags(elHtml);
  }
  const eligibility = eligRaw || null;

  // Salary
  let salRaw = ovGet('Salary', 'Pay Scale', 'Stipend', 'Remuneration', 'Pay', 'CTC', 'salary') || '';
  if (!salRaw) salRaw = stripTags(sectionHtmlByH2(body, ['salary']));
  const sal = parseSalary(salRaw);

  // Age
  const ageOv = ovGet('Age Limit', 'Age Criteria', 'Age') || '';
  const ageBlock = stripTags(sectionHtmlByH2(body, ['age', 'limit']));
  const age = parseAge((ageOv + ' ' + ageBlock).trim());

  // Application fee table
  const applicationFees = parseFeesFromSection(sectionHtmlByH2(body, ['application', 'fee']));

  // Important dates
  const datesRows = tableRows(sectionHtmlByH2(body, ['important', 'date']));
  const datesDict = {};
  datesRows.forEach(function (r) { datesDict[r[0]] = parseDate(r[1]); });
  const findDate = function () {
    for (let i = 0; i < arguments.length; i++) {
      const hint = String(arguments[i]).toLowerCase();
      const keys = Object.keys(datesDict);
      for (let k = 0; k < keys.length; k++) if (keys[k].toLowerCase().indexOf(hint) !== -1) return datesDict[keys[k]];
    }
    return null;
  };
  let applyStart = findDate('application start', 'opening date', 'start date', 'apply start', 'online registration', 'application open');
  let applyEnd = findDate('application last', 'closing date', 'last date', 'apply end', 'last date to apply', 'end date', 'closing');
  const examDateStr = findDate('exam date', 'examination', 'test date', 'written exam');
  const advertisedOn = findDate('advertised', 'notification date', 'published', 'notification out');
  const lastDateOv = ovGet('Last Date', 'Application Last Date', 'Apply Last Date');
  if (!applyEnd && lastDateOv) applyEnd = parseDate(lastDateOv);
  const walkin = findDate('walk-in', 'walk in', 'walkin', 'interview date', 'date of walk');
  if (walkin && !applyEnd) applyEnd = walkin;

  // Selection process
  const selBullets = bulletList(sectionHtmlByH2(body, ['selection', 'process']));
  const selectionProcess = selBullets.length ? selBullets : null;

  // Important links
  const linksDict = tableLinks(sectionHtmlByH2(body, ['important', 'link']));
  const findExternal = function () {
    for (let i = 0; i < arguments.length; i++) {
      const hint = String(arguments[i]).toLowerCase();
      const descs = Object.keys(linksDict);
      for (let d = 0; d < descs.length; d++) {
        if (descs[d].toLowerCase().indexOf(hint) !== -1 && isExternalNonFja(linksDict[descs[d]])) return linksDict[descs[d]];
      }
    }
    return null;
  };
  let notificationPdf = findExternal('official notification', 'notification pdf', 'notification', 'pdf', 'advertisement', 'advt');
  let applyLink = findExternal('apply online', 'apply here', 'application form', 'online application', 'register online', 'apply now');
  let officialWebsite = findExternal('official website', 'official web', 'website');

  // PDF fallback — scan body anchors to *.pdf
  if (!notificationPdf) {
    anchors(body).forEach(function (a) {
      if (notificationPdf) return;
      if (/\.pdf/i.test(a.href)) {
        const href = absUrl(url, a.href);
        if (isExternalNonFja(href)) notificationPdf = href;
      }
    });
  }
  if (!applyLink) {
    const ovSite = ovGet('Application Website', 'Apply Online', 'Official Website', 'Apply Link', 'Application Link', 'Online Apply');
    if (ovSite && /^https?:\/\//i.test(ovSite) && isExternalNonFja(ovSite)) applyLink = ovSite;
  }
  if (!applyLink) {
    const kw = /apply\s*online|apply\s*here|register\s*online|apply\s*now|submit\s*application|fill\s*form|online\s*application/i;
    anchors(body).forEach(function (a) {
      if (applyLink) return;
      const href = absUrl(url, a.href);
      if (kw.test(a.text) && isExternalNonFja(href)) applyLink = href;
    });
  }
  if (!officialWebsite) {
    const ovSite = ovGet('Official Website', 'Application Website', 'Website', 'Official Web', 'Apply Online');
    if (ovSite && /^https?:\/\//i.test(ovSite) && isExternalNonFja(ovSite)) officialWebsite = ovSite;
  }
  if (!officialWebsite && applyLink) {
    const r = applyLink.match(/^(https?:\/\/[^\/]+)/i);
    if (r) officialWebsite = r[1] + '/';
  }

  // Hard freejobalert guard (final safety net)
  if (notificationPdf && notificationPdf.toLowerCase().indexOf('freejobalert') !== -1) notificationPdf = null;
  if (applyLink && applyLink.toLowerCase().indexOf('freejobalert') !== -1) applyLink = null;
  if (officialWebsite && officialWebsite.toLowerCase().indexOf('freejobalert') !== -1) officialWebsite = null;

  // Overview object (snake_case keys, excluding link/apply mode)
  let overviewObj = {};
  Object.keys(ovKv).forEach(function (k) {
    const v = ovKv[k];
    if (k && v && ['link', 'apply mode'].indexOf(k.toLowerCase()) === -1) {
      overviewObj[k.toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')] = v;
    }
  });
  if (!Object.keys(overviewObj).length) overviewObj = null;

  const lastDate = applyEnd || (lastDateOv ? parseDate(lastDateOv) : null) || null;

  return {
    exam_name: examName,
    agency: agency,
    salary_min: sal.min, salary_max: sal.max,
    salary_text: sal.text && sal.text !== String(sal.min) ? sal.text : null,
    location: location,
    last_date: lastDate,
    exam_date: examDateStr,
    age_min: age.min, age_max: age.max, age_limit_text: age.text,
    vacancies: vacancies,
    eligibility: eligibility,
    application_fees: applicationFees,
    employment_type: employmentType,
    description: description || null,
    selection_process: selectionProcess,
    important_dates: { advertised_on: advertisedOn, apply_start: applyStart, apply_end: applyEnd, exam_date: examDateStr },
    overview: overviewObj,
    official_apply_link: applyLink,
    official_website: officialWebsite,
    notification_pdf: notificationPdf,
  };
}

/** api/scraper_v5.py parse_fees — list of {category, fee} from first fee table. */
function parseFeesFromSection(sectionHtml) {
  const tables = extractTables(sectionHtml);
  for (let ti = 0; ti < tables.length; ti++) {
    const entries = [];
    tables[ti].rows.forEach(function (row) {
      if (row.length < 2) return;
      if (row[0].tag === 'th' && row[1].tag === 'th') return;
      const c0 = row[0].text, c1 = row[1].text;
      if (!c0 || !c1) return;
      if (['category', 'sl no', 's.no', 'sr no', 'sno'].indexOf(c0.toLowerCase()) !== -1 &&
        ['fee', 'amount', 'application fee', 'charges'].indexOf(c1.toLowerCase()) !== -1) return;
      entries.push({ category: c0, fee: c1 });
    });
    if (entries.length) return entries;
  }
  return null;
}

/** Port of build_job_record with NO fabricated fallbacks → Jobs sheet row object. */
function buildJobRow(scraped, sourceUrl) {
  const r = scraped;
  const NA = CONFIG.NA_TEXT;

  // Vacancies total
  let totalVacancies = null;
  let vacanciesDisplay = NA;
  if (r.vacancies && r.vacancies.length) {
    const totalRow = r.vacancies.filter(function (v) {
      return Object.keys(v).some(function (k) { return typeof v[k] === 'string' && v[k].toLowerCase().indexOf('total') !== -1; });
    })[0];
    if (totalRow) {
      const nums = Object.keys(totalRow).map(function (k) { return String(totalRow[k]).replace(/[^0-9]/g, ''); })
        .filter(function (s) { return s && /^\d+$/.test(s); }).map(Number);
      if (nums.length) totalVacancies = Math.max.apply(null, nums);
    }
  }
  if (!totalVacancies && r.overview && r.overview.total_vacancies) {
    const tv = String(r.overview.total_vacancies).replace(/[^0-9]/g, '');
    if (/^\d+$/.test(tv)) totalVacancies = parseInt(tv, 10);
  }
  if (totalVacancies) vacanciesDisplay = totalVacancies + ' Posts';

  // Application fee (max)
  let appFee = null;
  if (r.application_fees && r.application_fees.length) {
    const fees = r.application_fees.map(function (f) { return String(f.fee || '').replace(/[^0-9]/g, ''); })
      .filter(function (s) { return s && /^\d+$/.test(s); }).map(Number);
    if (fees.length) appFee = Math.max.apply(null, fees);
  }

  // Dates — NO +1yr fabrication: use parsed value or TBD.
  const lastDate = r.last_date ? r.last_date : CONFIG.NA_DATE;
  const lastDateDisplay = r.last_date ? r.last_date : NA;
  const applicationStartDate = (r.important_dates && r.important_dates.apply_start) ? r.important_dates.apply_start : null;

  // Metadata
  const metadata = {};
  if (r.salary_text) metadata.salary_text = r.salary_text;
  if (r.age_limit_text) metadata.age_limit_text = r.age_limit_text;
  if (r.vacancies && r.vacancies.length) metadata.vacancies_detail = r.vacancies;
  if (r.application_fees && r.application_fees.length) metadata.application_fees = r.application_fees;
  if (r.selection_process && r.selection_process.length) metadata.selection_process = r.selection_process;
  if (r.important_dates) metadata.important_dates = r.important_dates;
  if (r.overview) metadata.overview = r.overview;
  if (r.notification_pdf) metadata.notification_pdf = r.notification_pdf;
  if (r.employment_type) metadata.employment_type = r.employment_type;
  if (r.exam_date) metadata.exam_date = r.exam_date;
  if (r.official_website) metadata.official_website = r.official_website;

  return {
    title: r.exam_name || NA,
    department: r.agency || NA,
    location: r.location || NA,
    qualification: r.eligibility || NA,
    experience: '',
    eligibility: r.eligibility || '',
    description: r.description || '',
    salary_min: r.salary_min == null ? '' : r.salary_min,
    salary_max: r.salary_max == null ? '' : r.salary_max,
    age_min: r.age_min == null ? '' : r.age_min,
    age_max: r.age_max == null ? '' : r.age_max,
    application_fee: appFee == null ? '' : appFee,
    vacancies: totalVacancies == null ? '' : totalVacancies,
    vacancies_display: vacanciesDisplay,
    application_start_date: applicationStartDate || '',
    last_date: lastDate,
    last_date_display: lastDateDisplay,
    apply_link: r.official_apply_link || '',
    official_website: r.official_website || '',
    is_featured: false,
    auto_discovered: true,
    job_metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : '',
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
  };
}
