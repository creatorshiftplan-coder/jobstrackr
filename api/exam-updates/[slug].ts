// ── Inlined SSR App Shell (Vercel Edge Functions are single-file) ──

function ssrNavbar(): string {
  return `<header data-ssr-shell class="ssr-navbar">
  <a href="/more" class="ssr-nav-btn" aria-label="Menu">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
  </a>
  <a href="/search" class="ssr-search-bar" aria-label="Search jobs">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span>Search a job...</span>
  </a>
  <a href="/saved" class="ssr-nav-btn" aria-label="Saved jobs">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
  </a>
</header>`;
}

function ssrBottomNav(): string {
  const items = [
    { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', label: 'Home', path: '/' },
    { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', label: 'Explore', path: '/search' },
    { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>', label: 'Trending', path: '/trending' },
    { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', label: 'My Exams', path: '/tracker' },
    { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Profile', path: '/profile' },
  ];
  const navItems = items.map(item =>
    `<a href="${item.path}" class="ssr-bnav-item">${item.icon}<span>${item.label}</span></a>`
  ).join('');
  return `<nav data-ssr-shell class="ssr-bottom-nav" aria-label="Main navigation">
  <div class="ssr-bnav-inner">${navItems}</div>
</nav>`;
}

function ssrCtaBanner(title: string): string {
  const safeName = escapeHtml(title);
  return `<section data-ssr-shell class="ssr-cta-banner">
  <div class="ssr-cta-icon">🔔</div>
  <h3 class="ssr-cta-title">Follow ${safeName}</h3>
  <p class="ssr-cta-text">Track this exam on your dashboard. Get notified about dates, admit cards, and results.</p>
  <div class="ssr-cta-actions">
    <a href="/auth" class="ssr-cta-btn-primary">Follow this Exam</a>
    <a href="/trending" class="ssr-cta-btn-secondary">Browse Trending</a>
  </div>
</section>`;
}

function ssrShellStyles(): string {
  return `
    .ssr-navbar { display:flex;align-items:center;gap:8px;padding:8px 16px;height:56px;background:hsl(0 0% 100%/0.95);backdrop-filter:blur(12px);border-bottom:1px solid hsl(0 0% 90%);position:sticky;top:0;z-index:40; }
    .ssr-nav-btn { width:44px;height:44px;border-radius:50%;background:hsl(210 40% 96%);display:flex;align-items:center;justify-content:center;color:hsl(210 70% 25%);text-decoration:none;flex-shrink:0; }
    .ssr-search-bar { flex:1;display:flex;align-items:center;gap:8px;background:hsl(0 0% 100%/0.6);border:1px solid hsl(0 0% 90%);border-radius:12px;height:44px;padding:0 16px;color:hsl(220 9% 46%);text-decoration:none;font-size:0.9rem; }
    .ssr-bottom-nav { position:fixed;bottom:0;left:0;right:0;background:hsl(0 0% 100%/0.95);backdrop-filter:blur(16px);border-top:1px solid hsl(0 0% 92%);box-shadow:0 -4px 20px -4px rgba(0,0,0,0.1);z-index:50;padding-bottom:env(safe-area-inset-bottom,0); }
    .ssr-bnav-inner { display:flex;align-items:center;justify-content:space-around;height:64px;max-width:512px;margin:0 auto;padding:0 4px; }
    .ssr-bnav-item { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 0;color:hsl(220 9% 46%);text-decoration:none;flex:1;font-size:11px;font-weight:600;letter-spacing:0.02em; }
    .ssr-bnav-item svg { stroke-width:2; }
    .ssr-cta-banner { margin:24px 0;padding:24px;text-align:center;background:linear-gradient(135deg,hsl(210 80% 96%),hsl(210 60% 92%));border:1px solid hsl(210 60% 85%);border-radius:16px; }
    .ssr-cta-icon { font-size:2rem;margin-bottom:8px; }
    .ssr-cta-title { font-size:1.1rem;font-weight:700;color:hsl(210 70% 25%);margin:0 0 8px; }
    .ssr-cta-text { font-size:0.9rem;color:hsl(220 9% 46%);margin:0 0 16px;line-height:1.5; }
    .ssr-cta-actions { display:flex;gap:8px;justify-content:center;flex-wrap:wrap; }
    .ssr-cta-btn-primary { display:inline-block;padding:10px 24px;background:linear-gradient(135deg,hsl(210 80% 40%),hsl(210 90% 55%));color:white;border-radius:24px;font-weight:600;font-size:0.9rem;text-decoration:none; }
    .ssr-cta-btn-secondary { display:inline-block;padding:10px 24px;background:white;color:hsl(210 70% 25%);border:1px solid hsl(210 60% 85%);border-radius:24px;font-weight:600;font-size:0.9rem;text-decoration:none; }
    .spa-mounted [data-ssr-shell] { display:none; }
    .spa-mounted [data-ssr-content] { display:none; }
    `;
}

export const config = {
  runtime: 'edge',
};

/**
 * Exam Update Article SEO Renderer
 * ──────────────────────────────────────────
 * Serves pre-rendered, SEO-complete HTML for /exam-update/:slug (the
 * `exam_updates` table — individual scraped status articles). This is the URL
 * Telegram deep-links to (apps-script/Telegram.gs) and the /exam-update/:id SPA
 * route hydrates over. Mirrors the api/updates/[slug].ts pattern.
 * Includes: dynamic metadata, JSON-LD, semantic content, internal links.
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

// ── Link filtering (mirrors src/lib/urlUtils.ts) ────────────────────────────
function isFreeJobAlertUrl(url: string | null | undefined): boolean {
  return !!url && url.toLowerCase().includes('freejobalert');
}
function isWhatsAppUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('wa.me') || u.includes('chat.whatsapp.com') || u.includes('api.whatsapp.com') ||
    u.includes('whatsapp.com/') || u.includes('whatsapp://');
}
function isTelegramUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('t.me/') || u.includes('//t.me') || u.includes('telegram.me') ||
    u.includes('telegram.org') || u.includes('telegram.dog') || u.includes('tg://') || u.includes('telegram://');
}
function isPdfOrWebsiteLink(url: string | null | undefined): boolean {
  return !!url && !isWhatsAppUrl(url) && !isTelegramUrl(url);
}
type LinkItem = { text?: string | null; url: string };
/** Merge official/download/related links, drop share/junk links, dedupe. */
function getExamPdfWebsiteLinks(update: any): { text: string; url: string }[] {
  const out: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (arr?: LinkItem[] | null) => {
    for (const l of arr || []) {
      if (!l?.url || !isPdfOrWebsiteLink(l.url) || isFreeJobAlertUrl(l.url)) continue;
      const key = l.url.replace(/\/+$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: (l.text || '').trim() || l.url, url: l.url });
    }
  };
  push(update.official_links);
  push(update.download_links);
  push(update.related_links);
  return out;
}

// ── Category → label/colour (mirrors getCategoryConfig in ExamUpdateDetail.tsx) ──
function getCategoryConfig(category: string): { label: string; color: string } {
  const cat = (category || '').toLowerCase().replace(/[_\s]+/g, '');
  if (cat.includes('result') || cat.includes('merit') || cat.includes('score'))
    return { label: 'Result', color: '#22c55e' };
  if (cat.includes('admit') || cat.includes('hall') || cat.includes('ticket'))
    return { label: 'Admit Card', color: '#3b82f6' };
  if (cat.includes('answer') || cat.includes('key'))
    return { label: 'Answer Key', color: '#8b5cf6' };
  if (cat.includes('cutoff') || cat.includes('cut'))
    return { label: 'Cutoff', color: '#f97316' };
  if (cat.includes('syllabus') || cat.includes('pattern'))
    return { label: 'Syllabus', color: '#6366f1' };
  return { label: 'News', color: '#6b7280' };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the columns the SSR page actually renders. Deliberately excludes the
// heavy `full_text` (entire scraped article body), `vacancy_table`, `fee_table`,
// `eligibility_table`, `cutoff_table`, and `images` — none are used here, and
// `select=*` was pulling all of them on every crawler hit (the main egress leak).
const EXAM_UPDATE_SSR_COLS =
  'id,slug,title,category,status,published_date,summary,important_dates,overview,' +
  'official_links,download_links,related_links,related_articles,sections,tags,' +
  'scraped_at,created_at,updated_at,job_id';

// ── Minimal inlined Upstash Redis cache-aside (edge functions stay single-file) ──
// Caches only the heavy primary-row read, and only when a row is found (so a
// newly-published slug is never negatively cached / redirected away). Any Redis
// failure falls through to a direct Supabase read — the page never blocks on cache.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const EXAM_UPDATE_CACHE_TTL = 900; // 15 min — matches the exam-updates list cache

async function redisGetJson<T>(key: string): Promise<T | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.result ? (JSON.parse(body.result) as T) : null;
  } catch {
    return null;
  }
}

async function redisSetJson(key: string, value: unknown, ttl: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'EX', ttl]),
    });
  } catch {
    /* fire-and-forget — never block the response on a cache write */
  }
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const slug = decodeURIComponent(pathParts[pathParts.length - 1] || '');

  if (!slug) {
    return Response.redirect(new URL('/trending', url.origin).toString(), 302);
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    // Resolve by slug first; legacy UUID links fall back to id then 301 → slug.
    const isUuid = UUID_RE.test(slug);
    const cacheKey = `ssr:exam-update:${slug}`;

    // Cache-aside: the row read is the heavy one (sections + JSON blobs). Serve it
    // from Redis when possible so repeat crawler hits don't re-read Supabase.
    let update = await redisGetJson<any>(cacheKey);

    if (!update) {
      let response = await fetch(
        `${supabaseUrl}/rest/v1/exam_updates?${isUuid ? 'id' : 'slug'}=eq.${encodeURIComponent(slug)}&select=${EXAM_UPDATE_SSR_COLS}`,
        { headers }
      );
      let rows = await response.json();
      update = Array.isArray(rows) ? rows[0] : null;

      // If someone passed a slug-shaped value that only matches by id (rare) or vice
      // versa, try the other column before giving up.
      if (!update) {
        response = await fetch(
          `${supabaseUrl}/rest/v1/exam_updates?${isUuid ? 'slug' : 'id'}=eq.${encodeURIComponent(slug)}&select=${EXAM_UPDATE_SSR_COLS}`,
          { headers }
        );
        rows = await response.json();
        update = Array.isArray(rows) ? rows[0] : null;
      }

      // Cache found rows only — never negatively cache a miss (a brand-new slug
      // must resolve immediately, not get redirected to /trending for the TTL).
      if (update) await redisSetJson(cacheKey, update, EXAM_UPDATE_CACHE_TTL);
    }

    // Canonicalise UUID → slug so Telegram/webapp/crawlers converge on one URL.
    if (update && isUuid && update.slug) {
      return Response.redirect(new URL(`/exam-update/${update.slug}`, url.origin).toString(), 301);
    }

    if (!update) {
      return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/trending"></head><body>Redirecting...</body></html>`, {
        status: 200, headers: { 'Content-Type': 'text/html' },
      });
    }

    // Fetch the linked job (by job_id) for the recruitment-details banner + internal link.
    let linkedJob: any = null;
    if (update.job_id) {
      const jobRes = await fetch(
        `${supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(update.job_id)}&select=slug,title,vacancies_display,vacancies&limit=1`,
        { headers }
      );
      const jobs = await jobRes.json();
      linkedJob = Array.isArray(jobs) ? jobs[0] : null;
    }

    // Related updates (same category) for keyword-rich internal links.
    let relatedUpdates: any[] = [];
    if (update.category) {
      const relRes = await fetch(
        `${supabaseUrl}/rest/v1/exam_updates?category=eq.${encodeURIComponent(update.category)}&id=neq.${update.id}&slug=not.is.null&select=slug,title,category&order=scraped_at.desc&limit=5`,
        { headers }
      );
      relatedUpdates = await relRes.json();
      if (!Array.isArray(relatedUpdates)) relatedUpdates = [];
    }

    const html = buildExamUpdatePage(update, linkedJob, relatedUpdates);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Exam-update page error:', error);
    return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/trending"></head><body>Redirecting...</body></html>`, {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }
}

