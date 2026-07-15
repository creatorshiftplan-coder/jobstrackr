/**
 * fetch-relay — a tiny HTML fetch relay for the FreeJobAlert scraper.
 *
 * Why: FreeJobAlert is behind Cloudflare, which blocks/challenges Google Apps
 * Script's shared egress IPs — so the scraper's UrlFetchApp calls get 403/503 and
 * every JobsQueue row ends up "failed". This relay runs on a *different* IP
 * (Cloudflare Workers / Deno Deploy / any host) and does the freejobalert request
 * on the scraper's behalf, returning the raw HTML. Apps Script's fetchHtml
 * (apps-script/Html.gs → fetchViaProxy_) calls it when a direct fetch is blocked.
 *
 * It is deliberately NOT an open proxy:
 *   • it only ever fetches freejobalert.com (SSRF allowlist), and
 *   • if RELAY_TOKEN is set, callers must pass a matching ?token=.
 *
 * Point the scraper at it via the Apps Script Script Property:
 *   FETCH_PROXY_URL = https://<your-worker>.workers.dev/?token=<RELAY_TOKEN>&url={url}
 * ({url} is replaced with the URL-encoded target; token is optional.)
 *
 * Standard Web platform code (fetch + Response), so the same file runs on
 * Cloudflare Workers and Deno Deploy — see README.md.
 */

const ALLOWED_HOST = "freejobalert.com";

// Mirror the browser fingerprint the scraper uses (apps-script/Html.gs
// browserHeaders_) so the upstream request looks like a real navigation.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Chromium";v="123", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

function isAllowedTarget(rawUrl) {
  let host;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === ALLOWED_HOST || host.endsWith("." + ALLOWED_HOST);
}

/** Core handler, shared by the Cloudflare and Deno entry points. `token` is the
 *  configured shared secret (or undefined to disable the gate). */
async function handle(request, token) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (token && searchParams.get("token") !== token) {
    return new Response("forbidden", { status: 403 });
  }
  if (!target || !isAllowedTarget(target)) {
    return new Response("bad or disallowed url", { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    const body = await upstream.text();
    // Pass the upstream status straight through so the scraper's own retry /
    // block detection still works if the relay IP is *also* challenged.
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response("relay fetch error: " + e, { status: 502 });
  }
}

// ── Cloudflare Workers entry point ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    return handle(request, env && env.RELAY_TOKEN);
  },
};

// ── Deno Deploy entry point ─────────────────────────────────────────────────
// `Deno` only exists on Deno Deploy; guarded so this file still loads under
// Cloudflare/Node. Set the token with a RELAY_TOKEN environment variable.
if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve((request) => handle(request, Deno.env.get("RELAY_TOKEN")));
}
