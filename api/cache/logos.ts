import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const CACHE_KEY = 'cache:logos:conducting-bodies';
const CACHE_TTL = 1800; // 30 minutes — logos rarely change

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

interface LogoEntry {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  category: string | null;
  created_at: string;
}

/**
 * GET /api/cache/logos
 *
 * Returns all conducting body logos from Supabase Storage.
 * Cached in Redis for 30 minutes (logos rarely change).
 *
 * Replaces the client-side Supabase Storage list() call that runs
 * on every page load of both the homepage and explore page.
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
    const { data, cacheHit } = await cachedFetch<LogoEntry[]>(CACHE_KEY, CACHE_TTL, async () => {
      // List files in Supabase Storage
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

      // Map files to logo objects — filter out placeholder files
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

    res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.setHeader('CDN-Cache-Control', 'public, max-age=1800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/cache/logos] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
