export const config = {
    runtime: 'edge',
};

/**
 * Universal Status Update Page SEO Renderer
 * ──────────────────────────────────────────
 * Serves pre-rendered, SEO-complete HTML for /updates/:slug
 * Includes: dynamic metadata, JSON-LD, semantic content, internal links
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

function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'To be announced';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    } catch { return dateStr; }
}

// Determine status type from AI data (mirrors examStatus.ts logic)
function getStatusType(aiData: any): { type: string; label: string; color: string } {
    if (!aiData) return { type: 'update', label: 'Update', color: '#64748b' };

    const combined = `${(aiData.current_status || '').toLowerCase()} ${(aiData.summary || '').toLowerCase()} ${(aiData.exam_dates || '').toLowerCase()}`;

    if (/result (out|declared|released|announced)|merit list|cutoff released/.test(combined))
        return { type: 'result', label: 'Result Released', color: '#22c55e' };
    if (/admit card (released|out|available|download)|hall ticket (released|out)|call letter/.test(combined))
        return { type: 'admit_card', label: 'Admit Card Released', color: '#f59e0b' };
    if (/answer key|response sheet|objection/.test(combined))
        return { type: 'answer_key', label: 'Answer Key Released', color: '#06b6d4' };
    if (/exam date (released|announced)|exam dates (released|announced)/.test(combined))
        return { type: 'exam_date', label: 'Exam Date Released', color: '#a855f7' };
    if (/exam scheduled|exam on|examination on|exam will be held/.test(combined))
        return { type: 'exam_scheduled', label: 'Exam Scheduled', color: '#8b5cf6' };
    if (/postponed|rescheduled|date changed|revised date/.test(combined))
        return { type: 'date_change', label: 'Date Changed', color: '#ef4444' };
    if (/apply now|apply online|registration started|notification released/.test(combined))
        return { type: 'notification', label: 'Notification Released', color: '#3b82f6' };

    return { type: 'update', label: 'Latest Update', color: '#64748b' };
}

export default async function handler(request: Request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
        return Response.redirect(new URL('/trending', url.origin).toString(), 302);
    }

    try {
        const supabaseUrl = 'https://fdxksytpdfgmbkttipdf.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkeGtzeXRwZGZnbWJrdHRpcGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM1MTYsImV4cCI6MjA4MDQyOTUxNn0.NocVE7TCJIQgIhbHkxhHWraBRxyCkLIdgUQ3ERCHuKQ';

        // Fetch exam by update_slug
        let response = await fetch(
            `${supabaseUrl}/rest/v1/exams?update_slug=eq.${encodeURIComponent(slug)}&select=*`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );

        let exams = await response.json();
        let exam = exams[0];

        // UUID fallback
        if (!exam && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)) {
            response = await fetch(
                `${supabaseUrl}/rest/v1/exams?id=eq.${encodeURIComponent(slug)}&select=*`,
                { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
            );
            exams = await response.json();
            exam = exams[0];
            if (exam?.update_slug) {
                return Response.redirect(new URL(`/updates/${exam.update_slug}`, url.origin).toString(), 301);
            }
        }

        if (!exam) {
            return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/trending"></head><body>Redirecting...</body></html>`, {
                status: 200, headers: { 'Content-Type': 'text/html' },
            });
        }

        const aiData = exam.ai_cached_response || {};
        const status = getStatusType(aiData);

        // Try to find matching job for enrichment
        const normalizedName = exam.name.toLowerCase().replace(/\s+/g, ' ').trim();
        const jobResponse = await fetch(
            `${supabaseUrl}/rest/v1/jobs?title=ilike.%25${encodeURIComponent(normalizedName)}%25&select=slug,title,department,qualification,salary_min,salary_max,vacancies,vacancies_display,eligibility,apply_link,age_min,age_max&order=created_at.desc&limit=1`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const jobs = await jobResponse.json();
        const linkedJob = Array.isArray(jobs) ? jobs[0] : null;

        // Fetch related updates (same category or conducting body)
        let relatedFilter = '';
        if (exam.category) {
            relatedFilter = `category=eq.${encodeURIComponent(exam.category)}`;
        } else if (exam.conducting_body) {
            relatedFilter = `conducting_body=eq.${encodeURIComponent(exam.conducting_body)}`;
        }

        let relatedExams: any[] = [];
        if (relatedFilter) {
            const relatedResponse = await fetch(
                `${supabaseUrl}/rest/v1/exams?${relatedFilter}&id=neq.${exam.id}&update_slug=not.is.null&select=update_slug,name,ai_cached_response&order=ai_last_updated_at.desc&limit=5`,
                { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
            );
            relatedExams = await relatedResponse.json();
            if (!Array.isArray(relatedExams)) relatedExams = [];
        }

        const html = buildUpdatePage(exam, aiData, status, linkedJob, relatedExams, url.origin);

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('Update page error:', error);
        return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/trending"></head><body>Redirecting...</body></html>`, {
            status: 200, headers: { 'Content-Type': 'text/html' },
        });
    }
}

function buildUpdatePage(exam: any, aiData: any, status: { type: string; label: string; color: string }, linkedJob: any, relatedExams: any[], origin: string): string {
    const siteUrl = 'https://jobstrackr.in';
    const year = new Date().getFullYear();
    const canonicalUrl = `${siteUrl}/updates/${exam.update_slug || exam.id}`;

    // SEO Title
    const seoTitle = `${escapeHtml(exam.name)} ${status.label} ${year} – Download, Dates, Updates | JobsTrackr`;

    // Meta description
    const descParts: string[] = [];
    descParts.push(`Latest update for ${exam.name}: ${status.label}.`);
    if (aiData.exam_dates) descParts.push(`Exam dates: ${aiData.exam_dates}.`);
    if (aiData.eligibility) descParts.push(`Eligibility: ${aiData.eligibility.substring(0, 60)}.`);
    descParts.push('Check official links on JobsTrackr.');
    let metaDescription = descParts.join(' ');
    if (metaDescription.length > 160) metaDescription = metaDescription.substring(0, 157) + '...';

    // JSON-LD
    const isEvent = ['exam_scheduled', 'exam_date', 'admit_card'].includes(status.type);
    const jsonLd: any = isEvent ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: `${exam.name} – ${status.label}`,
        description: aiData.summary || `${status.label} for ${exam.name}`,
        startDate: aiData.exam_dates || undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        organizer: { '@type': 'Organization', name: exam.conducting_body || exam.name },
        location: { '@type': 'Place', name: 'India', address: { '@type': 'PostalAddress', addressCountry: 'IN' } },
    } : {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${exam.name} ${status.label} ${year}`,
        description: aiData.summary || metaDescription,
        datePublished: exam.created_at?.split('T')[0],
        dateModified: (exam.updated_at || exam.created_at)?.split('T')[0],
        author: { '@type': 'Organization', name: 'JobsTrackr' },
        publisher: { '@type': 'Organization', name: 'JobsTrackr', url: siteUrl },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    };

    // Updates timeline HTML
    let updatesHtml = '';
    if (aiData.latest_updates && aiData.latest_updates.length > 0) {
        const items = aiData.latest_updates.map((u: any, i: number) => {
            const text = typeof u === 'string' ? u : (u.description || u.title || '');
            const title = typeof u === 'object' && u.title ? `<strong>${escapeHtml(u.title)}</strong><br>` : '';
            return `<li style="position:relative;padding-left:24px;padding-bottom:16px;border-left:2px solid #e2e8f0">
        <span style="position:absolute;left:-6px;top:2px;width:10px;height:10px;border-radius:50%;background:${status.color}"></span>
        ${title}<span style="color:#374151">${escapeHtml(text)}</span>
      </li>`;
        }).join('');
        updatesHtml = `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 12px">📋 Updates Timeline</h2>
      <ul style="list-style:none;padding:0;margin:0">${items}</ul>
    </section>`;
    }

    // Predicted events / Phase details
    let phaseHtml = '';
    if (aiData.predicted_events && aiData.predicted_events.length > 0) {
        const rows = aiData.predicted_events.map((e: any) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${escapeHtml(e.event_type || '')}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563">${escapeHtml(e.predicted_date || 'TBA')}</td></tr>`
        ).join('');
        phaseHtml = `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 12px">📅 Phase Details & Expected Dates</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f8fafc"><th style="padding:10px 12px;text-align:left;font-size:0.85rem;color:#64748b;text-transform:uppercase">Event</th><th style="padding:10px 12px;text-align:left;font-size:0.85rem;color:#64748b;text-transform:uppercase">Expected Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
    }

    // Recommendations
    let recsHtml = '';
    if (aiData.recommendations && aiData.recommendations.length > 0) {
        const items = aiData.recommendations.map((r: string) =>
            `<li style="display:flex;align-items:flex-start;gap:8px;margin:8px 0"><span style="color:#f59e0b;flex-shrink:0">💡</span><span style="color:#374151">${escapeHtml(r)}</span></li>`
        ).join('');
        recsHtml = `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 12px">💡 Recommendations</h2>
      <ul style="list-style:none;padding:0">${items}</ul>
    </section>`;
    }

    // Linked job info
    let jobInfoHtml = '';
    if (linkedJob) {
        const salary = linkedJob.salary_min && linkedJob.salary_max
            ? `₹${linkedJob.salary_min.toLocaleString('en-IN')} – ₹${linkedJob.salary_max.toLocaleString('en-IN')}/month`
            : linkedJob.salary_min ? `₹${linkedJob.salary_min.toLocaleString('en-IN')}+/month` : 'Not disclosed';
        const age = linkedJob.age_min && linkedJob.age_max
            ? `${linkedJob.age_min} – ${linkedJob.age_max} years` : 'Check notification';
        const vacancies = linkedJob.vacancies_display || (linkedJob.vacancies ? `${linkedJob.vacancies}` : 'Check notification');

        jobInfoHtml = `
    <section style="margin-top:24px;padding:20px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px">
      <h2 style="font-size:1.25rem;font-weight:700;color:#0369a1;margin:0 0 16px">📊 Job Details</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        <div><span style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Vacancies</span><p style="font-weight:600;margin:4px 0 0;color:#0f172a">${escapeHtml(vacancies)}</p></div>
        <div><span style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Salary</span><p style="font-weight:600;margin:4px 0 0;color:#0f172a">${escapeHtml(salary)}</p></div>
        <div><span style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Age Limit</span><p style="font-weight:600;margin:4px 0 0;color:#0f172a">${escapeHtml(age)}</p></div>
        ${linkedJob.qualification ? `<div><span style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Qualification</span><p style="font-weight:600;margin:4px 0 0;color:#0f172a">${escapeHtml(linkedJob.qualification)}</p></div>` : ''}
      </div>
      ${linkedJob.eligibility ? `<p style="margin-top:12px;font-size:0.9rem;color:#374151"><strong>Eligibility:</strong> ${escapeHtml(linkedJob.eligibility)}</p>` : ''}
      ${linkedJob.slug ? `<a href="/jobs/${escapeHtml(linkedJob.slug)}" style="display:inline-block;margin-top:12px;color:#0369a1;font-weight:600;text-decoration:underline">View Full Job Details →</a>` : ''}
    </section>`;
    }

    // Related updates (internal links)
    let relatedHtml = '';
    if (relatedExams.length > 0) {
        const linkItems = relatedExams.map((re: any) => {
            const reStatus = getStatusType(re.ai_cached_response);
            return `<li style="margin:8px 0"><a href="/updates/${escapeHtml(re.update_slug)}" style="color:#1d4ed8;text-decoration:underline">${escapeHtml(re.name)} – ${reStatus.label}</a></li>`;
        }).join('');
        relatedHtml = `
    <nav aria-label="Related Updates" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb">
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:12px;color:#1e3a5f">Related Updates</h2>
      <ul style="list-style:none;padding:0">${linkItems}</ul>
    </nav>`;
    }

    const updatedAt = exam.updated_at || exam.created_at;

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

  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:image" content="${siteUrl}/og-image.png">
  <meta property="og:site_name" content="JobsTrackr">
  <meta property="og:locale" content="en_IN">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${seoTitle}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <link rel="icon" href="/favicon.ico"><meta name="theme-color" content="#0A4174">

  <style>
    [data-ssr-content] { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px; color: #1a1a2e; line-height: 1.7; }
    [data-ssr-content] h1 { font-size: 1.75rem; font-weight: 800; color: #0A4174; margin-bottom: 8px; }
    [data-ssr-content] h2 { font-size: 1.25rem; font-weight: 700; color: #1e3a5f; margin: 24px 0 8px; }
    [data-ssr-content] p { margin: 8px 0; color: #374151; }
    .spa-mounted [data-ssr-content] { display: none; }
  </style>
</head>
<body>
  <article data-ssr-content>
    <header>
      <a href="/trending" style="color:#64748b;text-decoration:none;font-size:0.9rem">← Back to Trending</a>
      <div style="margin:16px 0">
        <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:0.85rem;font-weight:600;color:white;background:${status.color}">${escapeHtml(status.label)}</span>
        ${exam.conducting_body ? `<span style="margin-left:8px;font-size:0.85rem;color:#64748b">${escapeHtml(exam.conducting_body)}</span>` : ''}
      </div>
      <h1>${escapeHtml(exam.name)} – ${escapeHtml(status.label)}</h1>
    </header>

    ${aiData.summary ? `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 8px">📰 Latest News</h2>
      <p style="font-size:1rem;line-height:1.8;color:#374151">${escapeHtml(aiData.summary)}</p>
    </section>` : ''}

    ${updatesHtml}
    ${phaseHtml}

    ${aiData.exam_dates ? `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 8px">📅 Important Dates</h2>
      <p style="color:#374151">${escapeHtml(aiData.exam_dates)}</p>
    </section>` : ''}

    ${aiData.eligibility ? `
    <section>
      <h2 style="font-size:1.25rem;font-weight:700;color:#1e3a5f;margin:24px 0 8px">✅ Eligibility</h2>
      <p style="color:#374151">${escapeHtml(aiData.eligibility)}</p>
    </section>` : ''}

    ${recsHtml}
    ${jobInfoHtml}
    ${relatedHtml}

    <footer style="margin-top:32px;padding:16px;background:#f1f5f9;border-radius:8px;font-size:0.85rem;color:#475569">
      <time datetime="${updatedAt}">📆 Last updated: ${escapeHtml(formatDate(updatedAt))}</time>
    </footer>
  </article>

  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
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
