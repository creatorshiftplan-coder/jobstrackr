/**
 * Triggers.gs — orchestration + time-driven (cron) triggers.
 *
 * Mirrors the Python cron model: a daily "discover" phase fills the queue tabs,
 * and a frequent "process" phase scrapes a small batch (Apps Script has a 6-min
 * execution limit, so batches are kept small — see CONFIG.*_BATCH).
 *
 * One-time setup: run `setup` once (creates tabs + installs triggers).
 */

function setup() {
  ensureSheets();
  installTriggers();
  log_('setup complete — tabs ensured, triggers installed');
}

/** Install time-driven triggers (clears any previous ones first). */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('discoverJobs').timeBased().everyDays(1).atHour(1).create();
  ScriptApp.newTrigger('discoverUpdates').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('processJobsQueue').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('processUpdatesQueue').timeBased().everyMinutes(30).create();
  // Telegram poster — runs hourly, posts rows old enough to have synced to Supabase
  // (TELEGRAM_MIN_AGE_MS gate) so the deep-links resolve. Dedups via posted_at.
  ScriptApp.newTrigger('postPendingToTelegram').timeBased().everyHours(1).create();
}

// ─────────────────────────── jobs ───────────────────────────────────────────

function discoverJobs() {
  ensureSheets();
  const html = fetchHtml(CONFIG.JOBS_LISTING_URL, 2);
  if (!html) { log_('discoverJobs: could not fetch listing'); return; }
  const links = extractListingLinks(html, CONFIG.JOBS_LISTING_URL).slice(0, CONFIG.JOBS_MAX_LINKS);
  const known = existingValues_(CONFIG.TAB_JOBS, JOB_COLUMNS, 'source_url');
  const fresh = links.map(function (l) { return l.url; }).filter(function (u) { return !known[u.toLowerCase()]; });
  const added = enqueueUrls(CONFIG.TAB_JOBS_QUEUE, fresh);
  log_('discoverJobs: found ' + links.length + ', queued ' + added);
}

function processJobsQueue() {
  ensureSheets();
  requeueStuck(CONFIG.TAB_JOBS_QUEUE); // self-heal items stranded by a prior hard-kill
  const deadline = Date.now() + CONFIG.MAX_RUNTIME_MS;
  const knownTitles = existingValues_(CONFIG.TAB_JOBS, JOB_COLUMNS, 'title');
  const knownSlugs = existingValues_(CONFIG.TAB_JOBS, JOB_COLUMNS, 'slug'); // reserve unique deep-link slugs
  let processed = 0;
  while (Date.now() < deadline) {
    const batch = takePending(CONFIG.TAB_JOBS_QUEUE, CONFIG.JOBS_BATCH);
    if (!batch.length) break; // queue drained
    for (let i = 0; i < batch.length; i++) {
      if (Date.now() >= deadline) break;
      const item = batch[i];
      setQueueStatus(CONFIG.TAB_JOBS_QUEUE, item.row, 'processing');
      try {
        const html = fetchHtml(item.url, 2);
        if (!html) throw new Error('fetch failed');
        const scraped = parseJobPage(item.url, html);
        const rowObj = buildJobRow(scraped, item.url);
        const titleKey = String(rowObj.title || '').trim().toLowerCase();
        if (titleKey && knownTitles[titleKey]) {
          setQueueStatus(CONFIG.TAB_JOBS_QUEUE, item.row, 'duplicate');
        } else {
          // Compute the deep-link slug now so it's in the Sheet before the sync
          // imports the row — keeps the Telegram link and jobs.slug identical.
          rowObj.slug = uniqueSlug_(makeJobSlug_(rowObj.title), knownSlugs);
          appendObject_(CONFIG.TAB_JOBS, JOB_COLUMNS, rowObj);
          knownTitles[titleKey] = true;
          setQueueStatus(CONFIG.TAB_JOBS_QUEUE, item.row, 'done');
        }
        processed++;
      } catch (err) {
        const retry = item.retry + 1;
        setQueueStatus(CONFIG.TAB_JOBS_QUEUE, item.row, retry >= CONFIG.MAX_RETRIES ? 'failed' : 'pending', retry);
        log_('processJobsQueue error ' + item.url + ': ' + err);
      }
      Utilities.sleep(CONFIG.FETCH_DELAY_MS);
    }
  }
  log_('processJobsQueue: processed ' + processed);
}

// ─────────────────────────── updates ────────────────────────────────────────

function discoverUpdates() {
  ensureSheets();
  let total = 0;
  CONFIG.UPDATE_FEEDS.forEach(function (feed) {
    const html = fetchHtml(feed, 2);
    if (!html) { log_('discoverUpdates: could not fetch ' + feed); return; }
    const links = extractListingLinks(html, feed).slice(0, CONFIG.UPDATES_MAX_LINKS_PER_FEED);
    const known = existingValues_(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, 'url');
    const fresh = links.map(function (l) { return l.url; }).filter(function (u) { return !known[u.toLowerCase()]; });
    total += enqueueUrls(CONFIG.TAB_UPDATES_QUEUE, fresh);
    Utilities.sleep(CONFIG.FETCH_DELAY_MS);
  });
  log_('discoverUpdates: queued ' + total);
}

function processUpdatesQueue() {
  ensureSheets();
  requeueStuck(CONFIG.TAB_UPDATES_QUEUE); // self-heal items stranded by a prior hard-kill
  const deadline = Date.now() + CONFIG.MAX_RUNTIME_MS;
  const knownUrls = existingValues_(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, 'url');
  const knownSlugs = existingValues_(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, 'slug'); // reserve unique deep-link slugs
  let processed = 0;
  while (Date.now() < deadline) {
    const batch = takePending(CONFIG.TAB_UPDATES_QUEUE, CONFIG.UPDATES_BATCH);
    if (!batch.length) break; // queue drained
    for (let i = 0; i < batch.length; i++) {
      if (Date.now() >= deadline) break;
      const item = batch[i];
      setQueueStatus(CONFIG.TAB_UPDATES_QUEUE, item.row, 'processing');
      try {
        const key = String(item.url).trim().toLowerCase();
        if (knownUrls[key]) {
          setQueueStatus(CONFIG.TAB_UPDATES_QUEUE, item.row, 'duplicate');
        } else {
          const html = fetchHtml(item.url, 2);
          if (!html) throw new Error('fetch failed');
          const scraped = scrapeUpdateArticle(item.url, html);
          const rowObj = buildUpdateRow(scraped);
          rowObj.slug = uniqueSlug_(makeUpdateSlug_(rowObj.title, rowObj.category), knownSlugs);
          appendObject_(CONFIG.TAB_UPDATES, UPDATE_COLUMNS, rowObj);
          knownUrls[key] = true;
          setQueueStatus(CONFIG.TAB_UPDATES_QUEUE, item.row, 'done');
          processed++;
        }
      } catch (err) {
        const retry = item.retry + 1;
        setQueueStatus(CONFIG.TAB_UPDATES_QUEUE, item.row, retry >= CONFIG.MAX_RETRIES ? 'failed' : 'pending', retry);
        log_('processUpdatesQueue error ' + item.url + ': ' + err);
      }
      Utilities.sleep(CONFIG.FETCH_DELAY_MS);
    }
  }
  log_('processUpdatesQueue: processed ' + processed);
}

/** Manual helper: run discovery for both feeds now (for testing). */
function discoverAllNow() { discoverJobs(); discoverUpdates(); }
