import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function supabaseFetch(path: string): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase fetch failed: ${response.status}`);
  return response.json();
}

// ─── Shared jobs fetch ───────────────────────────────────────────
// The full jobs list is multi-MB, so it is the single biggest Supabase egress
// item. `jobs` and `homepage` share ONE Redis key so the table is pulled from
// Supabase at most once per TTL window, no matter which endpoint misses first.
const JOBS_CACHE_KEY = 'cache:jobs:all';
// Deliberately longer than the CDN TTL below. A CDN revalidation that lands on
// a warm lambda is then answered from the memory tier instead of Supabase, so
// the CDN can stay comparatively fresh without that freshness costing egress.
const JOBS_CACHE_TTL = 7200; // 2 h

/**
 * `job_metadata` sub-keys the list and card views actually render:
 *   age_limit_text  JobCard age display + its suspicious-low-age correction
 *   salary_text     JobCard salary fallback when salary_min/max hold pay-matrix levels
 *   exam_date       useCountdownExams
 *
 * This is an allowlist rather than a denylist so a newly scraped metadata key
 * cannot silently re-inflate the largest payload the site serves. Everything
 * else — notification_pdf, application_fees, official_website, employment_type,
 * overview, selection_process, vacancies_detail, important_dates,
 * eligibility_profile — is detail-page-only and already arrives per job via
 * useJobBySlug.
 */
const LIST_METADATA_KEYS = ['age_limit_text', 'salary_text', 'exam_date'];

// By far the most expensive read the site performs — ~8.8 MB of JSON, ~1.6 MB
// gzipped and billed, per pull — and `jobs` and `homepage` are both backed by
// it. One hour bounds a single edge region to 24 revalidations/day, and the 2 h
// memory TTL above absorbs half of even those.
const JOBS_CDN_TTL = 3600;

/**
 * Selecting `job_metadata` whole and discarding most of it in JS would trim the
 * response to the browser but not the Supabase read that is actually billed —
 * the bytes have already crossed the wire by then. PostgREST jsonb path
 * selection pulls only the sub-keys in LIST_METADATA_KEYS out of the column, so
 * the saving lands on the egress meter. Same technique as JOB_DETAIL_SELECT in
 * src/hooks/useJobs.ts.
 */
const METADATA_SELECT = LIST_METADATA_KEYS.map((key) => `jm_${key}:job_metadata->${key}`).join(',');

const JOB_LIST_COLUMNS = [
  'id', 'slug', 'title', 'department', 'location',
  'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
  'qualification', 'eligibility', 'experience',
  'salary_min', 'salary_max', 'age_min', 'age_max',
  'application_fee', 'is_featured',
  'admin_refreshed_at', 'created_at', 'tags',
];

/**
 * Fold the flat `jm_*` aliases back into the `job_metadata` shape consumers
 * expect. Null when every sub-key is empty, matching both the previous
 * behaviour for jobs with no scraped metadata and reshapeJobDetailRow() in
 * src/hooks/useJobs.ts.
 */
function reshapeJobRow(job: Record<string, any>): Record<string, any> {
  const meta: Record<string, any> = {};
  for (const key of LIST_METADATA_KEYS) {
    const alias = `jm_${key}`;
    const value = job[alias];
    delete job[alias];
    if (value !== null && value !== undefined) meta[key] = value;
  }
  job.job_metadata = Object.keys(meta).length > 0 ? meta : null;
  return job;
}

async function fetchAllJobs(): Promise<any[]> {
  const columns = [
    ...JOB_LIST_COLUMNS,
    'eligibility_summary', 'required_skills',
    METADATA_SELECT,
  ].join(',');

  const url = `${SUPABASE_URL}/rest/v1/jobs?select=${columns}&order=created_at.desc&limit=10000`;
  let response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    console.warn('[api/cache/jobs] Failed fetching with eligibility fields, retrying without them');
    const fallbackColumns = [...JOB_LIST_COLUMNS, METADATA_SELECT].join(',');
    const fallbackUrl = `${SUPABASE_URL}/rest/v1/jobs?select=${fallbackColumns}&order=created_at.desc&limit=10000`;
    response = await fetch(fallbackUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
  }

  if (!response.ok) {
    throw new Error(`Supabase query failed with status ${response.status}`);
  }

  const rawJobs = await response.json();
  return (rawJobs || []).map(reshapeJobRow);
}

// ─── Jobs handler ────────────────────────────────────────────────
async function handleJobs(req: VercelRequest, res: VercelResponse) {
  const { data, cacheHit } = await cachedFetch<any[]>(JOBS_CACHE_KEY, JOBS_CACHE_TTL, fetchAllJobs);

  setCacheHeaders(res, cacheHit, JOBS_CDN_TTL);
  return res.status(200).json(data);
}

// ─── Homepage handler ────────────────────────────────────────────
interface HomepageBundle {
  recentJobs: any[];
  allJobs: any[];
  exams: any[];
}

async function handleHomepage(req: VercelRequest, res: VercelResponse) {
  // Reuses the SAME jobs cache key as /api/cache/jobs — previously this
  // handler re-pulled the entire multi-MB jobs table from Supabase into its
  // own bundle key, doubling the biggest egress item. Exams are cached
  // separately (small payload).
  const [jobsResult, examsResult] = await Promise.all([
    cachedFetch<any[]>(JOBS_CACHE_KEY, JOBS_CACHE_TTL, fetchAllJobs),
    cachedFetch<any[]>('cache:exams:active', JOBS_CACHE_TTL, async () => {
      const exams = await supabaseFetch('exams?select=*&is_active=eq.true&order=name');
      return exams || [];
    }),
  ]);

  const allJobs = jobsResult.data || [];
  const data: HomepageBundle = {
    recentJobs: allJobs.slice(0, 50),
    allJobs,
    exams: examsResult.data || [],
  };
  const cacheHit = jobsResult.cacheHit && examsResult.cacheHit;

  setCacheHeaders(res, cacheHit, JOBS_CDN_TTL);
  return res.status(200).json(data);
}

// ─── Trending exams handler ─────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Banking: ['bank', 'ibps', 'sbi', 'rbi', 'nabard', 'rrb clerk', 'rrb po'],
  SSC: ['ssc', 'staff selection'],
  Railways: ['railway', 'rrb', 'rpf', 'ntpc', 'technician', 'group d'],
  Defence: ['defence', 'defense', 'army', 'navy', 'airforce', 'nda', 'cds', 'capf', 'afcat'],
  UPSC: ['upsc', 'civil service', 'ias', 'ips', 'ifs'],
  Teaching: ['teacher', 'tet', 'ctet', 'teaching', 'kvs', 'nvs', 'dsssb'],
  State: ['state', 'psc', 'bpsc', 'uppsc', 'mppsc', 'rpsc', 'gpsc', 'appsc'],
};

const SPECIFIC_CATEGORIES = ['Banking', 'SSC', 'Railways', 'Defence', 'UPSC', 'Teaching', 'State'];

function inferCategory(name: string, conductingBody: string | null): string | null {
  const searchText = `${name} ${conductingBody || ''}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => searchText.includes(kw.toLowerCase()))) {
      return cat;
    }
  }
  return null;
}

