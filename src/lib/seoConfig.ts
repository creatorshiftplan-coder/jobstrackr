/**
 * Per-route SEO configuration for the SPA (Phase 1).
 * ────────────────────────────────────────────────────────────
 * The dynamic pages /jobs/:slug and /updates/:slug are server-rendered by
 * edge functions (api/jobs/[slug].ts, api/updates/[slug].ts) and author their
 * OWN <title>, meta description, canonical and JSON-LD. For those routes this
 * config sets `skipTitle`/`skipDescription` so the SSR/page-managed values are
 * never clobbered after hydration — it only ensures a correct self-canonical.
 *
 * For all other (client-rendered) routes this provides a unique title,
 * description, canonical and robots directive — fixing the previous behaviour
 * where every route inherited the homepage meta and a homepage canonical.
 */

import seoRoutes from './seoRoutes.json';

export const SITE_URL = seoRoutes.siteUrl;

export const DEFAULT_TITLE = seoRoutes.defaultTitle;
export const DEFAULT_DESCRIPTION = seoRoutes.defaultDescription;

const INDEX = 'index, follow';
const NOINDEX = 'noindex, follow';

export interface RouteSeo {
  /** Page <title>. Omitted when the page manages its own title. */
  title?: string;
  /** Meta description. Omitted when SSR/page manages it. */
  description?: string;
  /** Robots directive. Defaults to "index, follow". */
  robots?: string;
  /** Leave document.title to the page component (data-driven pages). */
  skipTitle?: boolean;
  /** Leave the meta description to SSR/page (data-driven pages). */
  skipDescription?: boolean;
  /** Override the canonical path. Defaults to the current pathname. */
  canonicalPath?: string;
}

/** Resolved, fully-defaulted SEO values for a given pathname. */
export interface ResolvedSeo {
  title?: string;
  description?: string;
  robots: string;
  canonical: string;
  skipTitle: boolean;
  skipDescription: boolean;
}

/**
 * Exact-path config, loaded from seoRoutes.json so the runtime values and the
 * build-time pre-render in scripts/postbuild.js can never drift apart.
 */
const STATIC: Record<string, RouteSeo> = seoRoutes.routes as Record<string, RouteSeo>;

/**
 * Prefix matchers for dynamic routes (checked only when no exact match).
 * Order matters — first match wins.
 */
const PREFIX_RULES: Array<{ prefix: string; seo: RouteSeo }> = [
  // SSR-managed pages: keep their own title/description, just self-canonical.
  { prefix: '/jobs/', seo: { skipTitle: true, skipDescription: true, robots: INDEX } },
  { prefix: '/updates/', seo: { skipTitle: true, skipDescription: true, robots: INDEX } },
  // Data-driven countdown pages set their own title.
  { prefix: '/countdown/live', seo: { skipTitle: true, skipDescription: true, robots: INDEX } },
  { prefix: '/countdown/', seo: { skipTitle: true, skipDescription: true, robots: INDEX } },
  // SSR-managed exam-update articles (api/exam-updates/[slug].ts) — page owns its
  // own title/description; keep index and let it self-canonical.
  { prefix: '/exam-update/', seo: { skipTitle: true, skipDescription: true, robots: INDEX } },
  // Legacy id-based / personalised routes → noindex.
  { prefix: '/job/', seo: { skipTitle: true, skipDescription: true, robots: NOINDEX } },
  { prefix: '/for-you/shelf/', seo: { title: 'Recommendations | JobsTrackr', robots: NOINDEX } },
];

/** Normalise a pathname: strip trailing slash (except root), drop query/hash. */
function normalizePath(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '');
  return path;
}

function buildCanonical(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/** Resolve fully-defaulted SEO values for a pathname. */
export function resolveSeo(pathname: string): ResolvedSeo {
  const path = normalizePath(pathname);

  let rule: RouteSeo | undefined = STATIC[path];

  if (!rule) {
    const prefixMatch = PREFIX_RULES.find((r) => path === r.prefix || path.startsWith(r.prefix));
    rule = prefixMatch?.seo;
  }

  // Unknown path → treat as not-found: noindex, generic title.
  if (!rule) {
    rule = { title: 'Page Not Found | JobsTrackr', robots: NOINDEX };
  }

  return {
    title: rule.skipTitle ? undefined : rule.title,
    description: rule.skipDescription ? undefined : rule.description,
    robots: rule.robots ?? INDEX,
    canonical: buildCanonical(rule.canonicalPath ?? path),
    skipTitle: !!rule.skipTitle,
    skipDescription: !!rule.skipDescription,
  };
}
