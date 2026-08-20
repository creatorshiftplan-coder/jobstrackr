export const config = {
    runtime: 'edge',
};

/**
 * Dynamic Sitemap Generator (Module 7)
 * ─────────────────────────────────────
 * Auto-generates sitemap.xml with all job pages from Supabase.
 * Includes static app pages + all job slugs with lastmod dates.
 */

const SITE_URL = 'https://jobstrackr.in';

// Public, indexable pages only. Auth-gated / personalised / noindex routes
// (e.g. /auth, /tracker, /profile, /saved) are intentionally excluded so the
// sitemap stays consistent with the per-route robots directives.
const STATIC_PAGES = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/welcome', changefreq: 'monthly', priority: '0.9' },
    { path: '/search', changefreq: 'daily', priority: '0.9' },
    { path: '/trending', changefreq: 'daily', priority: '0.8' },
    { path: '/calendar', changefreq: 'daily', priority: '0.8' },
    { path: '/countdown', changefreq: 'daily', priority: '0.7' },
    { path: '/syllabus', changefreq: 'weekly', priority: '0.7' },
    { path: '/formmate', changefreq: 'weekly', priority: '0.7' },
    { path: '/help', changefreq: 'monthly', priority: '0.5' },
    { path: '/user-manual', changefreq: 'monthly', priority: '0.5' },
    { path: '/faq', changefreq: 'monthly', priority: '0.5' },
    { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
    { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
    { path: '/refund-policy', changefreq: 'yearly', priority: '0.3' },
];

/**
 * Emit a <lastmod> line only when the row carries a real timestamp.
 *
 * This used to fall back to today's date. That told every crawler that all
 * ~8.6k pages had changed since its last visit, so each one re-fetched the
 * whole catalogue daily — the single biggest driver of the Aug-2026 Vercel
 * overage. An absent lastmod lets crawlers keep their own last-seen date and
 * skip pages they already have.
 */
function lastmodLine(...candidates: (string | null | undefined)[]): string {
    const stamp = candidates.find((c) => typeof c === 'string' && c.length > 0);
    return stamp ? `    <lastmod>${stamp.split('T')[0]}</lastmod>\n` : '';
}

/**
 * Rows fetched per PostgREST request when paginating.
 *
 * MUST stay at or below PostgREST's server-side `max-rows`. If it exceeded it,
 * every page would come back short, `fetchAllRows` would treat the first page
 * as the last, and the sitemap would truncate far worse than the bug this
 * replaced. 2000 is safe on evidence: the pre-fix single-shot query used
 * `limit=5000` and the live sitemap really did carry 5000 job URLs, so the
 * server serves at least that many in one response. Raise only against fresh
 * evidence of the same kind.
 */
const PAGE_SIZE = 2000;

/**
 * Hard ceiling on URLs in this sitemap. Google rejects a sitemap containing
 * more than 50,000 URLs — and it rejects the WHOLE FILE, not just the excess,
 * so overshooting would de-list the entire catalogue at once. This budget is
 * shared across every table below (not per-table) precisely so three growing
 * tables can never sum past the limit. If the catalogue genuinely approaches
 * this, the fix is a sitemap index with child sitemaps, not a bigger number.
 */
const MAX_SITEMAP_URLS = 49000;

/**
 * Fetch rows matching a PostgREST query, a page at a time, up to `budget` rows.
 *
 * This used to be a single `limit=5000` request per table. Both the jobs and
 * exam_updates queries had grown past that, so each returned exactly 5000 rows
 * — silently truncated. Because both order newest-first, the pages that fell
 * off the end were the OLDEST ones: already-indexed URLs quietly disappeared
 * from the sitemap as new rows arrived, telling Google they were no longer
 * part of the site.
 */
async function fetchAllRows(
    baseUrl: string,
    headers: Record<string, string>,
    budget: number,
): Promise<any[]> {
    const out: any[] = [];
    while (out.length < budget) {
        // Never request past the budget, so the total across tables stays under
        // MAX_SITEMAP_URLS even when the last page would otherwise overshoot.
        const limit = Math.min(PAGE_SIZE, budget - out.length);
        const res = await fetch(`${baseUrl}&limit=${limit}&offset=${out.length}`, { headers });
        if (!res.ok) break;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        out.push(...rows);
        if (rows.length < limit) break; // short page → last page
    }
    return out;
}

export default async function handler() {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL!;
        const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        };

        // URL budget shared by every table below — see MAX_SITEMAP_URLS.
        let budget = MAX_SITEMAP_URLS - STATIC_PAGES.length;

        // Fetch all jobs with slugs
        const jobs = await fetchAllRows(
            `${supabaseUrl}/rest/v1/jobs?select=slug,updated_at,is_featured&order=created_at.desc`,
            headers,
            budget,
        );
        budget -= jobs.length;
        const today = new Date().toISOString().split('T')[0];

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        // Static pages
        for (const page of STATIC_PAGES) {
            xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
        }

        // Job pages
        for (const job of jobs) {
            if (!job.slug) continue;
            const priority = job.is_featured ? '0.9' : '0.8';
            xml += `  <url>
    <loc>${SITE_URL}/jobs/${encodeURIComponent(job.slug)}</loc>
${lastmodLine(job.updated_at)}    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
        }

        // Exam update pages
        const exams = await fetchAllRows(
            `${supabaseUrl}/rest/v1/exams?select=update_slug,updated_at&update_slug=not.is.null&is_active=eq.true&order=updated_at.desc`,
            headers,
            budget,
        );
        budget -= exams.length;
        for (const exam of exams) {
            if (!exam.update_slug) continue;
            xml += `  <url>
    <loc>${SITE_URL}/updates/${encodeURIComponent(exam.update_slug)}</loc>
${lastmodLine(exam.updated_at)}    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        }

        // Exam-update article pages (exam_updates table, served by
        // api/exam-updates/[slug].ts and deep-linked from Telegram).
        const updates = await fetchAllRows(
            `${supabaseUrl}/rest/v1/exam_updates?select=slug,updated_at,scraped_at&slug=not.is.null&order=scraped_at.desc`,
            headers,
            budget,
        );
        for (const upd of updates) {
            if (!upd.slug) continue;
            xml += `  <url>
    <loc>${SITE_URL}/exam-update/${encodeURIComponent(upd.slug)}</loc>
${lastmodLine(upd.updated_at, upd.scraped_at)}    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
        }

        xml += '</urlset>\n';

        return new Response(xml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                // 6h rather than 1h: this route now paginates the whole
                // catalogue (~10k+ rows) on every regeneration, so a shorter
                // TTL is paid for directly in Supabase egress — the quota this
                // project has already blown once. Discovery does not suffer:
                // newly inserted jobs are pushed straight to Google's Indexing
                // API (api/lib/job_insert_helper.py), so the sitemap is the
                // backstop for discovery, not the primary channel.
                'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('Sitemap generation error:', error);
        // Return a minimal sitemap
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
</urlset>`, {
            status: 200,
            headers: { 'Content-Type': 'application/xml' },
        });
    }
}
