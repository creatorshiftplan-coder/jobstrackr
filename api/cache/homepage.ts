import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const CACHE_KEY = 'cache:homepage:bundle';
const CACHE_TTL = 300; // 5 minutes

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

interface HomepageBundle {
  recentJobs: any[];
  allJobs: any[];
  exams: any[];
}

/**
 * GET /api/cache/homepage
 *
 * Returns a bundled payload for the homepage in a single request:
 * - recentJobs: The 50 most recent active jobs (for "New Government Jobs" section)
 * - allJobs: All jobs with minimal columns (for client-side recommendations)
 * - exams: Active exams catalog
 *
 * Cached in Redis for 5 minutes. Replaces 3+ separate Supabase calls.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, cacheHit } = await cachedFetch<HomepageBundle>(CACHE_KEY, CACHE_TTL, async () => {
      // Fetch all data in parallel
      const jobColumns = [
        'id', 'slug', 'title', 'department', 'location',
        'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
        'qualification', 'eligibility', 'experience',
        'salary_min', 'salary_max', 'age_min', 'age_max',
        'application_fee', 'job_metadata', 'is_featured',
        'admin_refreshed_at', 'created_at', 'tags',
      ].join(',');

      const [allJobs, exams] = await Promise.all([
        // All jobs for recommendations (full column set, ordered by created_at)
        supabaseFetch(`jobs?select=${jobColumns}&order=created_at.desc&limit=10000`),
        // Active exams catalog
        supabaseFetch('exams?select=*&is_active=eq.true&order=name'),
      ]);

      // Clean jobs of heavy metadata fields not needed on the list view
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

      // Extract recent jobs from the already-fetched full list (first 50)
      const recentJobs = cleanAllJobs.slice(0, 50);

      return {
        recentJobs,
        allJobs: cleanAllJobs,
        exams: exams || [],
      };
    });

    res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('CDN-Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/cache/homepage] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
