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
 *   → { ok:true, since, jobs:[...], updates:[...] }
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

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, since: since, jobs: jobs, updates: updates }))
    .setMimeType(ContentService.MimeType.JSON);
}
