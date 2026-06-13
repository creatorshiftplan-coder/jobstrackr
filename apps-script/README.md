# FreeJobAlert scraper — Google Apps Script + Sheets → Supabase sync

Moves all scraping **off** Vercel/Supabase into Google Apps Script + Google Sheets
(free, isolated compute). Apps Script scrapes job listings and exam/job updates into a
Sheet on a schedule; a Supabase Edge Function (`sync-sheets`) pulls the new rows **once an
hour** and bulk-upserts them into the `jobs` / `exam_updates` tables. The app reads
Supabase exactly as before (via the existing Redis-cached `/api/cache/*` endpoints) — so
nothing in the app changes, but Supabase only takes one batched import per hour instead of
continuous per-item scraping load.

This is a faithful port of the Python scraper (`api/scraper_v5.py`, `api/scraper_v3.py`,
`api/article_scraper.py`, `api/rephraser.py`, `api/job_insert_helper.py`). It uses **no AI**
— pure regex/HTML parsing — so no API keys are needed.

## Files (paste into the Apps Script editor)

| File | Role |
|------|------|
| `Config.gs` | Constants: source URLs, allowlist, batch sizes, sheet tabs, column maps |
| `Html.gs` | HTTP fetch (allowlist-guarded) + regex HTML/table/section/link helpers + date/salary/age/location parsers |
| `JobScraper.gs` | Job listing discovery + `parse_page` + `build_job_record` (no fabricated fallbacks) |
| `UpdateScraper.gs` | Exam/job-update article scraping + category/table/link classification + sections |
| `Rephraser.gs` | Rule-based (non-AI) rephraser for update text |
| `Sheets.gs` | Sheet tabs, append, queue, dedup, cursor reads, logging |
| `WebApp.gs` | Secret-protected `doGet` JSON endpoint the sync function pulls |
| `Triggers.gs` | `setup()` + cron orchestration (discover daily, process every 30 min, Telegram hourly) |
| `Telegram.gs` | Posts new jobs/updates to Telegram channels with in-app deep-links (slug, matcher, dedup) |

## Setup

### A. Google Apps Script
1. Create a Google Sheet → **Extensions → Apps Script**.
2. Create the 9 script files above and paste each file's contents.
3. **Project Settings → Script Properties → Add**: `SHEETS_SYNC_SECRET` = a long random
   string (remember it; the Supabase side uses the same value).
4. Back in the editor, run **`setup`** once and authorize. It creates the tabs
   (`JobsQueue`, `Jobs`, `UpdatesQueue`, `ExamUpdates`, `Channels`, `Logs`) and installs the triggers.
5. Test now (don't wait for cron): run `discoverAllNow`, then `processJobsQueue` and
   `processUpdatesQueue`. Check the `Jobs` / `ExamUpdates` tabs fill in, columns line up,
   and that **no freejobalert names/links** appear and junk links are stripped.
6. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**.
   Copy the `…/exec` URL.

### B. Supabase
1. Set function secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
   - `APPS_SCRIPT_WEBAPP_URL` = the `…/exec` URL from A‑6
   - `SHEETS_SYNC_SECRET` = the same secret as A‑3
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)
2. Deploy the function with the gateway JWT check OFF (it does its own secret check):
   `supabase functions deploy sync-sheets --no-verify-jwt`
   (the committed `config.toml` already sets `verify_jwt = false`).
3. Apply the migration `supabase/migrations/20260612_sync_sheets.sql` (or `supabase db push`).
   It creates `sheet_sync_state` and schedules `sync-sheets-hourly` via pg_cron. The cron
   block needs `pg_cron` + the vault secrets `supabase_url` and `service_role_key` (same as
   the existing `process-embeddings-10m` job); if pg_cron isn't enabled it no-ops and you
   can schedule it from the Dashboard.
4. Test the sync manually with the shared secret (NOT the Dashboard "Invoke", which sends
   the anon key and will 401):
   ```bash
   curl -X POST "https://<project>.supabase.co/functions/v1/sync-sheets" \
     -H "x-sync-secret: <SHEETS_SYNC_SECRET>"
   ```
   Confirm rows appear in `jobs` / `exam_updates`, slugs auto-generate, and a second run
   does not create duplicates (jobs dedup by title, updates upsert by `url`). The hourly
   pg_cron call authenticates with the service-role key from vault — both paths are
   accepted.

