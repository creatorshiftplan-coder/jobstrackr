/**
 * Google Indexing API client (Deno).
 * ─────────────────────────────────────
 * TypeScript counterpart of api/lib/google_indexing.py, for edge functions
 * that update /updates/:slug content (exams.ai_cached_response) rather than
 * jobs. Notifies Google when an Article/Event page is added or changed so it
 * gets crawled within minutes/hours instead of waiting for the sitemap.
 *
 * Auth: service-account JWT (OAuth2), signed with Web Crypto (RS256). The
 * FULL service-account JSON key must be stored in the GOOGLE_INDEXING_SA_KEY
 * secret — either as raw JSON or base64-encoded JSON. The service account's
 * client_email must also be added as an Owner of the property in Google
 * Search Console (same credential as the Python client can be reused).
 *
 * Every public call no-ops safely (never throws) so a misconfigured or
 * missing credential can never block an AI-status-cache write.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PUBLISH_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function loadServiceAccountKey(): ServiceAccountKey | null {
  const raw = Deno.env.get("GOOGLE_INDEXING_SA_KEY");
  if (!raw) return null;

  let jsonText = raw.trim();
  if (!jsonText.startsWith("{")) {
    try {
      jsonText = atob(jsonText);
    } catch {
      console.warn("[indexing] GOOGLE_INDEXING_SA_KEY is neither JSON nor base64-encoded JSON");
      return null;
    }
  }

  try {
    const info = JSON.parse(jsonText);
    if (!info?.client_email || !info?.private_key) {
      console.warn(
        "[indexing] GOOGLE_INDEXING_SA_KEY is missing client_email/private_key — it must contain the FULL service-account JSON"
      );
      return null;
    }
    return { client_email: info.client_email, private_key: info.private_key };
  } catch {
    console.warn("[indexing] GOOGLE_INDEXING_SA_KEY could not be parsed as JSON");
    return null;
  }
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const key = loadServiceAccountKey();
  if (!key) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    };

    const encoder = new TextEncoder();
    const unsigned =
      base64UrlEncode(encoder.encode(JSON.stringify(header))) +
      "." +
      base64UrlEncode(encoder.encode(JSON.stringify(claims)));

    const cryptoKey = await importPrivateKey(key.private_key);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      encoder.encode(unsigned)
    );
    const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!resp.ok) {
      console.warn(`[indexing] token request failed: HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      return null;
    }

    const body = await resp.json();
    cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return cachedToken.accessToken;
  } catch (e) {
    console.warn(`[indexing] failed to obtain access token: ${e}`);
    return null;
  }
}

/**
 * Notify Google's Indexing API about an updated/removed URL.
 * Never throws — callers should not let indexing failures affect their own result.
 */
export async function notifyGoogleIndexing(
  url: string,
  action: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<{ status: string; url?: string; action?: string; reason?: string; httpStatus?: number }> {
  if (!url) return { status: "skipped", reason: "no url" };

  const accessToken = await getAccessToken();
  if (!accessToken) return { status: "skipped", reason: "indexing credentials unavailable" };

  try {
    const resp = await fetch(PUBLISH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, type: action }),
    });

    if (resp.ok) return { status: "ok", url, action };

    const body = (await resp.text()).slice(0, 300);
    console.warn(`[indexing] ${action} ${url} -> HTTP ${resp.status}: ${body}`);
    return { status: "error", url, action, httpStatus: resp.status };
  } catch (e) {
    console.warn(`[indexing] request failed for ${url}: ${e}`);
    return { status: "error", url, action, reason: String(e) };
  }
}
