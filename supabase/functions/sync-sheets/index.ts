import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NUMERIC_JOB_FIELDS = ["salary_min", "salary_max", "age_min", "age_max", "application_fee", "vacancies"];
const NULLABLE_JOB_TEXT = ["experience", "eligibility", "description", "apply_link", "official_website", "application_start_date"];
const UPDATE_JSON_FIELDS = [
  "important_dates", "overview", "vacancy_table", "fee_table", "eligibility_table",
  "cutoff_table", "download_links", "official_links", "related_links", "images",
  "sections", "related_articles",
];

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toJson(v: unknown, fallback: unknown): unknown {
  if (v === "" || v === null || v === undefined) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return fallback; }
}

function maxIso(rows: any[]): string | null {
  let max: string | null = null;
  for (const r of rows) {
    const s = String(r.scraped_at || "");
    if (s && (!max || s > max)) max = s;
  }
  return max;
}

function mapJobRow(r: any) {
  const rec: Record<string, unknown> = {
    title: r.title, department: r.department, location: r.location, qualification: r.qualification,
    vacancies_display: r.vacancies_display, last_date: r.last_date, last_date_display: r.last_date_display,
    is_featured: false, auto_discovered: true,
    job_metadata: toJson(r.job_metadata, null),
  };
  for (const f of NUMERIC_JOB_FIELDS) rec[f] = toNum(r[f]);
  for (const f of NULLABLE_JOB_TEXT) rec[f] = r[f] === "" || r[f] == null ? null : r[f];
  return rec;
}

function mapUpdateRow(r: any) {
  const rec: Record<string, unknown> = {
    url: r.url, title: r.title, category: r.category || "news",
    status: r.status || null, published_date: r.published_date || null,
    summary: r.summary || null, full_text: r.full_text || null,
    tags: toJson(r.tags, []),
    scraped_at: r.scraped_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  for (const f of UPDATE_JSON_FIELDS) rec[f] = toJson(r[f], []);
  return rec;
}

async function chunkedInsert(supabase: any, table: string, rows: any[], opts?: { onConflict?: string }) {
  const SIZE = 200;
  let written = 0;
  for (let i = 0; i < rows.length; i += SIZE) {
    const batch = rows.slice(i, i + SIZE);
    const q = opts?.onConflict
      ? supabase.from(table).upsert(batch, { onConflict: opts.onConflict })
      : supabase.from(table).insert(batch);
    const { error } = await q;
    if (error) {
      console.error(`[sync-sheets] ${table} write error:`, error.message);
    } else {
      written += batch.length;
    }
  }
  return written;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webAppUrl = Deno.env.get("APPS_SCRIPT_WEBAPP_URL");
  const syncSecret = Deno.env.get("SHEETS_SYNC_SECRET");

  // Auth: accept EITHER the shared secret (x-sync-secret header or ?secret= query)
  // OR the service-role key as a bearer token (used by the pg_cron job). Keeps the
  // endpoint private while staying easy to invoke manually for testing.
  const reqUrl = new URL(req.url);
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  const provided = (req.headers.get("x-sync-secret") || reqUrl.searchParams.get("secret") || "").trim();
  const authorized =
    (!!syncSecret && provided === syncSecret) ||
    (!!serviceKey && bearer === serviceKey);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!webAppUrl || !syncSecret) {
    return new Response(JSON.stringify({ error: "APPS_SCRIPT_WEBAPP_URL / SHEETS_SYNC_SECRET not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Read cursors.
    const { data: state } = await supabase.from("sheet_sync_state").select("feed,last_scraped_at");
    const cursor: Record<string, string> = {};
    (state || []).forEach((s: any) => { if (s.last_scraped_at) cursor[s.feed] = s.last_scraped_at; });
    const sinceCandidates = [cursor["jobs"], cursor["updates"]].filter(Boolean) as string[];
    const since = sinceCandidates.length ? sinceCandidates.sort()[0] : ""; // min cursor; upsert dedups overlap

    // 2. Pull from the Apps Script Web App.
    const url = `${webAppUrl}?secret=${encodeURIComponent(syncSecret)}&since=${encodeURIComponent(since)}`;
    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok) throw new Error(`Web App fetch failed: ${resp.status}`);
    const payload = await resp.json();
    if (!payload?.ok) throw new Error(`Web App error: ${payload?.error || "unknown"}`);

    const jobRows: any[] = payload.jobs || [];
    const updateRows: any[] = payload.updates || [];

    // 3a. Jobs — dedup by title (case-insensitive) against existing rows, then bulk insert new.
    let jobsInserted = 0;
    if (jobRows.length) {
      const titles = [...new Set(jobRows.map((r) => String(r.title || "")).filter(Boolean))];
      const existing = new Set<string>();
      for (let i = 0; i < titles.length; i += 200) {
        const { data } = await supabase.from("jobs").select("title").in("title", titles.slice(i, i + 200));
        (data || []).forEach((d: any) => existing.add(String(d.title || "").toLowerCase()));
      }
      const seenInBatch = new Set<string>();
      const fresh = jobRows.filter((r) => {
        const key = String(r.title || "").toLowerCase();
        if (!key || existing.has(key) || seenInBatch.has(key)) return false;
        seenInBatch.add(key);
        return true;
      }).map(mapJobRow);
      jobsInserted = await chunkedInsert(supabase, "jobs", fresh);
    }

    // 3b. Exam updates — upsert by url (unique).
    let updatesUpserted = 0;
    if (updateRows.length) {
      const mapped = updateRows.filter((r) => r.url).map(mapUpdateRow);
      updatesUpserted = await chunkedInsert(supabase, "exam_updates", mapped, { onConflict: "url" });
    }

    // 4. Advance cursors to the newest scraped_at we saw per feed.
    const jobsMax = maxIso(jobRows) || cursor["jobs"] || null;
    const updatesMax = maxIso(updateRows) || cursor["updates"] || null;
    const upserts = [];
    if (jobsMax) upserts.push({ feed: "jobs", last_scraped_at: jobsMax });
    if (updatesMax) upserts.push({ feed: "updates", last_scraped_at: updatesMax });
    if (upserts.length) await supabase.from("sheet_sync_state").upsert(upserts, { onConflict: "feed" });

    return new Response(JSON.stringify({
      success: true,
      since,
      jobs_received: jobRows.length, jobs_inserted: jobsInserted,
      updates_received: updateRows.length, updates_upserted: updatesUpserted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[sync-sheets] fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
