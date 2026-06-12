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
  JOBS_MAX_LINKS: 50,

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

  // HTTP (api/scraper_v5.py + api/article_scraper.py headers).
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',

  // Explicit "missing data" markers — NEVER fabricate plausible values.
  NA_TEXT: 'Not Available',
  NA_DATE: 'TBD',

  // Sheet tab names.
  TAB_JOBS_QUEUE: 'JobsQueue',
  TAB_JOBS: 'Jobs',
  TAB_UPDATES_QUEUE: 'UpdatesQueue',
  TAB_UPDATES: 'ExamUpdates',
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
];

// Column order for the ExamUpdates tab — maps to the `exam_updates` table
// (saveArticle in src/hooks/useGovtJobScraper.ts + api/article_scraper.py).
// JSON columns are stored as JSON strings.
const UPDATE_COLUMNS = [
  'url', 'title', 'category', 'status', 'published_date', 'summary', 'full_text',
  'important_dates', 'overview', 'vacancy_table', 'fee_table', 'eligibility_table',
  'cutoff_table', 'download_links', 'official_links', 'related_links', 'images',
  'tags', 'sections', 'related_articles', 'scraped_at',
];

const QUEUE_COLUMNS = ['url', 'status', 'retry_count', 'discovered_at'];
