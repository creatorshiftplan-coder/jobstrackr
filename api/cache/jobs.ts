import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const CACHE_KEY = 'cache:jobs:all';
const CACHE_TTL = 300; // 5 minutes

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

/**
 * GET /api/cache/jobs
 *
 * Returns all jobs (same columns as useJobs hook), ordered by created_at DESC.
 * Results are cached in Redis for 5 minutes.
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
    const { data, cacheHit } = await cachedFetch<any[]>(CACHE_KEY, CACHE_TTL, async () => {
      // Same query as useJobs hook
      const columns = [
        'id', 'slug', 'title', 'department', 'location',
        'last_date', 'last_date_display', 'vacancies', 'vacancies_display',
        'qualification', 'eligibility', 'experience',
        'salary_min', 'salary_max', 'age_min', 'age_max',
        'application_fee', 'job_metadata', 'is_featured',
        'admin_refreshed_at', 'created_at', 'tags',
      ].join(',');

      const url = `${SUPABASE_URL}/rest/v1/jobs?select=${columns}&order=created_at.desc&limit=10000`;
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase fetch failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    });

    res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('CDN-Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/cache/jobs] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
