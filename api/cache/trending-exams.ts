import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cachedFetch } from '../lib/redis.js';

const CACHE_KEY = 'cache:trending-exams';
const CACHE_TTL = 600; // 10 minutes

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

// Category keyword mapping — mirrors useTrendingExams.ts
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

/**
 * GET /api/cache/trending-exams
 *
 * Returns fully processed trending exams with tracking counts, category inference,
 * and sorting — all cached in Redis for 10 minutes.
 *
 * This replaces 2 Supabase queries + heavy client-side processing.
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
    const { data, cacheHit } = await cachedFetch<TrendingExam[]>(CACHE_KEY, CACHE_TTL, async () => {
      // 1. Fetch all active exams with AI cached responses
      const exams: any[] = await supabaseFetch(
        'exams?is_active=eq.true&ai_cached_response=not.is.null&select=*&order=ai_last_updated_at.desc',
      );

      if (!exams || exams.length === 0) return [];

      // 2. Filter out exams with empty or incomplete AI data
      const examsWithData = exams.filter((exam) => {
        const aiData = exam.ai_cached_response;
        if (!aiData || aiData.raw_response) return false;
        return aiData.summary || aiData.current_status;
      });

      if (examsWithData.length === 0) return [];

      // 3. Get tracking counts for all exams
      const examIds = examsWithData.map((e) => e.id);
      const attempts: any[] = await supabaseFetch(
        `exam_attempts?exam_id=in.(${examIds.join(',')})&select=exam_id`,
      );

      const trackingCounts: Record<string, number> = {};
      attempts?.forEach((a) => {
        trackingCounts[a.exam_id] = (trackingCounts[a.exam_id] || 0) + 1;
      });

      // 4. Build trending exams with inferred categories
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

      // 5. Sort by tracking count DESC, then by last updated DESC
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

    res.setHeader('X-Cache-Hit', cacheHit ? '1' : '0');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/cache/trending-exams] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
