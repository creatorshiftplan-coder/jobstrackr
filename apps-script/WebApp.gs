/**
 * WebApp.gs — secret-protected JSON endpoint the Supabase `sync-sheets` function pulls.
 *
 * Deploy: Deploy → New deployment → Web app → Execute as "Me",
 * Who has access "Anyone". Copy the /exec URL into the Supabase function env as
 * APPS_SCRIPT_WEBAPP_URL. The shared secret lives in Script Properties
 * (SHEETS_SYNC_SECRET) and must match SHEETS_SYNC_SECRET on the Supabase side.
 *
 * GET <url>/exec?secret=<secret>&since=<ISO>&limit=<n>
 *   Cursor + batch params (jobs and updates page independently):
 *     since         — fallback cursor for both feeds
 *     sinceJobs     — cursor for the Jobs feed (defaults to `since`)
 *     sinceUpdates  — cursor for the ExamUpdates feed (defaults to `since`)
 *     limit         — fallback per-feed cap for both feeds (0 = no cap)
 *     jobsLimit     — per-feed cap for Jobs (defaults to `limit`)
 *     updatesLimit  — per-feed cap for ExamUpdates (defaults to `limit`)
 *     logs          — if set (e.g. logs=100), also return the newest N lines of
 *                     the Logs tab (trigger/scraper diagnostics)
 *   → { ok:true, since, jobs:[...], updates:[...], logs?:[...] }
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const expected = PropertiesService.getScriptProperties().getProperty('SHEETS_SYNC_SECRET');

  if (!expected || params.secret !== expected) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const since = params.since || '';
  const sinceJobs = params.sinceJobs || since;
  const sinceUpdates = params.sinceUpdates || since;
  const baseLimit = params.limit ? parseInt(params.limit, 10) : 0;
  const jobsLimit = params.jobsLimit ? parseInt(params.jobsLimit, 10) : baseLimit;
  const updatesLimit = params.updatesLimit ? parseInt(params.updatesLimit, 10) : baseLimit;

  const jobs = readSince(CONFIG.TAB_JOBS, JOB_COLUMNS, sinceJobs, jobsLimit);
  const updates = readSince(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, sinceUpdates, updatesLimit);

  const out = { ok: true, since: since, jobs: jobs, updates: updates };
  if (params.logs) out.logs = readLogTail_(parseInt(params.logs, 10) || 50);

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Newest-first tail of the Logs tab, for remote diagnostics via ?logs=N. */
function readLogTail_(n) {
  const sh = getTab_(CONFIG.TAB_LOGS, ['ts', 'message']);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const count = Math.min(n, last - 1);
  const vals = sh.getRange(last - count + 1, 1, count, 2).getValues();
  return vals.reverse().map(function (r) {
    const ts = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
    return ts + ' ' + String(r[1]);
  });
}
