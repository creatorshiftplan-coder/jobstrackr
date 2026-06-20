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

export const SITE_URL = 'https://jobstrackr.in';

export const DEFAULT_TITLE = 'JobsTrackr – Government Job Tracker & Eligibility Finder';
export const DEFAULT_DESCRIPTION =
  "Track government job exams, find which exams you're eligible for, and never miss a deadline — JobsTrackr is India's smartest free government job tracking app.";

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

/** Exact-path config. */
const STATIC: Record<string, RouteSeo> = {
  '/': { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonicalPath: '/' },
  '/welcome': {
    title: 'Welcome to JobsTrackr – Smart Government Job Tracker',
    description:
      'Get started with JobsTrackr. Track government exams, check your eligibility automatically, and stay ahead of every Sarkari job deadline — free.',
  },
  '/search': {
    title: 'Search Government Jobs & Exams | JobsTrackr',
    description:
      'Search the latest government job notifications and exams across India by department, qualification, and location on JobsTrackr.',
  },
  '/trending': {
    title: 'Trending Government Jobs & Exams | JobsTrackr',
    description:
      'See the most popular government job notifications and exams aspirants are tracking right now on JobsTrackr.',
  },
  '/calendar': {
    title: 'Government Exam Calendar | JobsTrackr',
    description:
      'View an organised calendar of upcoming government exam dates, application deadlines, and important events for Indian government jobs.',
  },
  '/countdown': {
    title: 'Government Exam Countdown Wall | JobsTrackr',
    description:
      'Live countdowns to upcoming government exam dates and application deadlines. Never miss an important Sarkari job date again.',
  },
  '/syllabus': {
    title: 'Government Exam Syllabus Checker | JobsTrackr',
    description:
      'Check the complete syllabus for government exams in one place. Know exactly what to study for your next Sarkari exam on JobsTrackr.',
  },
  '/formmate': {
    title: 'FormMate – Government Job Application Helper | JobsTrackr',
    description:
      'FormMate puts every detail you need to fill a government job application in one place, so you can apply faster and error-free.',
  },
  '/for-you': {
    title: 'Recommended Government Jobs For You | JobsTrackr',
    description:
      'Personalised government job and exam recommendations based on your qualification, age, and preferences on JobsTrackr.',
  },
  '/faq': {
    title: 'Frequently Asked Questions | JobsTrackr',
    description:
      'Answers to common questions about JobsTrackr — eligibility matching, exam tracking, alerts, and how to use the app.',
  },
  '/help': {
    title: 'Help & Support | JobsTrackr',
    description: 'Get help using JobsTrackr — guides and support for tracking government jobs and exams.',
  },
  '/user-manual': {
    title: 'User Manual | JobsTrackr',
    description: 'A complete guide to using JobsTrackr to find eligible government jobs and track your exams.',
  },
  '/tracker': {
    title: 'My Exam Tracker | JobsTrackr',
    description:
      'Track the government exams you are preparing for, with live status updates, dates, and deadlines on JobsTrackr.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | JobsTrackr',
    description: 'Read how JobsTrackr collects, uses, and protects your personal data.',
  },
  '/refund-policy': {
    title: 'Refund Policy | JobsTrackr',
    description: 'Read the JobsTrackr refund policy.',
  },
  '/terms-of-service': {
    title: 'Terms of Service | JobsTrackr',
    description: 'Read the terms and conditions for using JobsTrackr.',
  },

  // ── Private / thin / auth-gated routes → noindex ──
  '/auth': { title: 'Sign In | JobsTrackr', robots: NOINDEX },
  '/reset-password': { title: 'Reset Password | JobsTrackr', robots: NOINDEX },
  '/profile': { title: 'My Profile | JobsTrackr', robots: NOINDEX },
  '/saved': { title: 'Saved Jobs | JobsTrackr', robots: NOINDEX },
  '/documents': { title: 'My Documents | JobsTrackr', robots: NOINDEX },
  '/edit-profile': { title: 'Edit Profile | JobsTrackr', robots: NOINDEX },
  '/edit-education': { title: 'Edit Education | JobsTrackr', robots: NOINDEX },
  '/edit-sector-preferences': { title: 'Edit Sector Preferences | JobsTrackr', robots: NOINDEX },
  '/admin': { title: 'Admin | JobsTrackr', robots: NOINDEX },
  '/more': { title: 'More | JobsTrackr', robots: NOINDEX },
  '/settings/notifications': { title: 'Notification Settings | JobsTrackr', robots: NOINDEX },
  '/syllabus/result': { title: 'Syllabus Result | JobsTrackr', robots: NOINDEX },
};

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
  // Legacy id-based / personalised routes → noindex.
  { prefix: '/job/', seo: { skipTitle: true, skipDescription: true, robots: NOINDEX } },
  { prefix: '/exam-update/', seo: { skipTitle: true, skipDescription: true, robots: NOINDEX } },
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
