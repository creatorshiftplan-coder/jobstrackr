/**
 * Config.gs — constants for the FreeJobAlert scraper (Google Apps Script port).
 *
 * Ports the constants from the Python scraper (api/scraper_v5.py,
 * api/article_scraper.py, api/auto_discover_cron.py). The whole pipeline is
 * deterministic (no AI), so no API keys are needed — only the shared secret used
 * by the Web App endpoint that the Supabase sync function pulls from.
 *
 * Set the shared secret once in: Project Settings → Script Properties →
 *   SHEETS_SYNC_SECRET = <a long random string>
 * and use the SAME value in the Supabase `sync-sheets` function env.
 */

const CONFIG = {
  // Only this domain may be fetched (SSRF allowlist — api/auth.py ALLOWED_DOMAINS).
  ALLOWED_HOST: 'freejobalert.com',

  // Job listings discovery (api/auto_discover_cron.py).
  JOBS_LISTING_URL: 'https://www.freejobalert.com/new-updates/',
  // The /new-updates/ feed is a rolling, paginated list (~80 entries/page), newest
  // first. Discovery examines the newest JOBS_MAX_LINKS entries each run (walking
  // across pages as needed), enqueuing every *new* link. It also stops early once a
  // page is entirely already-known (caught up to a prior run). JOBS_MAX_PAGES is a
  // safety bound so a layout change can't make it crawl unbounded.
  JOBS_MAX_LINKS: 100,
  JOBS_MAX_PAGES: 10,

  // Exam/job-update feeds (supabase 20260505_exam_updates.sql scraper_sources seed).
  UPDATE_FEEDS: [
    'https://www.freejobalert.com/admit-card/',
    'https://www.freejobalert.com/exam-results/',
    'https://www.freejobalert.com/answer-key/',
    'https://www.freejobalert.com/latest-notifications/',
    'https://www.freejobalert.com/syllabus/',
  ],
  UPDATES_MAX_LINKS_PER_FEED: 30,

  // Per-trigger batch sizes (Apps Script has a 6-min execution limit — keep small).
  JOBS_BATCH: 8,        // chunk size read from the queue per loop
  UPDATES_BATCH: 8,
  MAX_RETRIES: 3,
  FETCH_DELAY_MS: 1200, // polite delay between article fetches
  // One processor invocation keeps draining batches until this much time has
  // elapsed, then stops (Apps Script hard-kills a run at ~6 min; this stays safe).
  // Consumer Google accounts: keep <= ~300000. Workspace allows up to ~1700000.
  MAX_RUNTIME_MS: 240000, // 4 minutes — leaves a ~2 min margin under the ~6 min hard limit

  // Whether to rule-based-rephrase update text (mirrors the Updates "rephrase" toggle).
  REPHRASE_UPDATES: true,

  // ── Telegram auto-post (Telegram.gs) ──────────────────────────────────────
  // Public site origin used to build in-app deep-links posted to Telegram.
  SITE_ORIGIN: 'https://jobstrackr.in',
  // Only post a row once it's old enough to have been imported into Supabase by
  // the hourly `sync-sheets` function — otherwise the deep-link would 404. Must be
  // safely longer than the sync interval (hourly). Default ~75 min.
  TELEGRAM_MIN_AGE_MS: 75 * 60 * 1000,
  // Rows posted per channel-send loop, and the polite gap between Telegram calls.
  TELEGRAM_SEND_DELAY_MS: 1200,

  // HTTP (api/scraper_v5.py + api/article_scraper.py headers).
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',

  // Explicit "missing data" markers — NEVER fabricate plausible values.
  NA_TEXT: 'Not Available',
  NA_DATE: 'TBD',

  // ── AI enrichment (AiEnrichment.gs) ───────────────────────────────────────
  // Rows are enriched in their own trigger, not inline in the scrape loop —
  // see AI below for the models/limits.

  // Sheet tab names.
  TAB_JOBS_QUEUE: 'JobsQueue',
  TAB_JOBS: 'Jobs',
  TAB_UPDATES_QUEUE: 'UpdatesQueue',
  TAB_UPDATES: 'ExamUpdates',
  TAB_CHANNELS: 'Channels',
  TAB_LOGS: 'Logs',
};

// Column order for the Jobs tab — maps to the `jobs` table (build_job_record in
// api/job_insert_helper.py). `job_metadata` is a JSON string. The last two are
// bookkeeping used by the sync cursor.
const JOB_COLUMNS = [
  'title', 'department', 'location', 'qualification', 'experience',
  'eligibility', 'description', 'salary_min', 'salary_max', 'age_min', 'age_max',
  'application_fee', 'vacancies', 'vacancies_display', 'application_start_date',
  'last_date', 'last_date_display', 'apply_link', 'official_website',
  'is_featured', 'auto_discovered', 'job_metadata',
  'source_url', 'scraped_at',
  // Telegram poster bookkeeping (appended last so existing sheets stay aligned):
  // `slug` is the deep-link slug (synced into jobs.slug); `posted_at` is set once
  // the row has been broadcast to Telegram so it's never reposted.
  'slug', 'posted_at',
  // AI enrichment (AiEnrichment.gs) — computed in the Sheet so a row reaches
  // Supabase already summarised and embedded. `required_skills` is a JSON array
  // string, `embedding` a JSON array of 384 floats, both parsed by sync-sheets.
  // `ai_attempts` is local bookkeeping only (never synced) so a row the model
  // can't summarise is retried a bounded number of times.
  // APPEND-ONLY: adding a column anywhere but the end shifts every existing
  // cell in the tab. New columns always go last — ensureSheets() widens the
  // header row of an existing sheet to match (see ensureColumns_ in Sheets.gs).
  'eligibility_summary', 'required_skills', 'embedding', 'ai_attempts',
];

