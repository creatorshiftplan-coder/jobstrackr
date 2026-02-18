export const config = {
    runtime: 'edge',
};

/**
 * Universal SEO Job Page Renderer (Modules 3-6)
 * ─────────────────────────────────────────────
 * Serves pre-rendered, SEO-complete HTML for /jobs/:slug
 * Includes: dynamic metadata, JSON-LD, semantic content, internal links
 * Then boots the React SPA for interactivity.
 */

function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatSalary(min: number | null, max: number | null): string {
    if (min && max) return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')} per month`;
    if (min) return `₹${min.toLocaleString('en-IN')}+ per month`;
    if (max) return `Up to ₹${max.toLocaleString('en-IN')} per month`;
    return 'Not disclosed';
}

function formatAge(min: number | null, max: number | null): string {
    if (min && max) return `${min} – ${max} years`;
    if (min) return `From ${min} years`;
    if (max) return `Upto ${max} years`;
    return 'Not Available';
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'To be announced';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

export default async function handler(request: Request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
        return Response.redirect(new URL('/', url.origin).toString(), 302);
    }

    try {
        const supabaseUrl = 'https://fdxksytpdfgmbkttipdf.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkeGtzeXRwZGZnbWJrdHRpcGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM1MTYsImV4cCI6MjA4MDQyOTUxNn0.NocVE7TCJIQgIhbHkxhHWraBRxyCkLIdgUQ3ERCHuKQ';

        // Try by slug first, then UUID fallback
        let jobResponse = await fetch(
            `${supabaseUrl}/rest/v1/jobs?slug=eq.${encodeURIComponent(slug)}&select=*`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        let jobs = await jobResponse.json();
        let job = jobs[0];

        // UUID fallback
        if (!job && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)) {
            jobResponse = await fetch(
                `${supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(slug)}&select=*`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                    },
                }
            );
            jobs = await jobResponse.json();
            job = jobs[0];

            // If found by UUID and has slug, redirect to canonical slug URL
            if (job?.slug) {
                return Response.redirect(new URL(`/jobs/${job.slug}`, url.origin).toString(), 301);
            }
        }

        if (!job) {
            // Job not found — serve SPA fallback
            return serveSpaFallback(url);
        }

        // ── Fetch related jobs (Module 6: Internal Linking) ──
        const relatedResponse = await fetch(
            `${supabaseUrl}/rest/v1/jobs?department=eq.${encodeURIComponent(job.department)}&id=neq.${job.id}&select=slug,title,department,vacancies_display&order=created_at.desc&limit=5`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );
        const relatedJobs = await relatedResponse.json();

        // ── Build SEO-rich HTML ──
        const html = buildSeoPage(job, relatedJobs, url.origin);

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('SEO job page error:', error);
        return serveSpaFallback(url);
    }
}

function serveSpaFallback(url: URL): Response {
    // Redirect to SPA — Vercel will serve index.html
    return new Response(`<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0;url=${url.pathname}"></head>
<body>Redirecting...</body></html>`, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    });
}

