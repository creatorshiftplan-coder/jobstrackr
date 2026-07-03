/**
 * Sheets.gs — Google Sheets storage: tab setup, append, queue, dedup, cursor reads.
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/** Get a tab, creating it with the given header row if missing. */
function getTab_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Create all required tabs once. */
function ensureSheets() {
  getTab_(CONFIG.TAB_JOBS_QUEUE, QUEUE_COLUMNS);
  getTab_(CONFIG.TAB_JOBS, JOB_COLUMNS);
  getTab_(CONFIG.TAB_UPDATES_QUEUE, QUEUE_COLUMNS);
  getTab_(CONFIG.TAB_UPDATES, UPDATE_COLUMNS);
  getTab_(CONFIG.TAB_CHANNELS, CHANNEL_COLUMNS);
  getTab_(CONFIG.TAB_LOGS, ['ts', 'message']);
}

/** Append a timestamped line to the Logs tab (also used by fetchHtml). */
function log_(message) {
  try {
    const sh = getTab_(CONFIG.TAB_LOGS, ['ts', 'message']);
    sh.appendRow([new Date().toISOString(), String(message)]);
    // Keep the log from growing unbounded.
    const max = 2000;
    const n = sh.getLastRow();
    if (n > max + 1) sh.deleteRows(2, n - max - 1);
  } catch (e) {
    // never let logging break a run
  }
}

/** Append one object as a row, following the column order. */
function appendObject_(tabName, columns, obj) {
  const sh = getTab_(tabName, columns);
  sh.appendRow(columns.map(function (c) { return obj[c] == null ? '' : obj[c]; }));
}

/** Return a Set-like map of existing values for a column (lowercased). */
function existingValues_(tabName, columns, colName) {
  const sh = getTab_(tabName, columns);
  const idx = columns.indexOf(colName);
  const last = sh.getLastRow();
  const set = {};
  if (last < 2 || idx < 0) return set;
  const vals = sh.getRange(2, idx + 1, last - 1, 1).getValues();
  vals.forEach(function (r) { const v = String(r[0] || '').trim().toLowerCase(); if (v) set[v] = true; });
  return set;
}

// Columns that hold a true timestamp (date + time). These must serialize as a full
// ISO instant so the sync cursor and oldest-first ordering keep working.
const TIMESTAMP_COLUMNS_ = { scraped_at: true, posted_at: true, discovered_at: true };

/**
 * Serialize one cell value for the JSON feed.
 *
 * Google Sheets silently coerces any date-looking text (e.g. "2026-06-30") into a
 * real Date cell. Blanket-stringifying those with toISOString() yields a
 * UTC-shifted "2026-06-29T18:30:00.000Z" — IST midnight expressed in UTC, i.e. the
 * WRONG calendar day and an ugly value to store/display. So:
 *   • timestamp columns  → full ISO (UTC); the cursor needs the exact instant
 *   • every other column → plain "yyyy-MM-dd" in the spreadsheet's own timezone,
 *     which is the calendar date the poster actually typed
 * Non-Date values pass through unchanged.
 */
function serializeCell_(colName, v) {
  if (!(v instanceof Date)) return v;
  if (TIMESTAMP_COLUMNS_[colName]) return v.toISOString();
  return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

/** Read a whole data tab as objects, each tagged with its 1-based sheet row in `_row`. */
function readObjects_(tabName, columns) {
  const sh = getTab_(tabName, columns);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2, 1, last - 1, columns.length).getValues();
  return data.map(function (rowVals, i) {
    const obj = { _row: i + 2 };
    columns.forEach(function (c, ci) {
      obj[c] = serializeCell_(c, rowVals[ci]);
    });
    return obj;
  });
}

/** Write one cell by column name on a given 1-based row. */
function setCell_(tabName, columns, row, colName, value) {
  const idx = columns.indexOf(colName);
  if (idx < 0) return;
  getTab_(tabName, columns).getRange(row, idx + 1).setValue(value);
}

// ─────────────────────────── queue ──────────────────────────────────────────

/** Add new pending URLs to a queue tab, skipping ones already queued. */
function enqueueUrls(queueTab, urls) {
  const sh = getTab_(queueTab, QUEUE_COLUMNS);
  const known = existingValues_(queueTab, QUEUE_COLUMNS, 'url');
  const now = new Date().toISOString();
  let added = 0;
  urls.forEach(function (u) {
    const key = String(u || '').trim().toLowerCase();
    if (!key || known[key]) return;
    known[key] = true;
    sh.appendRow([u, 'pending', 0, now]);
    added++;
  });
  return added;
}

/** Read up to n pending queue rows → [{ url, retry, row }]. */
function takePending(queueTab, n) {
  const sh = getTab_(queueTab, QUEUE_COLUMNS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2, 1, last - 1, QUEUE_COLUMNS.length).getValues();
  const out = [];
  for (let i = 0; i < data.length && out.length < n; i++) {
    if (String(data[i][1]) === 'pending') out.push({ url: data[i][0], retry: Number(data[i][2]) || 0, row: i + 2 });
  }
  return out;
}

function setQueueStatus(queueTab, row, status, retry) {
  const sh = getTab_(queueTab, QUEUE_COLUMNS);
  sh.getRange(row, 2).setValue(status);
  if (retry != null) sh.getRange(row, 3).setValue(retry);
}

/**
 * Trim finished work out of a queue tab so it can't grow without bound — every
 * trigger run re-reads the whole tab, so an ever-growing queue slowly taxes all
 * of them. Deletes 'done'/'duplicate' rows older than 3 days and 'failed' rows
 * older than 14 days (kept a while for visibility); 'pending'/'processing' rows
 * are never touched. Rows are removed bottom-up in contiguous runs so sheet row
 * indices stay valid during the pass.
 * Returns { purged, failed, pending } — failed/pending are current counts, for
 * the caller's log line.
 */
