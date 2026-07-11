/**
 * Telegram.gs — post new jobs & exam-updates straight from the Sheet to Telegram
 * channels, with in-app deep-links, without involving the app/edge functions.
 *
 * Flow: the scraper writes rows (with a `slug` computed at scrape time, see
 * Triggers.gs) → the hourly `sync-sheets` function imports them into Supabase so
 * the deep-link is live → `postPendingToTelegram()` (this file, on its own trigger)
 * posts any row that's (a) old enough to have synced and (b) not yet posted.
 *
 * Channels live in the `Channels` tab (CHANNEL_COLUMNS). Dedup is the `posted_at`
 * column on the Jobs / ExamUpdates tabs — set once a row is broadcast.
 *
 * One-time: run `setup` (creates the Channels tab + installs the trigger), then
 * fill the Channels tab and run `testTelegramChannels` to verify, and
 * `markAllPostedNow` once to skip the historical backlog.
 */

// ─────────────────────────── slug (matches the DB) ───────────────────────────

/** Job slug — identical to the `generate_job_slug` Postgres trigger. */
function makeJobSlug_(title) {
  var s = String(title || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > 80) {
    s = s.slice(0, 80);
    var h = s.lastIndexOf('-');
    if (h > 0) s = s.slice(0, h); // don't cut mid-word
  }
  return s;
}

/** Update type → slug/headline bucket (shared by slug + message + DB fallback). */
function updateTypeSuffix_(category, title) {
  var t = (String(category || '') + ' ' + String(title || '')).toLowerCase();
  if (/admit|hall ticket|call letter/.test(t)) return 'admit-card';
  if (/result|cutoff|merit|scorecard/.test(t)) return 'result';
  if (/answer key|response sheet/.test(t)) return 'answer-key';
  return 'update';
}

/** Update slug — title + type + year (matches generate_exam_update_slug). */
function makeUpdateSlug_(title, category) {
  var yr = String(new Date().getFullYear());
  var suffix = updateTypeSuffix_(category, title);
  var base = makeJobSlug_(title)
    .slice(0, 80 - suffix.length - yr.length - 2)
    .replace(/^-+|-+$/g, '');
  return base + '-' + suffix + '-' + yr;
}

/** Return a slug not already in `taken` (a lowercased map), reserving it. */
function uniqueSlug_(base, taken) {
  if (!base) base = 'item';
  var slug = base, n = 0;
  while (taken[slug]) { n++; slug = base + '-' + n; }
  taken[slug] = true;
  return slug;
}

// ─────────────────────────── channels ───────────────────────────────────────

/** Active channel rows from the Channels tab. */
function readChannels_() {
  return readObjects_(CONFIG.TAB_CHANNELS, CHANNEL_COLUMNS).filter(function (c) {
    var active = String(c.active || '').trim().toLowerCase();
    return c.bot_token && c.channel_id && active !== 'no' && active !== 'false' && active !== '0';
  });
}

/** Normalize a channel id the way Telegram expects (@user / -100… ids). */
function formatChannelId_(id) {
  var c = String(id).trim();
  if (/^\d+$/.test(c)) return '-100' + c;
  if (/^-\d+$/.test(c) && c.indexOf('-100') !== 0) return '-100' + c.substring(1);
  if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(c)) return '@' + c;
  return c;
}

function sendTelegram_(ch, text) {
  var url = 'https://api.telegram.org/bot' + String(ch.bot_token).trim() + '/sendMessage';
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: formatChannelId_(ch.channel_id),
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() === 200) return true;
    log_('telegram send failed (' + ch.name + ', ' + resp.getResponseCode() + '): ' + resp.getContentText().slice(0, 180));
    return false;
  } catch (e) {
    log_('telegram send error (' + ch.name + '): ' + e);
    return false;
  }
}

// ─────────────────────────── sector matching ────────────────────────────────

