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

const STATIC_PAGES = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/welcome', changefreq: 'monthly', priority: '0.9' },
    { path: '/search', changefreq: 'daily', priority: '0.9' },
    { path: '/tracker', changefreq: 'daily', priority: '0.8' },
    { path: '/trending', changefreq: 'daily', priority: '0.8' },
    { path: '/syllabus', changefreq: 'weekly', priority: '0.7' },
    { path: '/formmate', changefreq: 'weekly', priority: '0.7' },
    { path: '/auth', changefreq: 'monthly', priority: '0.6' },
    { path: '/help', changefreq: 'monthly', priority: '0.5' },
    { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
    { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
    { path: '/refund-policy', changefreq: 'yearly', priority: '0.3' },
];

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
            const lastmod = job.updated_at ? job.updated_at.split('T')[0] : today;
            const priority = job.is_featured ? '0.9' : '0.8';
            xml += `  <url>
    <loc>${SITE_URL}/jobs/${encodeURIComponent(job.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
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
            const lastmod = exam.updated_at ? exam.updated_at.split('T')[0] : today;
            xml += `  <url>
    <loc>${SITE_URL}/updates/${encodeURIComponent(exam.update_slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
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