interface TrendingExam {
  id: string;
  name: string;
  conducting_body: string | null;
  category: string | null;
  description: string | null;
  official_website: string | null;
  ai_cached_response: any;
  ai_last_updated_at: string | null;
  tracking_count: number;
  logo_url: string | null;
  update_slug: string | null;
}

async function handleTrendingExams(req: VercelRequest, res: VercelResponse) {
  const CACHE_KEY = 'cache:trending-exams';
  const CACHE_TTL = 1800; // 30 min — balances freshness against Supabase egress

  const { data, cacheHit } = await cachedFetch<TrendingExam[]>(CACHE_KEY, CACHE_TTL, async () => {
    const exams: any[] = await supabaseFetch(
      'exams?is_active=eq.true&ai_cached_response=not.is.null&select=*&order=ai_last_updated_at.desc',
    );

    if (!exams || exams.length === 0) return [];

    const examsWithData = exams.filter((exam) => {
      const aiData = exam.ai_cached_response;
      if (!aiData || aiData.raw_response) return false;
      return aiData.summary || aiData.current_status;
    });

    if (examsWithData.length === 0) return [];

    const examIds = examsWithData.map((e) => e.id);
    const attempts: any[] = await supabaseFetch(
      `exam_attempts?exam_id=in.(${examIds.join(',')})&select=exam_id`,
    );

    const trackingCounts: Record<string, number> = {};
    attempts?.forEach((a) => {
      trackingCounts[a.exam_id] = (trackingCounts[a.exam_id] || 0) + 1;
    });

    const trendingExams: TrendingExam[] = examsWithData.map((exam) => {
      const useCategory = SPECIFIC_CATEGORIES.includes(exam.category || '')
        ? exam.category
        : inferCategory(exam.name, exam.conducting_body) || exam.category;

      return {
        id: exam.id,
        name: exam.name,
        conducting_body: exam.conducting_body,
        category: useCategory,
        description: exam.description,
        official_website: exam.official_website,
        ai_cached_response: exam.ai_cached_response,
        ai_last_updated_at: exam.ai_last_updated_at,
        tracking_count: trackingCounts[exam.id] || 0,
        logo_url: null,
        update_slug: exam.update_slug || null,
      };
    });

    trendingExams.sort((a, b) => {
      if (b.tracking_count !== a.tracking_count) {
        return b.tracking_count - a.tracking_count;
      }
      return (
        new Date(b.ai_last_updated_at || 0).getTime() -
        new Date(a.ai_last_updated_at || 0).getTime()
      );
    });

    return trendingExams;
  });

  setCacheHeaders(res, cacheHit, 1800);
  return res.status(200).json(data);
}

