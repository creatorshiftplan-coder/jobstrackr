/**
 * useRouteSeo — applies per-route SEO head tags on client-side navigation.
 * ────────────────────────────────────────────────────────────
 * Phase 1 of the SEO plan. Sets <title>, meta description, canonical link, the
 * robots directive, and keeps og:url/og:title/og:description in sync, based on
 * the route config in seoConfig.ts.
 *
 * Safety:
 *  - Runs only in the browser, after hydration.
 *  - Updates existing tags in place (no duplicates); creates a tag only if the
 *    document lacks it.
 *  - Skips title/description for SSR/data-driven routes (/jobs, /updates,
 *    /countdown/*) so server-rendered or page-managed values are preserved.
 *  - Pure side effect; renders nothing and never throws into React.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveSeo } from '@/lib/seoConfig';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useRouteSeo(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    try {
      const seo = resolveSeo(pathname);

      if (!seo.skipTitle && seo.title) {
        document.title = seo.title;
        upsertMeta('property', 'og:title', seo.title);
      }

      if (!seo.skipDescription && seo.description) {
        upsertMeta('name', 'description', seo.description);
        upsertMeta('property', 'og:description', seo.description);
      }

      upsertMeta('name', 'robots', seo.robots);
      upsertCanonical(seo.canonical);
      upsertMeta('property', 'og:url', seo.canonical);
    } catch {
      // SEO is non-critical; never break the app over a head update.
    }
  }, [pathname]);
}