// ── AI enrichment settings (AiEnrichment.gs) ─────────────────────────────────
const AI = {
  // Chat model fallback chain — same order as supabase/functions/groq-summarize.
  MODELS: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  // Embeddings are OFF, and must stay off while Groq is the provider: Groq
  // answers `nomic-embed-text-v1.5` with 404 "model does not exist" — it serves
  // chat completions but no embedding model. Every embedding call was therefore
  // guaranteed to fail, and each failure still cost a full key-rotation sweep
  // (~7s of Apps Script runtime per row) for nothing. Leave false unless you
  // move embeddings to a provider that actually serves them.
  // `jobs.embedding` keeps being filled by the process-embeddings edge function.
  EMBED_ENABLED: false,
  // Must match process-embeddings/index.ts: the `jobs.embedding` column is
  // vector(384), Matryoshka-sliced from this model's 768 dims.
  EMBED_MODEL: 'nomic-embed-text-v1.5',
  EMBED_DIMS: 384,
  // How many GROQ_API_KEY_N properties to look for (you have 9).
  MAX_KEYS: 9,
  // Give up on a row after this many enrichment passes so an un-summarisable
  // row can't block the queue forever.
  MAX_ATTEMPTS: 3,
  // Polite gap between rows — Groq's free tier is requests-per-minute limited.
  CALL_DELAY_MS: 1500,
  // Sheet rows examined per run. The cursor wraps, so the whole tab is still
  // covered over successive runs. Scanning is NEWEST-FIRST (see
  // readRecentWindow_ in Sheets.gs) because the tab is append-only, so the open
  // vacancies are the ones at the end.
  SCAN_WINDOW: 300,

  // Only summarise jobs still open for applications. The daily Apps Script
  // runtime budget is tiny (see below), and a closed vacancy's summary helps
  // nobody apply — so expired rows are skipped rather than spending the quota on
  // them. A row whose last_date is blank / "TBD" / unparseable counts as OPEN:
  // wrongly skipping a live job is worse than wrongly enriching a dead one.
  SKIP_EXPIRED: true,
  // Days after last_date a job still counts as active. 0 = expires the day after
  // its deadline. Raise to keep just-closed jobs eligible for a while.
  EXPIRY_GRACE_DAYS: 0,

  // ── Apps Script runtime budget — READ THIS BEFORE RAISING ANYTHING ────────
  // A consumer Google account gets ~90 MINUTES of total script runtime PER DAY,
  // shared by EVERY trigger in the project. Enrichment is the only handler here
  // that blocks on a network round-trip per row, so it burns that budget far
  // faster than the scrapers do.
  //
  // Learned the hard way on 2026-08-06: this pass ran every 30 min with the
  // scrapers' 4-minute budget (~8 min/hour on top of ~16 min/hour of scraping).
  // The daily quota was gone by 16:20 and EVERY trigger in the project — job
  // discovery, queue processing, Telegram, sync feed — went silent for the rest
  // of the day. Enrichment starving the scraper is a far worse outcome than
  // enrichment simply being slow.
  //
  // 60s × 6 runs/day ≈ 6 min/day, a small slice of the 90. Backfilling the whole
  // tab this way takes weeks — that is intentional. For a bulk backfill use the
  // groq-summarize edge function (Admin panel), which costs no Apps Script quota.
  MAX_RUNTIME_MS: 60000,   // per run — NOT CONFIG.MAX_RUNTIME_MS (that's 4 min)
  TRIGGER_EVERY_HOURS: 4,  // 6 runs/day
};

// Column order for the ExamUpdates tab — maps to the `exam_updates` table
// (saveArticle in src/hooks/useGovtJobScraper.ts + api/article_scraper.py).
// JSON columns are stored as JSON strings.
const UPDATE_COLUMNS = [
  'url', 'title', 'category', 'status', 'published_date', 'summary', 'full_text',
  'important_dates', 'overview', 'vacancy_table', 'fee_table', 'eligibility_table',
  'cutoff_table', 'download_links', 'official_links', 'related_links', 'images',
  'tags', 'sections', 'related_articles', 'scraped_at',
  // Telegram poster bookkeeping (see JOB_COLUMNS note). `slug` syncs into
  // exam_updates.slug and powers the /exam-update/<slug> deep-link.
  'slug', 'posted_at',
];

const QUEUE_COLUMNS = ['url', 'status', 'retry_count', 'discovered_at'];

// Channels tab — one row per Telegram destination. `sector` matches the labels
// the poster's matcher emits ('All Jobs' / 'Government Jobs' / 'Sarkari Naukri'
// catch everything; e.g. 'SSC', 'Banking Jobs', 'Railway Jobs' narrow it).
// `active` is 'yes'/'no' (blank = yes).
const CHANNEL_COLUMNS = ['name', 'bot_token', 'channel_id', 'sector', 'active'];