// ─── Exam updates handler ───────────────────────────────────────
const FREE_JOB_ALERT_DOMAINS = ['freejobalert.com', 'www.freejobalert.com'];

function isFreeJobAlertUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return FREE_JOB_ALERT_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function filterFreeJobAlertFromUpdates(updates: any[]): any[] {
  return updates.map((u) => ({
    ...u,
    download_links: u.download_links?.filter((dl: any) => !isFreeJobAlertUrl(dl.url)) ?? [],
    important_dates:
      u.important_dates?.map((d: any) => ({
        ...d,
        link: isFreeJobAlertUrl(d.link) ? '' : d.link,
      })) ?? [],
    related_articles:
      u.related_articles?.filter((a: any) => !isFreeJobAlertUrl(a.url)) ?? [],
  }));
}

async function handleExamUpdates(req: VercelRequest, res: VercelResponse) {
  const category = (req.query.category as string) || '';
  const cacheKey = `cache:exam-updates:${category || 'all'}`;
  const CACHE_TTL = 1800; // 30 min — balances freshness against Supabase egress

  const { data, cacheHit } = await cachedFetch<any[]>(cacheKey, CACHE_TTL, async () => {
    // Light column set — list/card views never render the heavy `sections`,
    // `overview`, or `related_articles` JSON (those load on the detail page only).
    const updateColumns = [
      'id', 'slug', 'url', 'title', 'category', 'status', 'published_date',
      'summary', 'important_dates', 'download_links', 'tags',
      'scraped_at', 'created_at', 'updated_at', 'job_id', 'exam_id',
    ].join(',');

    let url = `${SUPABASE_URL}/rest/v1/exam_updates?select=${updateColumns}&order=scraped_at.desc&limit=100`;

    if (category && category !== 'all') {
      url += `&category=eq.${encodeURIComponent(category)}`;
    }

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase fetch failed: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return filterFreeJobAlertFromUpdates(raw || []);
  });

  setCacheHeaders(res, cacheHit, 900);
  return res.status(200).json(data);
}