function buildExamUpdatePage(update: any, linkedJob: any, relatedUpdates: any[]): string {
  const siteUrl = 'https://jobstrackr.in';
  const cat = getCategoryConfig(update.category);
  const canonicalUrl = `${siteUrl}/exam-update/${update.slug || update.id}`;

  // ── SEO title & description ─────────────────────────────────────
  const rawTitle = String(update.title || 'Exam Update');
  const seoTitle = `${escapeHtml(rawTitle)} | JobsTrackr`;

  let metaDescription = update.summary
    ? String(update.summary)
    : `${rawTitle} — latest ${cat.label} update. Check dates, download links and official notification on JobsTrackr.`;
  metaDescription = metaDescription.replace(/\s+/g, ' ').trim();
  if (metaDescription.length > 160) metaDescription = metaDescription.substring(0, 157) + '...';

  const datePublished = (update.published_date || update.created_at || '').split('T')[0];
  const dateModified = (update.updated_at || update.scraped_at || update.created_at || '').split('T')[0];

  // ── JSON-LD (Article) ───────────────────────────────────────────
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: rawTitle,
    description: update.summary || metaDescription,
    articleSection: cat.label,
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: 'JobsTrackr' },
    publisher: { '@type': 'Organization', name: 'JobsTrackr', url: siteUrl },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  };

  // ── Summary ─────────────────────────────────────────────────────
  const summaryHtml = update.summary ? `
    <section>
      <h2>📰 Summary</h2>
      <p style="font-size:1rem;line-height:1.8;color:#374151;white-space:pre-line">${escapeHtml(update.summary)}</p>
    </section>` : '';

  // ── Important dates table ───────────────────────────────────────
  let datesHtml = '';
  if (Array.isArray(update.important_dates) && update.important_dates.length > 0) {
    const rows = update.important_dates
      .filter((d: any) => d && (d.event || d.date))
      .map((d: any) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563">${escapeHtml(d.event || '')}</td>
         <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;white-space:nowrap">${escapeHtml(d.date || '')}</td></tr>`
      ).join('');
    if (rows) {
      datesHtml = `
      <section>
        <h2>📅 Important Dates</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;font-size:0.8rem;color:#64748b;text-transform:uppercase">Event</th><th style="padding:8px 12px;text-align:left;font-size:0.8rem;color:#64748b;text-transform:uppercase">Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    }
  }

  // ── Overview grid ───────────────────────────────────────────────
  let overviewHtml = '';
  if (Array.isArray(update.overview) && update.overview.length > 0) {
    const items = update.overview
      .filter((o: any) => o && (o.field || o.value))
      .map((o: any) =>
        `<div style="display:flex;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">
          <span style="color:#64748b;min-width:90px;font-size:0.85rem">${escapeHtml(o.field || '')}</span>
          <span style="font-weight:600;color:#0f172a;font-size:0.9rem">${escapeHtml(o.value || '')}</span>
        </div>`
      ).join('');
    if (items) {
      overviewHtml = `
      <section>
        <h2>📋 Overview</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">${items}</div>
      </section>`;
    }
  }

  // ── Quick links (real PDF / official-website links only) ────────
  let linksHtml = '';
  const pdfLinks = getExamPdfWebsiteLinks(update);
  if (pdfLinks.length > 0) {
    const items = pdfLinks.map((l) =>
      `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;font-weight:600;font-size:0.85rem;text-decoration:none">🔗 ${escapeHtml(l.text.length > 50 ? l.text.slice(0, 50) + '…' : l.text)}</a>`
    ).join('');
    linksHtml = `
    <section>
      <h2>⬇️ Quick Links</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${items}</div>
    </section>`;
  }

  // ── Detail sections (rendered expanded for SEO, not accordion) ──
  let sectionsHtml = '';
  if (Array.isArray(update.sections) && update.sections.length > 0) {
    const blocks = update.sections
      .filter((s: any) => s && (s.heading || (Array.isArray(s.content) && s.content.length)))
      .map((s: any) => {
        const paras = (Array.isArray(s.content) ? s.content : [])
          .map((line: string) => `<p style="color:#374151;margin:6px 0">${escapeHtml(line)}</p>`).join('');
        return `<div style="margin-bottom:16px">
          ${s.heading ? `<h3 style="font-size:1rem;font-weight:600;color:#1e3a5f;margin:12px 0 4px">${escapeHtml(s.heading)}</h3>` : ''}
          ${paras}
        </div>`;
      }).join('');
    if (blocks) {
      sectionsHtml = `
      <section>
        <h2>📖 Details</h2>
        ${blocks}
      </section>`;
    }
  }

  // ── Recruitment details banner (linked job) ─────────────────────
  let jobHtml = '';
  if (linkedJob && linkedJob.slug) {
    const vac = linkedJob.vacancies_display || (linkedJob.vacancies ? `${linkedJob.vacancies} Posts` : '');
    jobHtml = `
    <section style="margin-top:24px;padding:16px 20px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px">
      <span style="font-size:0.7rem;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Recruitment Details</span>
      <h3 style="font-size:1.05rem;font-weight:700;color:#0f172a;margin:6px 0">${escapeHtml(linkedJob.title || rawTitle)}</h3>
      ${vac ? `<p style="color:#2563eb;font-weight:600;font-size:0.9rem;margin:0 0 12px">${escapeHtml(vac)} Vacancies</p>` : ''}
      <a href="/jobs/${escapeHtml(linkedJob.slug)}" style="display:inline-block;padding:8px 20px;background:#2563eb;color:white;border-radius:20px;font-weight:600;text-decoration:none;font-size:0.9rem">View Full Job Details →</a>
    </section>`;
  }

  // ── Related articles (external, filtered) ───────────────────────
  let relatedArticlesHtml = '';
  if (Array.isArray(update.related_articles) && update.related_articles.length > 0) {
    const items = update.related_articles
      .filter((ra: any) => ra?.url && isPdfOrWebsiteLink(ra.url) && !isFreeJobAlertUrl(ra.url))
      .map((ra: any) =>
        `<li style="margin:6px 0"><a href="${escapeHtml(ra.url)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline;font-weight:500">${escapeHtml(ra.title || ra.url)}</a></li>`
      ).join('');
    if (items) {
      relatedArticlesHtml = `
      <section>
        <h2>🔎 Related Articles</h2>
        <ul style="list-style:none;padding:0">${items}</ul>
      </section>`;
    }
  }

  // ── Tags ────────────────────────────────────────────────────────
  let tagsHtml = '';
  if (Array.isArray(update.tags) && update.tags.length > 0) {
    const items = update.tags
      .filter((t: string) => t)
      .map((t: string) => `<span style="display:inline-block;padding:4px 12px;background:#f1f5f9;color:#475569;border-radius:16px;font-size:0.8rem">${escapeHtml(t)}</span>`)
      .join('');
    if (items) {
      tagsHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:24px">${items}</div>`;
    }
  }

  // ── Related updates (internal links, keyword-rich anchors) ──────
  let relatedHtml = '';
  if (relatedUpdates.length > 0) {
    const linkItems = relatedUpdates
      .filter((ru: any) => ru?.slug && ru?.title)
      .map((ru: any) =>
        `<li style="margin:8px 0"><a href="/exam-update/${escapeHtml(ru.slug)}" style="color:#1d4ed8;text-decoration:underline;font-weight:500">${escapeHtml(ru.title)}</a></li>`
      ).join('');
    if (linkItems) {
      relatedHtml = `
      <nav aria-label="Related Updates" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb">
        <h2>Related Updates</h2>
        <ul style="list-style:none;padding:0">${linkItems}</ul>
      </nav>`;
    }
  }

  const updatedAt = update.updated_at || update.scraped_at || update.created_at;

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
    [data-ssr-content] { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px 96px; color: #1a1a2e; line-height: 1.7; }
    [data-ssr-content] h1 { font-size: 1.75rem; font-weight: 800; color: #0A4174; margin-bottom: 8px; }
    [data-ssr-content] h2 { font-size: 1.25rem; font-weight: 700; color: #1e3a5f; margin: 24px 0 8px; }
    [data-ssr-content] p { margin: 8px 0; color: #374151; }
    ${ssrShellStyles()}
  </style>
  <!-- PROD_HEAD_ASSETS_START -->
  <link rel="modulepreload" crossorigin href="/assets/vendor-react-odAJResg.js">
  <link rel="modulepreload" crossorigin href="/assets/client-DdVvhE6k.js">
  <link rel="modulepreload" crossorigin href="/assets/vendor-query-nUca_sEF.js">
  <link rel="modulepreload" crossorigin href="/assets/vendor-ui--HBZjmSF.js">
  <link rel="modulepreload" crossorigin href="/assets/vendor-icons-DWYma5Ru.js">
  <link rel="modulepreload" crossorigin href="/assets/vendor-supabase-BvsnE-zR.js">
  <link rel="modulepreload" crossorigin href="/assets/vendor-lottie-8Z6zZkhm.js">
  <link rel="stylesheet" crossorigin href="/assets/main-vJ8SOXTg.css">
  <!-- PROD_HEAD_ASSETS_END -->
</head>
<body>
  ${ssrNavbar()}
  <article data-ssr-content>
    <header>
      <a href="/trending" style="color:#64748b;text-decoration:none;font-size:0.9rem">← Back to Trending</a>
      <div style="margin:16px 0">
        <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:0.85rem;font-weight:600;color:white;background:${cat.color}">${escapeHtml(cat.label)}</span>
        ${update.status ? `<span style="margin-left:8px;font-size:0.85rem;color:#64748b">${escapeHtml(update.status)}</span>` : ''}
        ${update.published_date ? `<span style="margin-left:8px;font-size:0.85rem;color:#64748b">${escapeHtml(formatDate(update.published_date))}</span>` : ''}
      </div>
      <h1>${escapeHtml(rawTitle)}</h1>
    </header>

    ${summaryHtml}
    ${datesHtml}
    ${overviewHtml}
    ${linksHtml}
    ${sectionsHtml}
    ${jobHtml}
    ${relatedArticlesHtml}
    ${tagsHtml}
    ${relatedHtml}

    ${ssrCtaBanner(rawTitle)}

    <footer style="margin-top:32px;padding:16px;background:#f1f5f9;border-radius:8px;font-size:0.85rem;color:#475569">
      <time datetime="${escapeHtml(updatedAt || '')}">📆 Last updated: ${escapeHtml(formatDate(updatedAt))}</time>
    </footer>
  </article>

  ${ssrBottomNav()}
  <div id="root"></div>
  <!-- PROD_BODY_ASSETS_START -->
  <script type="module" crossorigin src="/assets/main-B9-TzLIP.js"></script>
  <!-- PROD_BODY_ASSETS_END -->
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