function buildSeoPage(job: any, relatedJobs: any[], origin: string): string {
    const siteUrl = 'https://jobstrackr.in';
    const year = new Date().getFullYear();
    const canonicalUrl = `${siteUrl}/jobs/${job.slug || job.id}`;

    // ── Module 3: Dynamic SEO Metadata ──
    const seoTitle = `${escapeHtml(job.title)} Recruitment ${year} – Vacancy, Eligibility & Apply | JobsTrackr`;

    const descParts: string[] = [];
    descParts.push(`${job.title} by ${job.department}.`);
    if (job.vacancies_display) descParts.push(`${job.vacancies_display} vacancies.`);
    else if (job.vacancies) descParts.push(`${job.vacancies} vacancies.`);
    if (job.salary_min || job.salary_max) descParts.push(`Salary: ${formatSalary(job.salary_min, job.salary_max)}.`);
    descParts.push(`Qualification: ${job.qualification}.`);
    if (job.last_date_display || job.last_date) descParts.push(`Last date: ${job.last_date_display || formatDate(job.last_date)}.`);
    descParts.push('Apply now on JobsTrackr.');
    let metaDescription = descParts.join(' ');
    if (metaDescription.length > 160) metaDescription = metaDescription.substring(0, 157) + '...';

    // ── Module 4: JSON-LD Structured Data ──
    const jsonLd: any = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description: job.description || `${job.title} recruitment notification from ${job.department}. Check eligibility, salary, age limit and apply online.`,
        datePosted: job.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        validThrough: job.last_date || undefined,
        hiringOrganization: {
            '@type': 'Organization',
            name: job.department,
        },
        jobLocation: {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressCountry: 'IN',
                addressRegion: job.location || 'All India',
            },
        },
        employmentType: 'FULL_TIME',
    };

    if (job.salary_min || job.salary_max) {
        jsonLd.baseSalary = {
            '@type': 'MonetaryAmount',
            currency: 'INR',
            value: {
                '@type': 'QuantitativeValue',
                ...(job.salary_min && { minValue: job.salary_min }),
                ...(job.salary_max && { maxValue: job.salary_max }),
                unitText: 'MONTH',
            },
        };
    }

    if (job.vacancies) jsonLd.totalJobOpenings = job.vacancies;
    if (job.qualification) jsonLd.qualifications = job.qualification;
    if (job.apply_link) {
        jsonLd.applicationContact = {
            '@type': 'ContactPoint',
            url: job.apply_link,
        };
    }

    // ── Module 5: SEO Content Expansion ──
    const salaryDisplay = formatSalary(job.salary_min, job.salary_max);
    const ageDisplay = formatAge(job.age_min, job.age_max);
    const lastDateDisplay = job.last_date_display || formatDate(job.last_date);

    const overviewParagraph = `${escapeHtml(job.department)} has released the official notification for ${escapeHtml(job.title)}.`
        + (job.vacancies_display ? ` A total of ${escapeHtml(job.vacancies_display)} vacancies have been announced.` : '')
        + ` Interested and eligible candidates can apply ${job.last_date ? `before ${escapeHtml(lastDateDisplay)}` : 'through the official website'}.`
        + ` Read below for complete details on eligibility, salary, age limit, and how to apply.`;

    // ── Module 6: Internal Links HTML ──
    let relatedLinksHtml = '';
    if (relatedJobs && relatedJobs.length > 0) {
        const linkItems = relatedJobs.map((rj: any) => {
            const rjUrl = `/jobs/${rj.slug || rj.id}`;
            const anchorText = rj.vacancies_display
                ? `${escapeHtml(rj.title)} – ${escapeHtml(rj.vacancies_display)} Vacancies`
                : escapeHtml(rj.title);
            return `<li style="margin:8px 0"><a href="${escapeHtml(rjUrl)}" style="color:#1d4ed8;text-decoration:underline">${anchorText}</a></li>`;
        }).join('');
        relatedLinksHtml = `
    <nav aria-label="Related Government Jobs" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb">
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:12px;color:#1e3a5f">Related Government Jobs</h2>
      <ul style="list-style:none;padding:0">${linkItems}</ul>
    </nav>`;
    }

    // ── Module 8: Update Signal ──
    const updatedAt = job.updated_at || job.created_at;
    const updatedDateStr = formatDate(updatedAt);
    const verifiedDateStr = job.admin_refreshed_at ? formatDate(job.admin_refreshed_at) : null;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <meta name="robots" content="index, follow">
  <meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:image" content="${siteUrl}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="JobsTrackr">
  <meta property="og:locale" content="en_IN">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${seoTitle}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="${siteUrl}/og-image.png">

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0A4174">

  <style>
    /* SSR content: visible until SPA hydrates and hides it */
    [data-ssr-content] {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #1a1a2e;
      line-height: 1.7;
    }
    [data-ssr-content] h1 { font-size: 1.75rem; font-weight: 800; color: #0A4174; margin-bottom: 8px; }
    [data-ssr-content] h2 { font-size: 1.25rem; font-weight: 700; color: #1e3a5f; margin: 24px 0 8px; }
    [data-ssr-content] p { margin: 8px 0; color: #374151; }
    [data-ssr-content] .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 16px; font-size: 0.85rem; margin-right: 8px; margin-bottom: 8px; }
    [data-ssr-content] .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
    [data-ssr-content] .info-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    [data-ssr-content] .info-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    [data-ssr-content] .info-value { font-size: 1rem; font-weight: 600; color: #0f172a; margin-top: 4px; }
    [data-ssr-content] .update-footer { margin-top: 32px; padding: 16px; background: #f1f5f9; border-radius: 8px; font-size: 0.85rem; color: #475569; }
    /* Hide SSR content once SPA has mounted */
    .spa-mounted [data-ssr-content] { display: none; }
  </style>
</head>
<body>
  <!-- SEO Content (visible to crawlers and pre-render) -->
  <article data-ssr-content itemscope itemtype="https://schema.org/JobPosting">
    <meta itemprop="datePosted" content="${job.created_at?.split('T')[0] || ''}">
    <meta itemprop="validThrough" content="${job.last_date || ''}">

    <header>
      <p style="font-size:0.9rem;color:#64748b;margin-bottom:4px">${escapeHtml(job.department)}</p>
      <h1 itemprop="title">${escapeHtml(job.title)}</h1>
      <div style="margin:12px 0">
        <span class="badge">📍 ${escapeHtml(job.location || 'All India')}</span>
        ${job.vacancies_display ? `<span class="badge">👥 ${escapeHtml(job.vacancies_display)} Vacancies</span>` : ''}
        ${job.is_featured ? '<span class="badge" style="background:#fef3c7;color:#92400e">⭐ Featured</span>' : ''}
      </div>
    </header>

    <!-- Overview -->
    <section>
      <h2>📋 Overview</h2>
      <p>${overviewParagraph}</p>
    </section>

    <!-- Key Details Grid -->
    <section>
      <h2>📊 Key Details</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Qualification</div>
          <div class="info-value" itemprop="qualifications">${escapeHtml(job.qualification)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Age Limit</div>
          <div class="info-value">${escapeHtml(ageDisplay)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Salary</div>
          <div class="info-value">${escapeHtml(salaryDisplay)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Application Fee</div>
          <div class="info-value">${job.application_fee ? '₹' + job.application_fee : 'Check notification'}</div>
        </div>
      </div>
    </section>

    <!-- Eligibility -->
    ${job.eligibility ? `
    <section>
      <h2>✅ Eligibility</h2>
      <p>${escapeHtml(job.eligibility)}</p>
    </section>` : ''}

    <!-- Important Dates -->
    <section>
      <h2>📅 Important Dates</h2>
      <div class="info-grid">
        ${job.application_start_date ? `
        <div class="info-item">
          <div class="info-label">Application Start</div>
          <div class="info-value">${escapeHtml(formatDate(job.application_start_date))}</div>
        </div>` : ''}
        <div class="info-item">
          <div class="info-label">Last Date to Apply</div>
          <div class="info-value">${escapeHtml(lastDateDisplay)}</div>
        </div>
      </div>
    </section>

    <!-- How to Apply -->
    <section>
      <h2>📝 How to Apply</h2>
      <p>
        Visit the official website of ${escapeHtml(job.department)} to apply online for ${escapeHtml(job.title)}.
        ${job.apply_link ? `<br><a href="${escapeHtml(job.apply_link)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:600">Apply Now →</a>` : ''}
      </p>
    </section>

    ${job.description ? `
    <section>
      <h2>ℹ️ About This Job</h2>
      <p>${escapeHtml(job.description)}</p>
    </section>` : ''}

    <!-- Related Jobs (Internal Links) -->
    ${relatedLinksHtml}

    <!-- Update Signal -->
    <footer class="update-footer">
      <time datetime="${updatedAt}">📆 Last updated: ${escapeHtml(updatedDateStr)}</time>
      ${verifiedDateStr ? `<br>✅ Verified on: ${escapeHtml(verifiedDateStr)}` : ''}
    </footer>
  </article>

  <!-- React SPA Mount Point -->
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    // Mark body when SPA mounts to hide SSR content
    const observer = new MutationObserver(() => {
      const root = document.getElementById('root');
      if (root && root.children.length > 0) {
        document.body.classList.add('spa-mounted');
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('root'), { childList: true });
  </script>
</body>
</html>`;
}
