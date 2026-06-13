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

// ─── Jobs handler ────────────────────────────────────────────────
async function handleJobs(req: VercelRequest, res: VercelResponse) {
  const CACHE_KEY = 'cache:jobs:all';
  const CACHE_TTL = 300;

  const { data, cacheHit } = await cachedFetch<any[]>(CACHE_KEY, CACHE_TTL, async () => {
    const columns = [
      'id', 'slug', 'title', 'department', 'location',
      'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
      'qualification', 'eligibility', 'experience',
      'salary_min', 'salary_max', 'age_min', 'age_max',
      'application_fee', 'job_metadata', 'is_featured',
      'admin_refreshed_at', 'created_at', 'tags',
      'eligibility_summary', 'required_skills',
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
      const fallbackColumns = [
        'id', 'slug', 'title', 'department', 'location',
        'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
        'qualification', 'eligibility', 'experience',
        'salary_min', 'salary_max', 'age_min', 'age_max',
        'application_fee', 'job_metadata', 'is_featured',
        'admin_refreshed_at', 'created_at', 'tags',
      ].join(',');
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
    return (rawJobs || []).map((job: any) => {
      if (job.job_metadata) {
        const {
          eligibility_profile,
          overview,
          selection_process,
          vacancies_detail,
          important_dates,
          ...rest
        } = job.job_metadata;
        job.job_metadata = rest;
      }
      return job;
    });
  });

  setCacheHeaders(res, cacheHit, 120, 300);
  return res.status(200).json(data);
}

// ─── Homepage handler ────────────────────────────────────────────
interface HomepageBundle {
  recentJobs: any[];
  allJobs: any[];
  exams: any[];
}

async function handleHomepage(req: VercelRequest, res: VercelResponse) {
  const CACHE_KEY = 'cache:homepage:bundle';
  const CACHE_TTL = 300;

  const { data, cacheHit } = await cachedFetch<HomepageBundle>(CACHE_KEY, CACHE_TTL, async () => {
    const jobColumns = [
      'id', 'slug', 'title', 'department', 'location',
      'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
      'qualification', 'eligibility', 'experience',
      'salary_min', 'salary_max', 'age_min', 'age_max',
      'application_fee', 'job_metadata', 'is_featured',
      'admin_refreshed_at', 'created_at', 'tags',
      'eligibility_summary', 'required_skills',
    ].join(',');

    const allJobsPromise = supabaseFetch(`jobs?select=${jobColumns}&order=created_at.desc&limit=10000`)
      .catch((err) => {
        console.warn('[api/cache/homepage] Failed fetching with eligibility fields, retrying without them:', err);
        const fallbackColumns = [
          'id', 'slug', 'title', 'department', 'location',
          'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
          'qualification', 'eligibility', 'experience',
          'salary_min', 'salary_max', 'age_min', 'age_max',
          'application_fee', 'job_metadata', 'is_featured',
          'admin_refreshed_at', 'created_at', 'tags',
        ].join(',');
        return supabaseFetch(`jobs?select=${fallbackColumns}&order=created_at.desc&limit=10000`);
      });

    const [allJobs, exams] = await Promise.all([
      allJobsPromise,
      supabaseFetch('exams?select=*&is_active=eq.true&order=name'),
    ]);

    const cleanAllJobs = (allJobs || []).map((job: any) => {
      if (job.job_metadata) {
        const {
          eligibility_profile,
          overview,
          selection_process,
          vacancies_detail,
          important_dates,
          ...rest
        } = job.job_metadata;
        job.job_metadata = rest;
      }
      return job;
    });

    const recentJobs = cleanAllJobs.slice(0, 50);

    return {
      recentJobs,
      allJobs: cleanAllJobs,
      exams: exams || [],
    };
  });

  setCacheHeaders(res, cacheHit, 120, 300);
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
  const CACHE_TTL = 600;

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

  setCacheHeaders(res, cacheHit, 120, 600);
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
  const CACHE_TTL = 300;

  const { data, cacheHit } = await cachedFetch<any[]>(cacheKey, CACHE_TTL, async () => {
    let url = `${SUPABASE_URL}/rest/v1/exam_updates?select=*&order=scraped_at.desc&limit=100`;

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

  setCacheHeaders(res, cacheHit, 120, 300);
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

  setCacheHeaders(res, cacheHit, 600, 1800);
  return res.status(200).json(data);
}

// ─── Shared helpers ─────────────────────────────────────────────
function setCacheHeaders(res: VercelResponse, cacheHit: boolean, sMaxAge: number, cdnMaxAge: number) {
  res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
  res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`);
  res.setHeader('CDN-Cache-Control', `public, max-age=${cdnMaxAge}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
}

// ─── Router ─────────────────────────────────────────────────────
const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse>> = {
  jobs: handleJobs,
  homepage: handleHomepage,
  'trending-exams': handleTrendingExams,
  'exam-updates': handleExamUpdates,
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