> **Auth:** `sync-sheets` accepts either the `x-sync-secret` header (= `SHEETS_SYNC_SECRET`)
> or a `Bearer <service-role key>` token. A 401 means neither was presented — e.g. invoking
> from the Dashboard or curling with the anon key.

### C. Telegram auto-post (direct from the Sheet)

Posts every new job/update straight to your Telegram channels from Apps Script — no app or
edge function involved — with an **in-app deep-link** built from a slug computed at scrape
time. The slug is written into the Sheet before the sync runs, so `jobs.slug` /
`exam_updates.slug` match the link exactly.

1. Apply both slug migrations and redeploy `sync-sheets`:
   - `20260613_job_slug_respect_provided.sql` (jobs keep a sheet-provided slug)
   - `20260613_exam_update_slug.sql` (adds `exam_updates.slug` + the `/exam-update/<slug>` route)
2. In Apps Script, re-paste `Config.gs`, `Sheets.gs`, `Triggers.gs`, `WebApp.gs` and add the
   new **`Telegram.gs`**, then run **`setup`** again (creates the `Channels` tab + installs
   the hourly `postPendingToTelegram` trigger).
3. Create a Telegram bot via **@BotFather**, then add it to each channel as an **admin** with
   "Post messages". Fill the **`Channels`** tab — one row per channel:

   | name | bot_token | channel_id | sector | active |
   |------|-----------|------------|--------|--------|
   | Main | `123:ABC…` | `@mychannel` or `-1001234567890` | `All Jobs` | yes |

   `sector` = `All Jobs` / `Government Jobs` / `Sarkari Naukri` for a catch-all, or a specific
   label (`SSC`, `Banking Jobs`, `Railway Jobs`, `Defence Jobs`, `UPSC`, `PSU Jobs`, `PSC`,
   `Teaching Jobs`, `Judiciary`, `Stenographer`, `RRB`) to filter.
4. Run **`testTelegramChannels`** to confirm each channel receives a message.
5. Run **`markAllPostedNow`** once to skip the historical backlog (otherwise the first run
   posts every existing row). After this, only newly-scraped rows post.

> **Timing:** the poster only posts a row once it's older than `TELEGRAM_MIN_AGE_MS`
> (~75 min) so the hourly `sync-sheets` has already imported it and the deep-link resolves.
> Lower it only if you run the sync more often than hourly.
>
> **Don't double-post:** this replaces the edge-function broadcaster — leave the
> `SHEETS_SYNC_TELEGRAM` function secret **unset** (or `false`) so both don't fire.

## Design notes / guarantees

- **DO-NOTs preserved** (ported verbatim): freejobalert link/name removal (triple-checked),
  `JUNK_CLASSES` / `NAV_PATTERNS` / `JUNK_TEXTS` stripping, SSRF allowlist (freejobalert
  only), location cleaning, salary multipliers, category detection, link classification,
  update rephrasing, dedup by title / url.
- **No fabricated fallbacks** (per requirement): missing text → `"Not Available"`, missing
  dates → `"TBD"`, missing numbers → empty/NULL. The Python's invented `+1yr` deadline,
  `"India"` location, `18–65` age and `"Unknown"` placeholders are intentionally **not**
  reproduced. (`jobs.last_date` is TEXT, so `"TBD"` stores fine.)
- **Columns match the DB** — see `JOB_COLUMNS` / `UPDATE_COLUMNS` in `Config.gs`; JSON
  columns (`job_metadata`, `important_dates`, tables, link lists, `sections`, …) are stored
  as JSON strings and parsed back by the sync function.
- **Existing scrapers kept as fallback** — the Vercel crons and Admin Discover/Updates tabs
  still work; dedup (title/url) prevents duplicate rows if both run.
- **Cursor** — `sheet_sync_state` tracks the newest `scraped_at` imported per feed; the
  Web App returns only rows newer than the cursor, so each hourly sync is incremental.

## Caveat

Apps Script has no DOM parser, so structural HTML parsing is regex-based (the Python is
already regex-heavy). FreeJobAlert's table/section markup is simple, but if a source page
layout changes or uses an unusual structure, the table/section regexes in `Html.gs` /
`UpdateScraper.gs` may need tuning. Watch the `Logs` tab for fetch/parse errors.
