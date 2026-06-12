/**
 * WebApp.gs — secret-protected JSON endpoint the Supabase `sync-sheets` function pulls.
 *
 * Deploy: Deploy → New deployment → Web app → Execute as "Me",
 * Who has access "Anyone". Copy the /exec URL into the Supabase function env as
 * APPS_SCRIPT_WEBAPP_URL. The shared secret lives in Script Properties
 * (SHEETS_SYNC_SECRET) and must match SHEETS_SYNC_SECRET on the Supabase side.
 *
 * GET <url>/exec?secret=<secret>&since=<ISO timestamp>&limit=<n>
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
  const limit = params.limit ? parseInt(params.limit, 10) : 0;

  const jobs = readSince(CONFIG.TAB_JOBS, JOB_COLUMNS, since, limit);
  const updates = readSince(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, since, limit);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, since: since, jobs: jobs, updates: updates }))
    .setMimeType(ContentService.MimeType.JSON);
}
