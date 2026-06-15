/**
 * Triggers.gs — orchestration + time-driven (cron) triggers.
 *
 * Mirrors the Python cron model: a periodic "discover" phase (every 2h) fills the
 * queue tabs, and a frequent "process" phase scrapes a small batch (Apps Script has
 * a 6-min execution limit, so batches are kept small — see CONFIG.*_BATCH).
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
  // Discover every 2 hours, not once a day: /new-updates/ is a rolling feed, so a
  // daily snapshot misses everything posted-and-buried between runs. Each run scans
  // the newest JOBS_MAX_LINKS (~100) entries. Discovery only fetches listing pages +
  // dedups, so it's cheap to run often.
  ScriptApp.newTrigger('discoverJobs').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('discoverUpdates').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('processJobsQueue').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('processUpdatesQueue').timeBased().everyMinutes(30).create();
  // Telegram poster — runs hourly, posts rows old enough to have synced to Supabase
  // (TELEGRAM_MIN_AGE_MS gate) so the deep-links resolve. Dedups via posted_at.
  ScriptApp.newTrigger('postPendingToTelegram').timeBased().everyHours(1).create();
}

// ─────────────────────────── jobs ───────────────────────────────────────────

function discoverJobs() {
  ensureSheets();
  // Scan the newest JOBS_MAX_LINKS (~100) entries of the rolling /new-updates/ feed,
  // walking across pages as needed (~80/page), and enqueue every link not already
  // scraped. Stops early once a page is entirely already-known (caught up to a prior
  // run); JOBS_MAX_PAGES is a final safety bound. This replaces the old "first 50
  // links of page 1 only" logic, which silently dropped every entry past the 50th
  // and every later page.
  const known = existingValues_(CONFIG.TAB_JOBS, JOB_COLUMNS, 'source_url');
  const visited = {};
  let pageUrl = CONFIG.JOBS_LISTING_URL;
  let pages = 0, totalFound = 0, totalQueued = 0;
  let remaining = CONFIG.JOBS_MAX_LINKS; // examine only the newest N entries of the feed

  while (pageUrl && pages < CONFIG.JOBS_MAX_PAGES && remaining > 0) {
    if (visited[pageUrl]) break; // guard against pagination loops
    visited[pageUrl] = true;
    pages++;

    const html = fetchHtml(pageUrl, 2);
    if (!html) { log_('discoverJobs: could not fetch ' + pageUrl); break; }

    let links = extractListingLinks(html, pageUrl);
    if (links.length > remaining) links = links.slice(0, remaining); // honour the first-N cap
    remaining -= links.length;
    totalFound += links.length;
    const fresh = links.map(function (l) { return l.url; }).filter(function (u) {
      const k = u.toLowerCase();
      if (known[k]) return false;
      known[k] = true; // mark now so later pages in this run don't re-add
      return true;
    });
    totalQueued += enqueueUrls(CONFIG.TAB_JOBS_QUEUE, fresh);

    // A page with links but nothing new → we've reached previously-discovered
    // territory; older pages hold only older (already-known) jobs, so stop.
    if (links.length && fresh.length === 0) break;
    if (remaining <= 0) break; // hit the first-N cap

    // Walk to the next page: first pagination target we haven't visited yet.
    const pageLinks = paginationUrls_(html, pageUrl);
    pageUrl = '';
    for (let i = 0; i < pageLinks.length; i++) {
      if (!visited[pageLinks[i]]) { pageUrl = pageLinks[i]; break; }
    }
    if (pageUrl) Utilities.sleep(CONFIG.FETCH_DELAY_MS);
  }

  log_('discoverJobs: pages ' + pages + ', found ' + totalFound + ', queued ' + totalQueued);
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
