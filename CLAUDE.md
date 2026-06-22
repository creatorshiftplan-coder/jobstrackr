<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **jobstrackr** (3844 symbols, 9003 relationships, 289 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/jobstrackr/context` | Codebase overview, check index freshness |
| `gitnexus://repo/jobstrackr/clusters` | All functional areas |
| `gitnexus://repo/jobstrackr/processes` | All execution flows |
| `gitnexus://repo/jobstrackr/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

# JobsTrackr — Codebase Guide

**JobsTrackr** (`https://jobstrackr.in`) is India's government job tracking PWA. Users track exam deadlines, receive eligibility-matched job recommendations, manage documents, fill forms (FormMate), and get Telegram alerts — all in a mobile-first, offline-capable app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS v3, shadcn/ui (Radix UI primitives) |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 with IndexedDB persistence |
| Auth | Supabase Auth (JWT, email/OTP, guest mode) |
| Database | PostgreSQL via Supabase (project ID: `fdxksytpdfgmbkttipdf`) |
| Edge functions | Deno (Supabase Edge Functions) |
| API routes | Vercel Serverless / Edge (TypeScript) |
| Scraping | Python 3 + BeautifulSoup4 |
| AI | Google Gemini + Groq (rotating API keys) |
| Animations | Framer Motion, Lottie |
| Deployment | Vercel (frontend + API routes), Supabase (DB + functions) |

---

## Repository Layout

```
jobstrackr/
├── src/
│   ├── App.tsx                   # Root: providers, router, lazy route imports
│   ├── main.tsx                  # Vite entry point
│   ├── index.css                 # Global styles + Tailwind directives
│   ├── pages/                    # Route-level components (one file per route)
│   ├── components/               # Feature components
│   │   └── ui/                   # shadcn/ui primitives (DO NOT edit manually)
│   ├── hooks/                    # TanStack Query hooks + context hooks
│   ├── lib/                      # Pure business logic (no React, no side effects)
│   ├── types/
│   │   └── job.ts                # Central type definitions (Job, EligibilityProfile, etc.)
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Auto-generated; import supabase from here
│   │       └── types.ts          # Auto-generated DB types; DO NOT edit
│   ├── constants/                # Static lookup tables (filters, org logo mappings)
│   └── utils/
│       └── pushNotifications.ts
├── api/                          # Vercel API routes + Python scraper library
│   ├── cache/[key].ts            # Redis-backed homepage bundle endpoint
│   ├── jobs/[slug].ts            # SSR for job detail OG tags
│   ├── updates/[slug].ts         # SSR for exam update OG tags
│   ├── sitemap.xml.ts            # Dynamic sitemap
│   ├── supabase/[...path].ts     # Supabase proxy
│   ├── discover.py               # Vercel Python route (job discovery)
│   ├── scrape.py                 # Vercel Python route (single job scrape)
│   ├── scrape_article.py         # Vercel Python route (article scrape)
│   ├── scrape_article_links.py   # Vercel Python route (link extraction)
│   ├── sync_sheets.py            # Vercel Python route (Google Sheets sync)
│   ├── lib/                      # Shared Python library
│   │   ├── scraper_v3.py         # Original rule-based scraper
│   │   ├── scraper_v5.py         # FreeJobAlert universal scraper
│   │   ├── article_scraper.py    # Article content extractor
│   │   ├── discover_links.py     # Link discovery from job boards
│   │   ├── auto_discover_cron.py # Cron wrapper for discovery
│   │   ├── job_insert_helper.py  # Supabase upsert helpers
│   │   ├── rephraser.py          # LLM-based description rephrasing
│   │   ├── google_indexing.py    # Google Search Console indexing API
│   │   ├── process_scrape_queue.py
│   │   ├── redis.ts              # Redis client (Upstash)
│   │   └── auth.py               # API auth helpers
│   └── requirements.txt          # Python dependencies for Vercel
├── supabase/
│   ├── config.toml               # Local Supabase config
│   ├── migrations/               # SQL migration files (date-prefixed)
│   └── functions/                # Deno edge functions
│       ├── _shared/              # Shared Deno utilities (apiKeyRotation.ts, etc.)
│       ├── ai-job-search/        # AI-powered natural language job search
│       ├── ai-assist/            # General AI assist for admin
│       ├── auto-discover-jobs/   # Automated job discovery
│       ├── exams/                # Exam CRUD operations
│       ├── generate-tags/        # Rule-based tag generation for jobs
│       ├── govtjob-scraper/      # Govt job site scraper (Deno)
│       ├── groq-summarize/       # Groq LLM summaries
│       ├── jobs-recommendations/ # Server-side eligibility + AI ranking
│       ├── ocr-process/          # Document OCR for FormMate
│       ├── process-embeddings/   # pgvector embedding generation
│       ├── process-telegram-queue/
│       ├── quick-refresh-job/    # Single job metadata refresh
│       ├── refresh-job-data/     # Batch job metadata refresh
│       ├── syllabus-search/      # AI syllabus coverage check
│       ├── sync-sheets/          # Google Sheets ↔ Supabase sync
│       ├── telegram-auto-post/   # Automated Telegram channel posting
│       └── telegram-bot/         # Telegram bot webhook handler
├── scripts/
│   ├── auto_discover.py          # GitHub Actions job discovery entry point
│   ├── backfill-tags.mjs         # Backfill tags on existing jobs
│   ├── generate-embeddings.mjs   # Generate pgvector embeddings
│   └── postbuild.js              # Post-build step (run after `vite build`)
├── apps-script/                  # Legacy Google Apps Script (Sheets automation)
├── public/
│   ├── sw.js                     # Service worker (PWA offline support)
│   ├── manifest.json             # Web app manifest
│   └── offline.html              # Offline fallback page
├── .github/workflows/
│   └── auto-discover.yml         # Cron: daily job discovery at 01:00 UTC
├── package.json                  # Node deps + npm scripts
├── vite.config.ts                # Vite config (path aliases, plugins)
├── tailwind.config.ts            # Tailwind theme + shadcn token mapping
├── tsconfig.json                 # TypeScript config
└── eslint.config.js              # ESLint flat config
```

---

## Development Workflow

### Setup

```sh
npm install
npm run dev        # Vite dev server on http://localhost:8080
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build + postbuild step |
| `npm run build:dev` | Development mode build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |
| `npm run test` | Vitest (run once) |
| `npm run test:watch` | Vitest in watch mode |

### Environment Variables

Set these in `.env.local` for local dev:

```
VITE_SUPABASE_URL=https://fdxksytpdfgmbkttipdf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

Vercel environment also needs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

### Database Migrations

All schema changes go in `supabase/migrations/` as SQL files named `YYYYMMDD_description.sql`. Apply locally with `supabase db push` or deploy via Supabase dashboard.

### Edge Functions

Deploy with:
```sh
supabase functions deploy <function-name>
```

Functions are Deno-based TypeScript and import from `https://esm.sh/` or Deno std lib.

---

## Key Architecture Patterns

### 1. Data Fetching — TanStack Query

Every data source has a dedicated hook in `src/hooks/`. All hooks follow this pattern:

```ts
// src/hooks/useExams.ts
export function useExams() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exams", user?.id],
    queryFn: () => supabase.from("exams").select("*")...,
    enabled: !!user,
  });
}
```

**Query key conventions:**
- `["jobs"]` — all active jobs
- `["homepage-bundle"]` — Redis-cached bundle (jobs + exams)
- `["profile", userId]`
- `["exams", userId]`
- `["job", slug]` — single job detail
- `["exam-updates-for-job", jobId]`

**Persistence:** Only keys listed in `src/lib/queryPersister.ts` → `PERSIST_KEYS` are persisted to IndexedDB (for offline use). Add a key there if new data should be cached across sessions.

### 2. Homepage Bundle (Redis Cache)

The homepage avoids N+1 fetches by hitting `/api/cache/homepage` which returns `{ recentJobs, allJobs, exams }` from Upstash Redis (15-min TTL). Direct Supabase is used as a fallback. This is orchestrated by `useHomepageData`.

### 3. Eligibility Matching Pipeline

Client-side pipeline for matching users to jobs:

```
useHomepageData → allJobs
         ↓
src/lib/eligibilityParser.ts → parses job.eligibility text → EligibilityProfile
         ↓
src/lib/jobMatcher.ts → matchAndSort() → MatchedJob[] (rule-based)
         ↓
src/lib/hybridScorer.ts → scoreJobHybrid() → adds tracked-exam + sector + recency signals
         ↓
src/lib/feedBuilder.ts → buildFeed() → FeedShelf[] (Netflix-style rows)
```

**Never change scoring weights in `hybridScorer.ts` without understanding `feedBuilder.ts` shelf ordering.**

### 4. Authentication

`useAuth` (context in `src/hooks/useAuth.tsx`) provides `{ user, session, loading, isGuestMode }`. Wrap protected pages with an `enabled: !!user` guard on queries. Guest mode is toggled via `localStorage("guestMode")` and allows browsing without signup.

### 5. Type System

`src/types/job.ts` is the canonical source for:
- `Job` — the main database row type
- `EligibilityProfile` / `EligibilityAlternative` — parsed eligibility structure (v5)
- `SkillObject` — discriminated union for required skills (typing, ITI, driving, etc.)
- `JobMetadata` — flexible JSONB metadata field

`src/integrations/supabase/types.ts` is **auto-generated** from the Supabase schema — never edit it. Run `supabase gen types typescript --local` to regenerate.

### 6. Component Conventions

- **shadcn/ui primitives** live in `src/components/ui/`. Never edit these — use the shadcn CLI to update: `npx shadcn@latest add <component>`.
- **Feature components** live in `src/components/`. One component per file, named after the component.
- **Path alias**: `@/` maps to `src/`. Always use this for imports inside `src/`.
- **Toast notifications**: Use `import { toast } from "sonner"` (not the Radix toast).

### 7. Tag System

Rule-based tags in `src/lib/tagRules.ts` power hybrid recommendations without embeddings. Tags cover:
- **Sectors**: `ssc`, `banking`, `railway`, `defence`, `upsc`, `teaching`, `state_psc`, `police`, `medical`, `psu`, etc.
- **Qualification tiers**: `8th_pass`, `10th_pass`, `12th_pass`, `graduate`, `post_graduate`, `phd`, `diploma`, `iti`
- **Job groups**: `group_a`, `group_b`, `group_c`, `group_d`
- **Org types**: `central_govt`, `state_govt`, `psu`, `judiciary`

Tags are stored in `jobs.tags` (text array) and generated by the `generate-tags` edge function or backfilled via `scripts/backfill-tags.mjs`.

### 8. SEO

- Static routes: configured in `src/lib/seoConfig.ts` via `ROUTE_SEO_MAP`
- Dynamic job/update pages: SSR'd by `api/jobs/[slug].ts` and `api/updates/[slug].ts` — these inject `<title>`, meta, and JSON-LD before hydration
- The hook `useRouteSeo` (called once in `AppContent`) sets document metadata for client-rendered routes

### 9. AI Features

All AI calls route through Supabase Edge Functions using Groq or Gemini with rotating API keys (managed in the `api_keys` Supabase table via `_shared/apiKeyRotation.ts`):
- `ai-job-search` — natural language job search with per-user daily limit (7 queries/day)
- `jobs-recommendations` — server-side eligibility + Groq ranking
- `syllabus-search` — AI syllabus gap check
- `groq-summarize` — exam update summaries
- `ocr-process` — document OCR for FormMate auto-fill

### 10. Scraping Pipeline

Jobs are scraped from FreeJobAlert.com and inserted/updated via:
1. **GitHub Actions** (`auto-discover.yml`) runs `scripts/auto_discover.py` daily at 01:00 UTC
2. Script calls `api/lib/auto_discover_cron.py` → discovers links → scrapes each article via `scraper_v5.py` → inserts via `job_insert_helper.py`
3. Duplicate prevention: `jobs.dedupe_key` column + upsert logic
4. After insert: `generate-tags` edge function is called to tag the new job

---

## Database Key Tables

| Table | Purpose |
|-------|---------|
| `jobs` | Main jobs table (`slug`, `title`, `department`, `eligibility`, `job_metadata` JSONB, `tags[]`, `required_skills` JSONB) |
| `exams` | Tracked exams/conducting bodies |
| `profiles` | User profile (dob, gender, category, education, preferred_sectors[]) |
| `user_education` | Education records per user |
| `saved_jobs` | User ↔ Job many-to-many saves |
| `user_exams` | Exam tracking (attempts, status) |
| `exam_updates` | News/updates for exams with slugs |
| `saved_exam_updates` | User-bookmarked exam updates |
| `user_documents` | Uploaded documents (photo, signature, certificates) |
| `user_calendar_events` | Custom calendar entries per user |
| `api_keys` | Rotating AI API keys (Groq/Gemini) managed by edge functions |
| `ai_job_discover_logs` | Audit log for AI-triggered job discovery |
| `ai_exam_discover_logs` | Audit log for AI-triggered exam discovery |
| `sheet_sync_runs` | Google Sheets sync audit trail |

---

## PWA & Offline

- Service worker: `public/sw.js` (cache-first for static assets, network-first for API)
- Offline fallback: `public/offline.html`
- Install prompt: `InstallPrompt` component + `usePWAInstall` hook
- IOS-specific guide: `IOSInstallGuide` component
- Query cache persisted to IndexedDB for offline browsing

---

## Routing

Routes are defined in `src/App.tsx`. Only `Welcome` and `Auth` are eagerly loaded; everything else is `lazy()` + `<Suspense>`. Navigation:
- **Mobile**: `BottomNav` component
- **Desktop**: `DesktopSidebar` (via shadcn SidebarProvider)
- **Top bar**: `TopBar` (search, theme toggle, user avatar)

Pages that suppress navigation (fullscreen mode): `/welcome`, `/auth`, `/reset-password`, `/countdown/live`.

---

## AI Assistant Rules

1. **Always read `src/types/job.ts`** before touching any code that handles job data. The `EligibilityProfile` / `EligibilityAlternative` structure is v5 and has subtle invariants.
2. **Never edit `src/integrations/supabase/types.ts` or `src/integrations/supabase/client.ts`** — these are auto-generated.
3. **Never edit `src/components/ui/`** — use the shadcn CLI.
4. **Use `@/` imports** for all imports within `src/`.
5. **TanStack Query mutations** must call `queryClient.invalidateQueries({ queryKey: [...] })` after success — check what key the relevant `useQuery` uses.
6. **Database changes** require a migration file in `supabase/migrations/` AND a type regeneration pass.
7. **Edge functions** run on Deno — use ESM imports from `https://esm.sh/` or Deno std lib. Node built-ins are not available.
8. **Python scrapers** target Python 3.11 (as pinned in GitHub Actions). New dependencies go in `api/requirements.txt`.
9. **Eligibility parser** is `src/lib/eligibilityParser.ts` (version 5). Do not change the `PROFILE_VERSION` constant without updating all downstream consumers.
10. **Scoring changes** in `hybridScorer.ts` affect the entire `buildFeed` output — run the test suite and visually verify the feed order on the homepage.
