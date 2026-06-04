const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.warn('Upstash Redis credentials not configured');
}

// Helper to make Redis REST API calls
async function redisCommand(command: string, args: Record<string, any> = {}): Promise<any> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return null;
  }
  try {
    const response = await fetch(`${REDIS_URL}/${command}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      console.error(`Redis ${command} failed:`, response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error(`Redis ${command} error:`, error);
    return null;
  }
}

// Helper to generate cache key from request
function getCacheKey(request: Request): string {
  const url = new URL(request.url);
  // Use the path and query string after the /api/supabase/ prefix
  const path = url.pathname.replace(/^\/api\/supabase\//, '');
  const search = url.search;
  return `cache:${path}${search}`;
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Only cache GET requests
  if (request.method !== 'GET') {
    // Proxy directly to Supabase without caching
    return proxyToSupabase(request);
  }

  const cacheKey = getCacheKey(request);

  // Try to get from Redis cache
  const cached = await redisCommand('get', { key: cacheKey });
  if (cached !== null && cached !== '') {
    // cached is a stringified JSON object we stored: {body: string}
    try {
      const cachedData = JSON.parse(cached);
      return new Response(cachedData.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    } catch (e) {
      // If parsing fails, fallback to proxy
      console.error('Failed to parse cached value:', e);
    }
  }

  // Fetch from Supabase
  const response = await proxyToSupabase(request);

  // If successful, cache the response body
  if (response.ok) {
    const body = await response.text();
    try {
      await redisCommand('set', {
        key: cacheKey,
        value: JSON.stringify({ body }),
        ex: 300, // 5 minutes TTL
      });
    } catch (e) {
      console.error('Failed to cache response:', e);
    }

    // Return the response with a cache miss header
    return new Response(body, {
      status: response.status,
      headers: {
        ...response.headers,
        'X-Cache': 'MISS',
      },
    });
  }

  // For non-ok responses, return as-is (don't cache)
  return response;
}

// Proxy function to forward request to Supabase
async function proxyToSupabase(request: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Supabase configuration missing', { status: 500 });
  }

  // Build the target URL: replace /api/supabase/ with the Supabase REST URL
  const url = new URL(request.url);
  let path = url.pathname; // e.g., /api/supabase/rest/v1/jobs
  // Remove the /api/supabase prefix
  path = path.replace(/^\/api\/supabase\//, '');
  const targetUrl = `${supabaseUrl}/rest/v1/${path}${url.search}`;

  // Copy headers from the original request, but replace host and possibly others
  const headers = new Headers(request.headers);
  headers.set('host', new URL(supabaseUrl).host);
  // Ensure apikey and authorization headers are present (they should be from the original request)
  // If not, we can add them from the anon key
  if (!headers.has('apikey')) {
    headers.set('apikey', supabaseKey);
  }
  if (!headers.has('authorization')) {
    headers.set('authorization', `Bearer ${supabaseKey}`);
  }

  // Note: The request might have a body (for POST, etc.)
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  return response;
}