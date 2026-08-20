import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distIndexHtmlPath = path.resolve(__dirname, '../dist/index.html');
if (!fs.existsSync(distIndexHtmlPath)) {
  console.error('Error: dist/index.html not found! Run npm run build first.');
  process.exit(1);
}

const html = fs.readFileSync(distIndexHtmlPath, 'utf8');

// Find all script tags pointing to assets
const scripts = html.match(/<script\b[^>]*src=["']\/assets\/[^"']+["'][^>]*><\/script>/gi) || [];

// Find all link tags pointing to assets (like stylesheets and modulepreloads)
const links = html.match(/<link\b[^>]*href=["']\/assets\/[^"']+["'][^>]*>/gi) || [];

// Join them cleanly
const headTags = links.join('\n  ');
const bodyTags = scripts.join('\n  ');

console.log('--- Extracted Head Tags ---');
console.log(headTags);
console.log('--- Extracted Body Tags ---');
console.log(bodyTags);

const filesToUpdate = [
  path.resolve(__dirname, '../api/jobs/[slug].ts'),
  path.resolve(__dirname, '../api/updates/[slug].ts'),
  path.resolve(__dirname, '../api/exam-updates/[slug].ts')
];

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found at ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace HEAD assets
  const headStart = '<!-- PROD_HEAD_ASSETS_START -->';
  const headEnd = '<!-- PROD_HEAD_ASSETS_END -->';
  const headRegex = new RegExp(`${headStart}[\\s\\S]*?${headEnd}`, 'g');
  if (content.includes(headStart) && content.includes(headEnd)) {
    content = content.replace(headRegex, `${headStart}\n  ${headTags}\n  ${headEnd}`);
  } else {
    console.warn(`Warning: Markers not found in ${filePath} for head assets.`);
  }

  // Replace BODY assets
  const bodyStart = '<!-- PROD_BODY_ASSETS_START -->';
  const bodyEnd = '<!-- PROD_BODY_ASSETS_END -->';
  const bodyRegex = new RegExp(`${bodyStart}[\\s\\S]*?${bodyEnd}`, 'g');
  if (content.includes(bodyStart) && content.includes(bodyEnd)) {
    content = content.replace(bodyRegex, `${bodyStart}\n  ${bodyTags}\n  ${bodyEnd}`);
  } else {
    console.warn(`Warning: Markers not found in ${filePath} for body assets.`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${path.basename(filePath)} successfully!`);
}

// ── Per-route static pre-render (SEO) ────────────────────────────────────────
//
// Every client-rendered route used to be served the SPA's index.html verbatim,
// so the first byte of HTML Google saw for /search, /trending, /faq … carried
// the HOMEPAGE canonical (`<link rel="canonical" href="https://jobstrackr.in">`)
// and an identical <title>. useRouteSeo fixes both after hydration, but Google
// makes its canonical decision from the served HTML — so all 14 static sitemap
// URLs looked like duplicates of `/`, which is exactly the "Duplicate, Google
// chose different canonical than user" report in Search Console (Aug 2026).
//
// Emitting one real HTML file per route fixes it at zero runtime cost: Vercel
// gives "precedence to the filesystem prior to rewrites being applied", so
// dist/search/index.html is served directly and the catch-all SPA rewrite in
// vercel.json never fires for these paths — no edge function, no invocation,
// which keeps this safe on the Vercel free tier.
//
// Route values come from src/lib/seoRoutes.json, the same file seoConfig.ts
// reads at runtime, so the pre-rendered HTML and the post-hydration values
// cannot disagree.

const seoRoutes = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/lib/seoRoutes.json'), 'utf8'),
);

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Replace a tag matched by `re` with `tag`, appending into <head> if absent. */
function upsertTag(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function renderRoute(baseHtml, routePath, seo) {
  const title = seo.title || seoRoutes.defaultTitle;
  const description = seo.description || seoRoutes.defaultDescription;
  const robots = seo.robots || 'index, follow';
  const canonicalPath = seo.canonicalPath || routePath;
  const canonical =
    canonicalPath === '/' ? seoRoutes.siteUrl : `${seoRoutes.siteUrl}${canonicalPath}`;

  let html = baseHtml;
  html = upsertTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  html = upsertTag(
    html,
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+name="robots"[^>]*>/i,
    `<meta name="robots" content="${escapeAttr(robots)}" />`,
  );
  html = upsertTag(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
  );
  html = upsertTag(
    html,
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  );
  return html;
}

const distDir = path.resolve(__dirname, '../dist');
let rendered = 0;

for (const [routePath, seo] of Object.entries(seoRoutes.routes)) {
  // `html` is the pristine dist/index.html read above — always render from it,
  // never from an already-rewritten page.
  const pageHtml = renderRoute(html, routePath, seo);

  if (routePath === '/') {
    // The SPA entry itself — correct its meta in place rather than nesting it.
    fs.writeFileSync(path.join(distDir, 'index.html'), pageHtml, 'utf8');
  } else {
    const outDir = path.join(distDir, routePath.replace(/^\//, ''));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), pageHtml, 'utf8');
  }
  rendered++;
}

console.log(`Pre-rendered ${rendered} static routes with per-route SEO meta.`);
