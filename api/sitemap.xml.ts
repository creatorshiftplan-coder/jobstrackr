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

export default async function handler() {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL!;
        const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

        // Fetch all jobs with slugs
        const response = await fetch(
            `${supabaseUrl}/rest/v1/jobs?select=slug,updated_at,is_featured&order=created_at.desc&limit=5000`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        const jobs = response.ok ? await response.json() : [];
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
        const examsResponse = await fetch(
            `${supabaseUrl}/rest/v1/exams?select=update_slug,updated_at&update_slug=not.is.null&is_active=eq.true&order=updated_at.desc&limit=5000`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        const exams = examsResponse.ok ? await examsResponse.json() : [];
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
        const updatesResponse = await fetch(
            `${supabaseUrl}/rest/v1/exam_updates?select=slug,updated_at,scraped_at&slug=not.is.null&order=scraped_at.desc&limit=5000`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        const updates = updatesResponse.ok ? await updatesResponse.json() : [];
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
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
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
