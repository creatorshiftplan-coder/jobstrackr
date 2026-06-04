import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const CACHE_TTL = 300; // 5 minutes

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

/** Domains to strip from nested links inside update records */
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

/** Clean freejobalert URLs from nested links inside updates (but keep the updates themselves) */
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

/**
 * GET /api/cache/exam-updates?category=<optional>
 *
 * Returns latest 100 exam_updates, optionally filtered by category.
 * Cleaned of freejobalert URLs. Cached in Redis for 5 minutes per category.
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
    const category = (req.query.category as string) || '';
    const cacheKey = `cache:exam-updates:${category || 'all'}`;

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

    res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/cache/exam-updates] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
