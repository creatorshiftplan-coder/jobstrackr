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
