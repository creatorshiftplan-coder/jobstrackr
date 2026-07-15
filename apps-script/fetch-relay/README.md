# fetch-relay — bypass the Cloudflare IP block on the scraper

FreeJobAlert is behind Cloudflare, which blocks Google Apps Script's shared egress
IPs. When that happens the scraper's `fetchHtml` (`apps-script/Html.gs`) gets 403/503
and every `JobsQueue` row ends up **failed**. This relay runs on a *different* IP and
makes the freejobalert request for the scraper, returning the raw HTML.

`worker.js` is plain Web-platform code (`fetch` + `Response`), so the same file runs
on **Cloudflare Workers** or **Deno Deploy**. Pick whichever you prefer — if one
provider's IPs are also challenged by freejobalert's Cloudflare, try the other.

The relay only ever fetches `freejobalert.com` (SSRF allowlist) and, if you set a
`RELAY_TOKEN`, requires callers to pass a matching `?token=`.

---

## Option A — Cloudflare Workers (free tier is plenty)

1. Install the CLI and log in (one-time):
   ```bash
   npm i -g wrangler
   wrangler login
   ```
2. From this directory, deploy:
   ```bash
   cd apps-script/fetch-relay
   wrangler deploy
   ```
   Note the URL it prints, e.g. `https://fja-fetch-relay.<you>.workers.dev`.
3. (Recommended) Set a shared secret so it isn't publicly callable:
   ```bash
   wrangler secret put RELAY_TOKEN
   # paste a long random string when prompted
   ```

## Option B — Deno Deploy (free)

1. Push this repo to GitHub (already done) and create a project at
   <https://dash.deno.com> → **New Project** → link the repo.
2. Set the entry point to `apps-script/fetch-relay/worker.js`.
3. (Recommended) Add an environment variable `RELAY_TOKEN` = a long random string.
4. Deploy; note the URL, e.g. `https://fja-fetch-relay.deno.dev`.

---

## Wire it into the scraper

In the Apps Script project → **Project Settings → Script Properties**, add:

```
FETCH_PROXY_URL = https://<your-relay-url>/?token=<RELAY_TOKEN>&url={url}
```

- `{url}` is replaced by the scraper with the URL-encoded target page.
- Drop `token=<RELAY_TOKEN>&` if you did not set a token.

Then verify: in the Apps Script editor run **`processJobsQueue`** once and watch the
`JobsQueue` rows flip from `failed` to `done`. The hourly triggers and the Supabase
`sync-sheets` cron catch up on their own afterward (the cursor resumes; nothing is
skipped or double-imported).

### Quick manual check (optional)

```bash
curl "https://<your-relay-url>/?token=<RELAY_TOKEN>&url=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("https://www.freejobalert.com/new-updates/"))')" -I
```
A `200` means the relay's IP is getting through Cloudflare. A `403`/`503` means that
provider is also blocked — try the other option, or a paid scraping API
(`FETCH_PROXY_URL` accepts those too, e.g. ScraperAPI/ScrapingBee).