// ─── Exam update search handler ─────────────────────────────────
// `exam-updates` returns the 100 most recent rows, which in practice is a ~6 h
// window — searching it client-side means a query for any named exam ("NTPC")
// matches nothing and the Updates page falls back to stale tracked-exam cards.
// This searches the whole table instead: PostgREST does the filtering, so only
// the matching rows cross the wire, and Redis absorbs repeat queries.
const SEARCH_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'in', 'on', 'and', 'or', 'to',
  'exam', 'exams', 'update', 'updates', 'latest', 'news',
]);

/**
 * Tokens are stripped to [a-z0-9] so they can be dropped straight into a
 * PostgREST filter — none of the reserved characters (`,` `.` `(` `)` `:`)
 * can survive, so no quoting is needed.
 */
function searchTokens(raw: string): string[] {
  const all = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const meaningful = all.filter((t) => !SEARCH_STOPWORDS.has(t));
  return (meaningful.length > 0 ? meaningful : all).slice(0, 4);
}

async function handleUpdateSearch(req: VercelRequest, res: VercelResponse) {
  const raw = ((req.query.q as string) || '').trim().slice(0, 80);
  const tokens = searchTokens(raw);
  if (tokens.length === 0) {
    setCacheHeaders(res, false, 300);
    return res.status(200).json([]);
  }

  const cacheKey = `cache:update-search:${tokens.join('+')}`;
  const CACHE_TTL = 900; // 15 min — searches repeat far more than they vary

  const { data, cacheHit } = await cachedFetch<any[]>(cacheKey, CACHE_TTL, async () => {
    const updateColumns = [
      'id', 'slug', 'url', 'title', 'category', 'status', 'published_date',
      'summary', 'important_dates', 'download_links', 'tags',
      'scraped_at', 'created_at', 'updated_at', 'job_id', 'exam_id',
    ].join(',');

    // Every token must appear in the title, the summary, or the category (AND
    // across tokens, OR across the three fields) — the same semantics as the
    // client scorer, narrowed to the fields that carry the exam's identity.
    // Category matters because titles are rephrased on the way in: an admit
    // card post is titled "Entry pass"/"Hall Ticket", so a search for "admit
    // card" only lands via category=admit_card.
    const tokenClause = (t: string) =>
      `title.ilike.*${t}*,summary.ilike.*${t}*,category.ilike.*${t}*`;
    const filter =
      tokens.length === 1
        ? `or=(${tokenClause(tokens[0])})`
        : `and=(${tokens.map((t) => `or(${tokenClause(t)})`).join(',')})`;
    const url =
      `${SUPABASE_URL}/rest/v1/exam_updates?select=${updateColumns}&${filter}` +
      `&order=scraped_at.desc&limit=60`;

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase search failed: ${response.status} ${response.statusText}`);
    }

    const rows = await response.json();
    return filterFreeJobAlertFromUpdates(rows || []);
  });

  setCacheHeaders(res, cacheHit, CACHE_TTL);
  return res.status(200).json(data);
}

// ─── Exam Countdown handler ─────────────────────────────────────
// Powers the /countdown wall. Unlike `exam-updates` (100 most-recent rows,
// dominated by results/admit cards), this returns a wide window so upcoming
// exam-date notifications actually surface. Redis-cached, so egress stays low.
async function handleExamCountdown(req: VercelRequest, res: VercelResponse) {
  const CACHE_KEY = 'cache:exam-countdown:all';
  const CACHE_TTL = 3600; // 1 h — 1000-row payload, keep Supabase pulls rare

  const { data, cacheHit } = await cachedFetch<any[]>(CACHE_KEY, CACHE_TTL, async () => {
    const updateColumns = [
      'id', 'slug', 'url', 'title', 'category', 'status', 'published_date',
      'summary', 'important_dates', 'download_links', 'tags',
      'scraped_at', 'created_at', 'updated_at', 'job_id', 'exam_id',
    ].join(',');

    const url = `${SUPABASE_URL}/rest/v1/exam_updates?select=${updateColumns}&order=scraped_at.desc&limit=1000`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase fetch failed: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return filterFreeJobAlertFromUpdates(raw || []);
  });

  // 1000 rows (~1.3 MB) — the second-largest payload here, so keep it at the
  // handler's own 1 h TTL rather than the old 15 min.
  setCacheHeaders(res, cacheHit, 3600);
  return res.status(200).json(data);
}

// ─── Logos handler ──────────────────────────────────────────────
interface LogoEntry {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  category: string | null;
  created_at: string;
}

async function handleLogos(req: VercelRequest, res: VercelResponse) {
  const CACHE_KEY = 'cache:logos:conducting-bodies';
  const CACHE_TTL = 1800;

  const { data, cacheHit } = await cachedFetch<LogoEntry[]>(CACHE_KEY, CACHE_TTL, async () => {
    const listUrl = `${SUPABASE_URL}/storage/v1/object/list/logos`;
    const response = await fetch(listUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: 'conducting-bodies/',
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });

    if (!response.ok) {
      console.error('Storage list failed:', response.status, response.statusText);
      return [];
    }

    const files: any[] = await response.json();
    if (!files || files.length === 0) return [];

    const imageRegex = /\.(png|jpg|jpeg|webp|svg)$/i;
    const logos: LogoEntry[] = files
      .filter((file) => file.name !== '.emptyFolderPlaceholder' && imageRegex.test(file.name))
      .map((file) => {
        const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/logos/conducting-bodies/${file.name}`;

        return {
          id: file.id || file.name,
          name: nameWithoutExt.replace(/-/g, ' ').replace(/_/g, ' '),
          slug: nameWithoutExt.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          logo_url: publicUrl,
          category: null,
          created_at: file.created_at || new Date().toISOString(),
        };
      });

    return logos;
  });

  setCacheHeaders(res, cacheHit, 1800);
  return res.status(200).json(data);
}

