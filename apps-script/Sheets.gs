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

/** Read rows of a data tab as objects where scraped_at > sinceIso (or all). */
function readSince(tabName, columns, sinceIso, limit) {
  const sh = getTab_(tabName, columns);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2, 1, last - 1, columns.length).getValues();
  const sidx = columns.indexOf('scraped_at');
  const out = [];
  for (let i = 0; i < data.length; i++) {
    // Sheets may coerce the ISO string into a Date — normalize back to ISO.
    const rawTs = data[i][sidx];
    const scrapedAt = rawTs instanceof Date ? rawTs.toISOString() : String(rawTs || '');
    if (sinceIso && scrapedAt && scrapedAt <= sinceIso) continue;
    const obj = {};
    columns.forEach(function (c, ci) {
      const v = data[i][ci];
      obj[c] = v instanceof Date ? v.toISOString() : v;
    });
    obj.scraped_at = scrapedAt;
    out.push(obj);
    if (limit && out.length >= limit) break;
  }
  return out;
}
