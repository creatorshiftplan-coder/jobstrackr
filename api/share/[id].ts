import type { VercelRequest, VercelResponse } from '@vercel/node';

// Bot user agents that need pre-rendered HTML with OG tags
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Googlebot',
  'bingbot',
  'Baiduspider',
  'DuckDuckBot',
  'Yahoo',
  'Yandex',
];

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  // Validate ID exists and is a string
  if (!id || typeof id !== 'string') {
    return res.redirect(302, '/');
  }

  // Validate UUID format to prevent injection attacks
  if (!isValidUUID(id)) {
    return res.redirect(302, '/');
  }

  const userAgent = req.headers['user-agent'] || '';

  // Check if this is a bot/crawler
  const isBot = BOT_USER_AGENTS.some(bot =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );

  // If not a bot, redirect to the SPA immediately
  if (!isBot) {
    return res.redirect(302, `/job/${id}`);
  }

  try {
    // Fetch job data from Supabase
    // Note: VITE_ prefixed env vars are for client-side only
    // For serverless functions, use SUPABASE_URL and SUPABASE_ANON_KEY, or fallback to public values
    const supabaseUrl = process.env.SUPABASE_URL || 'https://fdxksytpdfgmbkttipdf.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkeGtzeXRwZGZnbWJrdHRpcGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTM1MTYsImV4cCI6MjA4MDQyOTUxNn0.NocVE7TCJIQgIhbHkxhHWraBRxyCkLIdgUQ3ERCHuKQ';

    const response = await fetch(
      `${supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(id)}&select=id,title,department,location,qualification,vacancies_display,last_date_display`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Supabase API error:', response.status, response.statusText);
      return res.redirect(302, `/job/${id}`);
    }

    const jobs = await response.json();
    const job = jobs[0];

    if (!job) {
      return res.redirect(302, `/job/${id}`);
    }

    // Generate HTML with proper OG tags for bots
    const siteUrl = 'https://jobstrackr.in';
    const jobUrl = `${siteUrl}/job/${job.id}`;
    const title = `${job.title} | JobsTrackr`;

    // Build description parts safely
    const descParts: string[] = [];
    if (job.location) descParts.push(`📍 ${job.location}`);
    if (job.department) descParts.push(`🏛️ ${job.department}`);
    if (job.qualification) descParts.push(`🎓 ${job.qualification}`);
    if (job.vacancies_display) descParts.push(`👥 ${job.vacancies_display}`);
    if (job.last_date_display) descParts.push(`📅 Last Date: ${job.last_date_display}`);

    const description = descParts.join(' | ') || 'View job details on JobsTrackr';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(jobUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${siteUrl}/og-image.png">
  <meta property="og:image:secure_url" content="${siteUrl}/og-image.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(job.title)} - Government Job">
  <meta property="og:site_name" content="JobsTrackr">
  <meta property="og:locale" content="en_IN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(jobUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${siteUrl}/og-image.png">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(jobUrl)}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #0A4174 0%, #1E88E5 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }
    p {
      margin: 0.5rem 0;
      opacity: 0.9;
    }
    a {
      color: #ffffff;
      text-decoration: underline;
    }
    .loader {
      border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 1rem auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(job.title)}</h1>
    <p>${escapeHtml(job.department || '')}</p>
    <div class="loader"></div>
    <p>Opening job details...</p>
    <p><a href="${escapeHtml(jobUrl)}">Click here if not redirected</a></p>
  </div>
  <script>
    // Delay redirect slightly to ensure bots can read meta tags
    // Regular users get 302 redirect before this, so this is mainly for edge cases
    setTimeout(function() {
      window.location.replace("${escapeHtml(jobUrl)}");
    }, 100);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('OG handler error:', error);
    return res.redirect(302, `/job/${id}`);
  }
}