// ─── Shared helpers ─────────────────────────────────────────────
/**
 * `cdnTtl` (seconds) is the one number that decides Supabase egress: the CDN
 * revalidates at most once per TTL per edge region, and each revalidation that
 * misses the memory tier is a full source fetch. It previously disagreed with
 * itself — `s-maxage=600` against `CDN-Cache-Control: max-age=1800` — and since
 * Vercel gives `CDN-Cache-Control` precedence, the shorter value was misleading.
 * One argument now feeds both.
 *
 * `stale-while-revalidate` is long on purpose: serving a slightly stale list
 * while it refreshes in the background is always preferable to an error page,
 * and it costs nothing extra (revalidation is already bounded by the TTL).
 */
function setCacheHeaders(res: VercelResponse, cacheHit: boolean, cdnTtl: number) {
  res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
  res.setHeader(
    'Cache-Control',
    `public, max-age=300, s-maxage=${cdnTtl}, stale-while-revalidate=86400`,
  );
  res.setHeader('CDN-Cache-Control', `public, max-age=${cdnTtl}, stale-while-revalidate=86400`);
  res.setHeader('Access-Control-Allow-Origin', '*');
}

// ─── Router ─────────────────────────────────────────────────────
const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse>> = {
  jobs: handleJobs,
  homepage: handleHomepage,
  'trending-exams': handleTrendingExams,
  'exam-updates': handleExamUpdates,
  'search-updates': handleUpdateSearch,
  'exam-countdown': handleExamCountdown,
  logos: handleLogos,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = req.query.key as string;
  const handlerFn = HANDLERS[key];

  if (!handlerFn) {
    return res.status(404).json({ error: `Unknown cache key: ${key}` });
  }

  try {
    return await handlerFn(req, res);
  } catch (err: any) {
    console.error(`[api/cache/${key}] Error:`, err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
