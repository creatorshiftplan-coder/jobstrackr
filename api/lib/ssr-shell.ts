/**
 * Shared SSR App Shell Components
 * ────────────────────────────────
 * Provides consistent app shell HTML for all Edge API SEO renderers.
 * Matches the SPA's PageHeader + BottomNav styling.
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

/** SSR PageHeader — branding bar with logo, search, and saved links */
export function ssrNavbar(): string {
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

/** SSR BottomNav — 5-item navigation matching the SPA BottomNav */
export function ssrBottomNav(): string {
    const items = [
        { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', label: 'Home', path: '/' },
        { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', label: 'Explore', path: '/search' },
        { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>', label: 'Trending', path: '/trending' },
        { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', label: 'My Exams', path: '/tracker' },
        { icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Profile', path: '/profile' },
    ];

    const navItems = items.map(item =>
        `<a href="${item.path}" class="ssr-bnav-item">
      ${item.icon}
      <span>${item.label}</span>
    </a>`
    ).join('');

    return `<nav data-ssr-shell class="ssr-bottom-nav" aria-label="Main navigation">
  <div class="ssr-bnav-inner">${navItems}</div>
</nav>`;
}

/** SSR CTA Banner — promotes app discovery */
export function ssrCtaBanner(type: 'job' | 'exam', title: string): string {
    const safeName = escapeHtml(title);
    if (type === 'job') {
        return `<section data-ssr-shell class="ssr-cta-banner">
  <div class="ssr-cta-icon">🚀</div>
  <h3 class="ssr-cta-title">Track ${safeName} on JobsTrackr</h3>
  <p class="ssr-cta-text">Get instant alerts for exam dates, admit cards, and results. Never miss a deadline.</p>
  <div class="ssr-cta-actions">
    <a href="/auth" class="ssr-cta-btn-primary">Open Dashboard</a>
    <a href="/trending" class="ssr-cta-btn-secondary">Browse Trending</a>
  </div>
</section>`;
    }
    return `<section data-ssr-shell class="ssr-cta-banner">
  <div class="ssr-cta-icon">🔔</div>
  <h3 class="ssr-cta-title">Follow ${safeName}</h3>
  <p class="ssr-cta-text">Track this exam on your dashboard. Get notified about dates, admit cards, and results.</p>
  <div class="ssr-cta-actions">
    <a href="/auth" class="ssr-cta-btn-primary">Follow this Exam</a>
    <a href="/tracker" class="ssr-cta-btn-secondary">My Exams</a>
  </div>
</section>`;
}

/** SSR Shell Styles — CSS for navbar, bottom nav, and CTA */
export function ssrShellStyles(): string {
    return `
    /* ── SSR App Shell ── */
    .ssr-navbar {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; height: 56px;
      background: hsl(0 0% 100% / 0.95); backdrop-filter: blur(12px);
      border-bottom: 1px solid hsl(0 0% 90%);
      position: sticky; top: 0; z-index: 40;
    }
    .ssr-nav-btn {
      width: 44px; height: 44px; border-radius: 50%;
      background: hsl(210 40% 96%); display: flex;
      align-items: center; justify-content: center;
      color: hsl(210 70% 25%); text-decoration: none;
      flex-shrink: 0;
    }
    .ssr-search-bar {
      flex: 1; display: flex; align-items: center; gap: 8px;
      background: hsl(0 0% 100% / 0.6); border: 1px solid hsl(0 0% 90%);
      border-radius: 12px; height: 44px; padding: 0 16px;
      color: hsl(220 9% 46%); text-decoration: none; font-size: 0.9rem;
    }
    .ssr-bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: hsl(0 0% 100% / 0.95); backdrop-filter: blur(16px);
      border-top: 1px solid hsl(0 0% 92%);
      box-shadow: 0 -4px 20px -4px rgba(0,0,0,0.1);
      z-index: 50; padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .ssr-bnav-inner {
      display: flex; align-items: center; justify-content: space-around;
      height: 64px; max-width: 512px; margin: 0 auto; padding: 0 4px;
    }
    .ssr-bnav-item {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 4px; padding: 8px 0;
      color: hsl(220 9% 46%); text-decoration: none; flex: 1;
      font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
    }
    .ssr-bnav-item svg { stroke-width: 2; }

    /* CTA Banner */
    .ssr-cta-banner {
      margin: 24px 0; padding: 24px; text-align: center;
      background: linear-gradient(135deg, hsl(210 80% 96%), hsl(210 60% 92%));
      border: 1px solid hsl(210 60% 85%); border-radius: 16px;
    }
    .ssr-cta-icon { font-size: 2rem; margin-bottom: 8px; }
    .ssr-cta-title {
      font-size: 1.1rem; font-weight: 700; color: hsl(210 70% 25%);
      margin: 0 0 8px;
    }
    .ssr-cta-text {
      font-size: 0.9rem; color: hsl(220 9% 46%); margin: 0 0 16px;
      line-height: 1.5;
    }
    .ssr-cta-actions {
      display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
    }
    .ssr-cta-btn-primary {
      display: inline-block; padding: 10px 24px;
      background: linear-gradient(135deg, hsl(210 80% 40%), hsl(210 90% 55%));
      color: white; border-radius: 24px; font-weight: 600;
      font-size: 0.9rem; text-decoration: none;
    }
    .ssr-cta-btn-secondary {
      display: inline-block; padding: 10px 24px;
      background: white; color: hsl(210 70% 25%);
      border: 1px solid hsl(210 60% 85%); border-radius: 24px;
      font-weight: 600; font-size: 0.9rem; text-decoration: none;
    }

    /* Hide shell when SPA mounts */
    .spa-mounted [data-ssr-shell] { display: none; }
    .spa-mounted [data-ssr-content] { display: none; }
    `;
}