function purgeQueue_(queueTab) {
  const DONE_KEEP_MS = 3 * 864e5, FAILED_KEEP_MS = 14 * 864e5;
  const sh = getTab_(queueTab, QUEUE_COLUMNS);
  const last = sh.getLastRow();
  const out = { purged: 0, failed: 0, pending: 0 };
  if (last < 2) return out;
  const data = sh.getRange(2, 1, last - 1, QUEUE_COLUMNS.length).getValues();
  const del = [];
  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][1]);
    const ts = tsMs_(data[i][3]) || 0; // discovered_at
    if (status === 'failed') out.failed++;
    else if (status === 'pending') out.pending++;
    if ((status === 'done' || status === 'duplicate') && Date.now() - ts > DONE_KEEP_MS) del.push(i + 2);
    else if (status === 'failed' && Date.now() - ts > FAILED_KEEP_MS) { del.push(i + 2); out.failed--; }
  }
  let i = del.length - 1;
  while (i >= 0) {
    let end = del[i], start = del[i];
    while (i > 0 && del[i - 1] === start - 1) { i--; start = del[i]; }
    sh.deleteRows(start, end - start + 1);
    out.purged += end - start + 1;
    i--;
  }
  return out;
}

/**
 * Self-heal: reset any rows left on 'processing' back to 'pending'.
 * If a run is hard-killed by Apps Script's 6-min limit mid-item, that item
 * stays 'processing'; calling this at the start of every processor run requeues
 * it so nothing is ever lost. Dedup (rebuilt from the data tab each run) keeps a
 * re-processed item from creating a duplicate.
 */
function requeueStuck(queueTab) {
  const sh = getTab_(queueTab, QUEUE_COLUMNS);
  const last = sh.getLastRow();
  if (last < 2) return;
  const range = sh.getRange(2, 2, last - 1, 1); // status column
  const vals = range.getValues();
  let changed = false;
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === 'processing') { vals[i][0] = 'pending'; changed = true; }
  }
  if (changed) range.setValues(vals);
}

// ─────────────────────────── cursor reads (for the Web App) ──────────────────

/**
 * Parse a timestamp to epoch ms for comparison, or null if unparseable.
 *
 * The cursor and the sheet's stored timestamps reach this function in DIFFERENT
 * serializations: the sheet produces `new Date().toISOString()` ("…Z" / UTC),
 * while the cursor round-trips through Supabase's TIMESTAMPTZ column and comes
 * back from PostgREST as "…+00:00". A lexicographic string compare of those two
 * forms is wrong — they're identical up to the seconds, then 'Z' (90) > '+' (43),
 * so a row would read as *newer* than a cursor pointing at the same instant and be
 * re-fetched every run. Comparing parsed epoch ms makes the two forms equal.
 */
function tsMs_(v) {
  if (v == null || v === '') return null;
  const t = (v instanceof Date) ? v.getTime() : Date.parse(String(v));
  return isNaN(t) ? null : t;
}

/**
 * Read rows of a data tab as objects where scraped_at > sinceIso (or all).
 *
 * Rows are returned **oldest-first** so the caller can page through with a cursor:
 * take a batch, advance the cursor to the last row's scraped_at, and resume there
 * next time. Combined with the exclusive `scraped_at <= sinceIso` filter this is
 * keyset pagination — no row is ever skipped. Comparison is by parsed epoch ms
 * (see tsMs_) so a "…Z" sheet value and a "…+00:00" cursor for the same instant
 * compare equal.
 *
 * `limit` is a *soft* cap: if the row at the limit boundary shares its scraped_at
 * with later rows, those ties are included too. Splitting a group of equal
 * timestamps would strand the rows left behind (the next cursor would be == their
 * scraped_at and the exclusive filter would drop them), so ties are kept together.
 */
function readSince(tabName, columns, sinceIso, limit) {
  const sh = getTab_(tabName, columns);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2, 1, last - 1, columns.length).getValues();
  const sidx = columns.indexOf('scraped_at');
  const sinceMs = tsMs_(sinceIso);

  const matched = [];
  for (let i = 0; i < data.length; i++) {
    // Sheets may coerce the ISO string into a Date — normalize back to ISO.
    const rawTs = data[i][sidx];
    const scrapedAt = rawTs instanceof Date ? rawTs.toISOString() : String(rawTs || '');
    const scrapedMs = tsMs_(scrapedAt);
    if (sinceMs != null && scrapedMs != null && scrapedMs <= sinceMs) continue;
    const obj = {};
    columns.forEach(function (c, ci) {
      obj[c] = serializeCell_(c, data[i][ci]);
    });
    obj.scraped_at = scrapedAt;
    obj._ms = scrapedMs; // sort/tie key; stripped before returning
    matched.push(obj);
  }

  // Oldest-first for stable cursor paging (unparseable timestamps sort first).
  matched.sort(function (a, b) {
    return (a._ms == null ? -Infinity : a._ms) - (b._ms == null ? -Infinity : b._ms);
  });

  let result;
  if (!limit || matched.length <= limit) {
    result = matched;
  } else {
    // Cut at `limit`, then extend through any rows sharing the boundary timestamp.
    let end = limit;
    const boundaryMs = matched[limit - 1]._ms;
    while (end < matched.length && matched[end]._ms === boundaryMs) end++;
    result = matched.slice(0, end);
  }

  result.forEach(function (o) { delete o._ms; });
  return result;
}