/**
 * Whole-word regex from a list of terms/phrases. Matching on word boundaries
 * (BOTH sides) is what stops short acronyms from leaking into unrelated words —
 * the old indexOf() substring test mis-routed items, e.g. 'nda' matched
 * "secondary"/"boundary"/"mandate" → UPSC, 'hal' matched "hall ticket" → PSU,
 * 'bel' matched "below" → PSU, 'sail' matched "sailor" → PSU, 'ips' matched
 * "fellowships" → UPSC. Plurals/suffixes are covered by listing them explicitly
 * (e.g. 'railways', 'banking') so precision improves without losing recall.
 */
function wordRe_(terms) {
  var esc = terms.map(function (t) {
    return String(t).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp('\\b(?:' + esc.join('|') + ')\\b', 'i');
}

// Compiled once per execution. Emits the SAME sector labels as before — only the
// matching got stricter — so no Channels-tab `sector` values need to change.
var SECTOR_RES_ = {
  ssc:       wordRe_(['ssc', 'staff selection commission']),
  railway:   wordRe_(['railway', 'railways', 'rrb', 'ntpc', 'group d', 'alp', 'assistant loco pilot', 'loco pilot', 'rpf', 'railway recruitment']),
  bank:      wordRe_(['bank', 'banks', 'banking', 'ibps', 'sbi', 'rbi', 'nabard', 'sidbi']),
  upsc:      wordRe_(['upsc', 'civil services', 'ias', 'ips', 'nda', 'cds']),
  defence:   wordRe_(['army', 'navy', 'air force', 'defence', 'defense', 'agniveer', 'agnipath', 'police', 'constable', 'sub inspector', 'cisf', 'crpf', 'bsf', 'itbp', 'afcat', 'coast guard']),
  psu:       wordRe_(['psu', 'ongc', 'ntpc', 'bhel', 'sail', 'iocl', 'bpcl', 'hpcl', 'gail', 'bel', 'hal', 'drdo', 'isro', 'powergrid', 'npcil', 'coal india']),
  psc:       wordRe_(['psc', 'public service commission', 'bpsc', 'uppsc', 'mpsc', 'rpsc', 'wbpsc', 'opsc', 'mppsc', 'ukpsc', 'hpsc']),
  teaching:  wordRe_(['teacher', 'teachers', 'teaching', 'tgt', 'pgt', 'professor', 'lecturer', 'kvs', 'nvs', 'ctet', 'tet', 'ugc net', 'prt']),
  judiciary: wordRe_(['supreme court', 'high court', 'district court', 'judiciary', 'judicial']),
  steno:     wordRe_(['stenographer', 'steno']),
};

/** Sector labels a piece of text belongs to (whole-word matched). */
function matchSectors_(text) {
  text = String(text || '').toLowerCase();
  var m = ['All Jobs', 'Government Jobs', 'Sarkari Naukri'];
  if (SECTOR_RES_.ssc.test(text)) m.push('SSC');
  if (SECTOR_RES_.railway.test(text)) { m.push('RRB'); m.push('Railway Jobs'); }
  if (SECTOR_RES_.bank.test(text)) { m.push('Banking Jobs'); m.push('Banking'); }
  if (SECTOR_RES_.upsc.test(text)) m.push('UPSC');
  if (SECTOR_RES_.defence.test(text)) { m.push('Defence Jobs'); m.push('Police Jobs'); }
  if (SECTOR_RES_.psu.test(text)) m.push('PSU Jobs');
  if (SECTOR_RES_.psc.test(text)) { m.push('PSC'); m.push('State PSC'); m.push('State Government Jobs'); }
  if (SECTOR_RES_.teaching.test(text)) { m.push('Teaching Jobs'); m.push('Teaching'); }
  if (SECTOR_RES_.judiciary.test(text)) { m.push('Judiciary'); m.push('High Court'); }
  if (SECTOR_RES_.steno.test(text)) m.push('Stenographer');
  return m;
}

function sectorMatches_(sectors, channelSector) {
  var cs = String(channelSector || 'All Jobs').trim().toLowerCase();
  for (var i = 0; i < sectors.length; i++) if (sectors[i].toLowerCase() === cs) return true;
  return false;
}

// ─────────────────────────── messages ───────────────────────────────────────

function escapeHtml_(t) {
  if (t === null || t === undefined) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pickHashtags_(text) {
  text = String(text || '').toLowerCase();
  var tags = ['#GovernmentJobs', '#SarkariNaukri'];
  if (text.indexOf('ssc') >= 0) tags.unshift('#SSC');
  else if (text.indexOf('upsc') >= 0) tags.unshift('#UPSC');
  else if (text.indexOf('railway') >= 0 || text.indexOf('rrb') >= 0) tags.unshift('#Railway');
  else if (text.indexOf('bank') >= 0 || text.indexOf('ibps') >= 0 || text.indexOf('sbi') >= 0) tags.unshift('#Banking');
  else if (text.indexOf('police') >= 0) tags.unshift('#Police');
  else if (text.indexOf('defence') >= 0 || text.indexOf('army') >= 0) tags.unshift('#Defence');
  else if (text.indexOf('teach') >= 0) tags.unshift('#TeachingJobs');
  return tags.join(' ');
}

function buildJobMessage_(r, link) {
  var vac = r.vacancies_display || r.vacancies || 'TBD';
  var last = r.last_date_display || r.last_date || 'Check Details';
  return [
    '<b>🚨 NEW RECRUITMENT ALERT</b>', '',
    '<b>📌 ' + escapeHtml_(r.title) + '</b>', '',
    '🏢 Organization: ' + escapeHtml_(r.department),
    '👥 Vacancies: ' + escapeHtml_(vac),
    '📅 Last Date: ' + escapeHtml_(last), '',
    '✅ Apply Online', '',
    '🔗 <b><a href="' + link + '">View Full Notification on Website</a></b>', '',
    pickHashtags_(String(r.title || '') + ' ' + String(r.department || '')),
  ].join('\n');
}

function buildUpdateMessage_(r, link) {
  var suffix = updateTypeSuffix_(r.category, r.title);
  var head = suffix === 'admit-card' ? 'Admit Card / Hall Ticket Released'
    : suffix === 'result' ? 'Result Released'
    : suffix === 'answer-key' ? 'Answer Key Released'
    : 'Notification / Update Available';
  var parts = [
    '<b>🔔 IMPORTANT UPDATE</b>', '',
    '<b>📌 ' + escapeHtml_(r.title) + '</b>', '',
    '📢 ' + head, '',
  ];
  if (r.summary) parts.push(escapeHtml_(String(r.summary).slice(0, 300)), '');
  parts.push('🔗 <b><a href="' + link + '">View Details on Website</a></b>', '',
    pickHashtags_(String(r.title || '') + ' ' + String(r.summary || '')));
  return parts.join('\n');
}

// ─────────────────────────── main poster ────────────────────────────────────

/**
 * Post any unposted, already-synced rows to their matching channels. Safe to run
 * repeatedly (dedup via posted_at); honours the 6-min budget and resumes next run.
 */
function postPendingToTelegram() {
  ensureSheets();
  var channels = readChannels_();
  if (!channels.length) { log_('telegram: no active channels configured'); return; }

  var deadline = Date.now() + CONFIG.MAX_RUNTIME_MS;
  var minAgeCutoff = Date.now() - CONFIG.TELEGRAM_MIN_AGE_MS;
  var posted = 0;
  posted += postFeed_('job', CONFIG.TAB_JOBS, JOB_COLUMNS, channels, deadline, minAgeCutoff);
  posted += postFeed_('update', CONFIG.TAB_UPDATES, UPDATE_COLUMNS, channels, deadline, minAgeCutoff);
  log_('telegram: posted ' + posted + ' item(s) across ' + channels.length + ' channel(s)');
}

function postFeed_(type, tab, columns, channels, deadline, minAgeCutoff) {
  var rows = readObjects_(tab, columns);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    if (Date.now() >= deadline) break;
    var r = rows[i];
    if (r.posted_at) continue; // already broadcast

    // Age gate: only post once the row is old enough to have been imported into
    // Supabase by the hourly sync, so the deep-link resolves (no dead links).
    var ts = Date.parse(r.scraped_at);
    if (ts && ts > minAgeCutoff) continue;

    var slug = String(r.slug || '').trim();
    if (!slug) { // backfill for rows scraped before slugs existed
      slug = type === 'job' ? makeJobSlug_(r.title) : makeUpdateSlug_(r.title, r.category);
      setCell_(tab, columns, r._row, 'slug', slug);
    }

    var link = CONFIG.SITE_ORIGIN + (type === 'job' ? '/jobs/' : '/exam-update/') + slug;
    var sectors = type === 'job'
      ? matchSectors_(String(r.title || '') + ' ' + String(r.department || '') + ' ' + String(r.qualification || ''))
      : matchSectors_(String(r.title || '') + ' ' + String(r.summary || ''));
    var msg = type === 'job' ? buildJobMessage_(r, link) : buildUpdateMessage_(r, link);

    var sent = false;
    for (var c = 0; c < channels.length; c++) {
      if (!sectorMatches_(sectors, channels[c].sector)) continue;
      if (sendTelegram_(channels[c], msg)) sent = true;
      Utilities.sleep(CONFIG.TELEGRAM_SEND_DELAY_MS);
    }

    // Mark posted once processed so it's never reconsidered (a row that matched no
    // channel is still marked — the 'All Jobs' catch-all should match everything).
    setCell_(tab, columns, r._row, 'posted_at', new Date().toISOString());
    if (sent) count++;
  }
  return count;
}

// ─────────────────────────── setup helpers ──────────────────────────────────

/** Validate each row's bot_token via getMe (isolates a bad token from a bad chat id). */
function validateChannels() {
  ensureSheets();
  var rows = readObjects_(CONFIG.TAB_CHANNELS, CHANNEL_COLUMNS);
  if (!rows.length) { log_('validate: Channels tab is empty'); return; }
  rows.forEach(function (c) {
    var token = String(c.bot_token || '').trim();
    if (!token) { log_('validate "' + c.name + '": NO bot_token in column B'); return; }
    try {
      var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe', { muteHttpExceptions: true });
      var body = JSON.parse(resp.getContentText());
      if (body.ok) log_('validate "' + c.name + '": token OK → bot @' + body.result.username);
      else log_('validate "' + c.name + '": token INVALID (' + resp.getResponseCode() + ' ' + body.description + ')');
    } catch (e) {
      log_('validate "' + c.name + '": error ' + e);
    }
    Utilities.sleep(400);
  });
}

/** Send a test line to every active channel (verify tokens/ids/permissions). */
function testTelegramChannels() {
  ensureSheets();
  var channels = readChannels_();
  if (!channels.length) { log_('telegram test: no active channels'); return; }
  channels.forEach(function (ch) {
    var ok = sendTelegram_(ch, '<b>✅ JobsTrackr test</b>\nChannel "' + escapeHtml_(ch.name) + '" is wired up.');
    log_('telegram test → ' + ch.name + ': ' + (ok ? 'ok' : 'FAILED'));
    Utilities.sleep(CONFIG.TELEGRAM_SEND_DELAY_MS);
  });
}

/** Backfill posted_at on all existing rows so the historical backlog isn't blasted. */
function markAllPostedNow() {
  ensureSheets();
  var now = new Date().toISOString();
  [[CONFIG.TAB_JOBS, JOB_COLUMNS], [CONFIG.TAB_UPDATES, UPDATE_COLUMNS]].forEach(function (pair) {
    readObjects_(pair[0], pair[1]).forEach(function (r) {
      if (!r.posted_at) setCell_(pair[0], pair[1], r._row, 'posted_at', now);
    });
  });
  log_('telegram: marked existing rows as posted (backlog skipped)');
}
