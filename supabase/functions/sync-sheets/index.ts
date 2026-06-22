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

const DATE_SENTINELS = new Set(["tbd", "not available", "not applicable", "na", "n/a", "-", "–", "nil", ""]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Normalise a raw date value arriving from Google Sheets.
 *
 * GAS auto-coerces stored "YYYY-MM-DD" strings back to Date objects; calling
 * toISOString() on them produces full UTC timestamps ("…T00:00:00.000Z").
 * This function strips the time component and returns null for TBD sentinels.
 * Returns null if the value cannot be resolved to a YYYY-MM-DD date.
 */
function parseDateOnly(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (DATE_SENTINELS.has(s.toLowerCase())) return null;
  // Full ISO timestamp — take the date part only ("2026-03-15T00:00:00.000Z" → "2026-03-15")
  if (s.includes("T")) {
    const datePart = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** Format a YYYY-MM-DD string as "DD Mon YYYY" for last_date_display. */
function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Deterministic title → slug. Mirrors the `generate_job_slug` Postgres trigger
// (supabase/migrations/20260218_add_slug_column.sql) byte-for-byte so the sync can
// compute a job's slug — and therefore its deep-link — before inserting, and the
// stored slug matches the link. The collision counter (-1, -2…) is resolved by the
// caller against existing slugs; this returns only the base slug.
function jobSlug(title: string): string {
  let s = String(title || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > 80) {
    s = s.slice(0, 80);
    const lastHyphen = s.lastIndexOf("-");
    if (lastHyphen > 0) s = s.slice(0, lastHyphen); // don't cut mid-word
  }
  return s;
}

// Normalized duplicate key. MUST stay byte-for-byte in step with the `dedupe_key`
// generated column (supabase/migrations/20260620_jobs_dedupe_key.sql): lowercase,
// collapse every run of non-alphanumerics to a single space, trim, then join the
// title and department with "||". The DB's UNIQUE(dedupe_key) is the real backstop;
// computing the same key here lets us skip known dupes before they reach the insert.
function normPart(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function dedupeKey(r: any): string {
  return `${normPart(r.title)}||${normPart(r.department)}`;
}

function mapJobRow(r: any, slug: string) {
  const lastDate = parseDateOnly(r.last_date);
  // last_date_display: prefer the sheet's own display field if it contains a date,
  // else fall back to formatting the parsed last_date. Raw text sentinels become null.
  const displayIso = parseDateOnly(r.last_date_display) ?? lastDate;
  const lastDateDisplay = displayIso ? isoToDisplay(displayIso) : null;

  const rec: Record<string, unknown> = {
    title: r.title, department: r.department, location: r.location, qualification: r.qualification,
    vacancies_display: r.vacancies_display,
    last_date: lastDate,
    last_date_display: lastDateDisplay,
    is_featured: false, auto_discovered: true, slug,
    job_metadata: toJson(r.job_metadata, null),
  };
  for (const f of NUMERIC_JOB_FIELDS) rec[f] = toNum(r[f]);
  for (const f of NULLABLE_JOB_TEXT) rec[f] = r[f] === "" || r[f] == null ? null : r[f];
  return rec;
}

function mapUpdateRow(r: any) {
  const rec: Record<string, unknown> = {
    url: r.url, title: r.title, category: r.category || "news",
    slug: r.slug ? String(r.slug) : null, // sheet poster owns it; DB trigger fills if null
    status: r.status || null, published_date: r.published_date || null,
    summary: r.summary || null, full_text: r.full_text || null,
    tags: toJson(r.tags, []),
    scraped_at: r.scraped_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  for (const f of UPDATE_JSON_FIELDS) rec[f] = toJson(r[f], []);
  return rec;
}

async function chunkedInsert(
  supabase: any,
  table: string,
  rows: any[],
  opts?: { onConflict?: string; ignoreDuplicates?: boolean },
) {
  const SIZE = 200;
  const upsertOpts = opts?.onConflict
    ? { onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates ?? false }
    : null;
  let written = 0;
  for (let i = 0; i < rows.length; i += SIZE) {
    const batch = rows.slice(i, i + SIZE);
    const q = upsertOpts
      ? supabase.from(table).upsert(batch, upsertOpts)
      : supabase.from(table).insert(batch);
    const { error } = await q;
    if (!error) {
      written += batch.length;
      continue;
    }
    // A single bad row (e.g. a rare slug collision) would otherwise fail the whole
    // statement and let the cursor skip past every row in it. Isolate by retrying
    // row-by-row so the good rows still land.
    console.error(`[sync-sheets] ${table} batch write error (retrying per-row):`, error.message);
    for (const row of batch) {
      const rq = upsertOpts
        ? supabase.from(table).upsert(row, upsertOpts)
        : supabase.from(table).insert(row);
      const { error: rowErr } = await rq;
      if (rowErr) console.error(`[sync-sheets] ${table} row skipped:`, rowErr.message);
      else written++;
    }
  }
  return written;
}

// Broadcast one freshly-synced record to the matched public Telegram channels by
// reusing the existing `telegram-auto-post` function (same contract the Admin
// panel uses). It sector-matches channels and dedups via `telegram_sent_jobs`, so
// re-invoking for an already-posted row is a no-op.
async function postToChannels(fnBase: string, serviceKey: string, type: "job" | "exam_update", item: any): Promise<void> {
  const resp = await fetch(`${fnBase}/telegram-auto-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify(type === "job" ? { job: item } : { exam_update: item }),
  });
  if (!resp.ok) {
    console.error(`[sync-sheets] telegram-auto-post ${type} ${item?.id} failed:`, (await resp.text()).slice(0, 200));
  }
}

// Post a list of records sequentially with a small gap, so a sub-batch never
// fires a burst of channel posts at once. Failures are logged, never thrown — a
// Telegram hiccup must not break the sync or its cursor.
async function broadcast(fnBase: string, serviceKey: string, type: "job" | "exam_update", items: any[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    if (!items[i]?.id) continue;
    try { await postToChannels(fnBase, serviceKey, type, items[i]); }
    catch (e) { console.error("[sync-sheets] broadcast error:", (e as Error).message); }
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webAppUrl = Deno.env.get("APPS_SCRIPT_WEBAPP_URL");
  const syncSecret = Deno.env.get("SHEETS_SYNC_SECRET");
  // Channel broadcasting is opt-in: set SHEETS_SYNC_TELEGRAM="true" once the
  // historical backlog is drained, so the first sync can't blast every new row.
  const broadcastEnabled = Deno.env.get("SHEETS_SYNC_TELEGRAM") === "true";
  const fnBase = `${supabaseUrl}/functions/v1`;

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

  // Distinguish manual (admin panel) from cron runs for the health log. The
  // cron job posts an empty body; the admin proxy posts { trigger: "manual" }.
  let trigger = "cron";
  try {
    const body = await req.json();
    if (body && typeof body.trigger === "string") trigger = body.trigger;
  } catch { /* no/invalid body — treat as cron */ }

  const startedAt = Date.now();
  let sinceCursor = "";

  // Append a row to the run-history log (best-effort; never fails the sync).
  const logRun = async (fields: Record<string, unknown>) => {
    const { error } = await supabase.from("sheet_sync_runs").insert({
      trigger,
      since_cursor: sinceCursor || null,
      duration_ms: Date.now() - startedAt,
      ...fields,
    });
    if (error) console.error("[sync-sheets] run-log write error:", error.message);
  };

  // Per-run batch caps. Each loop iteration pulls at most this many *new* rows per
  // feed (the feed extends through timestamp ties, so a batch may run slightly
  // over). Jobs and updates page independently off their own cursors. We advance
  // each cursor after every sub-batch, so a mid-run timeout still makes forward
  // progress and never re-skips — the next run resumes exactly where we stopped.
  const JOBS_BATCH = 30;
  const UPDATES_BATCH = 10;
  const MAX_ITERATIONS = 100; // safety valve against the edge-function time budget

  try {
    // 1. Read per-feed cursors.
    const { data: state } = await supabase.from("sheet_sync_state").select("feed,last_scraped_at");
    const cursor: Record<string, string> = {};
    (state || []).forEach((s: any) => { if (s.last_scraped_at) cursor[s.feed] = s.last_scraped_at; });
    let jobsCursor = cursor["jobs"] || "";
    let updatesCursor = cursor["updates"] || "";
    sinceCursor = [jobsCursor, updatesCursor].filter(Boolean).sort()[0] || ""; // min, for the health log

    let jobsReceived = 0, jobsInserted = 0;
    let updatesReceived = 0, updatesUpserted = 0;

    // Advance one feed's cursor and persist it immediately (crash-safe progress).
    const advance = async (feed: "jobs" | "updates", to: string) => {
      if (!to) return;
      await supabase.from("sheet_sync_state").upsert([{ feed, last_scraped_at: to }], { onConflict: "feed" });
    };

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // 2. Pull the next sub-batch for each feed from its own cursor.
      const url = `${webAppUrl}?secret=${encodeURIComponent(syncSecret)}`
        + `&sinceJobs=${encodeURIComponent(jobsCursor)}&sinceUpdates=${encodeURIComponent(updatesCursor)}`
        + `&jobsLimit=${JOBS_BATCH}&updatesLimit=${UPDATES_BATCH}`;
      const resp = await fetch(url, { redirect: "follow" });
      if (!resp.ok) throw new Error(`Web App fetch failed: ${resp.status}`);
      const payload = await resp.json();
      if (!payload?.ok) throw new Error(`Web App error: ${payload?.error || "unknown"}`);

      const jobRows: any[] = payload.jobs || [];
      const updateRows: any[] = payload.updates || [];
      if (jobRows.length === 0 && updateRows.length === 0) break;

      // 3a. Jobs — dedup by normalized title+department (the same `dedupe_key` the
      //     DB enforces) against existing rows, assign a collision-free slug, then
      //     bulk insert the new ones with ON CONFLICT DO NOTHING as the backstop.
      if (jobRows.length) {
        jobsReceived += jobRows.length;
        const keys = [...new Set(jobRows.map(dedupeKey).filter((k) => k !== "||"))];
        const existing = new Set<string>();
        for (let i = 0; i < keys.length; i += 200) {
          const { data } = await supabase.from("jobs").select("dedupe_key").in("dedupe_key", keys.slice(i, i + 200));
          (data || []).forEach((d: any) => { if (d.dedupe_key) existing.add(String(d.dedupe_key)); });
        }
        const seenInBatch = new Set<string>();
        const candidates = jobRows.filter((r) => {
          const key = dedupeKey(r);
          if (key === "||" || existing.has(key) || seenInBatch.has(key)) return false;
          seenInBatch.add(key);
          return true;
        });

        if (candidates.length) {
          // Reserve a unique slug per row. Prefer a slug the sheet already carries
          // (the Telegram poster owns it so its link matches), else derive from the
          // title. Probe existing slugs and append -1, -2… for any collision.
          const bases = candidates.map((r) =>
            String(r.slug || "").trim() || jobSlug(String(r.title || "")) || String(r.id || "job"));
          const taken = new Set<string>();
          const uniqBases = [...new Set(bases)];
          for (let i = 0; i < uniqBases.length; i += 200) {
            const { data } = await supabase.from("jobs").select("slug").in("slug", uniqBases.slice(i, i + 200));
            (data || []).forEach((d: any) => { if (d.slug) taken.add(String(d.slug)); });
          }
          const assignedSlugs: string[] = [];
          const fresh = candidates.map((r, i) => {
            let slug = bases[i];
            for (let n = 1; taken.has(slug); n++) slug = `${bases[i]}-${n}`;
            taken.add(slug);
            assignedSlugs.push(slug);
            return mapJobRow(r, slug);
          });
          // ON CONFLICT (dedupe_key) DO NOTHING: the in-code filter above catches
          // dupes against rows we could see, this catches the rest — a concurrent
          // run inserting the same row, or a normalization edge we missed.
          jobsInserted += await chunkedInsert(supabase, "jobs", fresh, {
            onConflict: "dedupe_key", ignoreDuplicates: true,
          });

          // Broadcast the just-inserted jobs to the matched public channels. We
          // re-fetch by the unique slugs we assigned to get the DB-generated id +
          // canonical fields telegram-auto-post needs (it builds the deep-link
          // jobstrackr.in/jobs/${slug}). Cursor is advanced below regardless, so a
          // slow/failed broadcast never blocks sync progress.
          if (broadcastEnabled && assignedSlugs.length) {
            const { data: insertedJobs } = await supabase
              .from("jobs")
              .select("id, slug, title, department, qualification, description, vacancies_display, vacancies, last_date_display, last_date")
              .in("slug", assignedSlugs);
            await broadcast(fnBase, serviceKey, "job", insertedJobs || []);
          }
        }

        // Advance to the last (newest) row in the batch — feed is oldest-first.
        jobsCursor = jobRows[jobRows.length - 1].scraped_at || jobsCursor;
        await advance("jobs", jobsCursor);
      }

      // 3b. Exam updates — upsert by url (unique).
      if (updateRows.length) {
        updatesReceived += updateRows.length;
        const mapped = updateRows.filter((r) => r.url).map(mapUpdateRow);
        updatesUpserted += await chunkedInsert(supabase, "exam_updates", mapped, { onConflict: "url" });
        updatesCursor = updateRows[updateRows.length - 1].scraped_at || updatesCursor;
        await advance("updates", updatesCursor);

        // Broadcast to channels. telegram-auto-post links to /exam-update/{id} and
        // dedups by update_id, so re-posting an already-sent update is a no-op.
        if (broadcastEnabled && mapped.length) {
          const { data: insertedUpdates } = await supabase
            .from("exam_updates")
            .select("id, title, category, status, summary, important_dates")
            .in("url", mapped.map((m: any) => m.url));
          await broadcast(fnBase, serviceKey, "exam_update", insertedUpdates || []);
        }
      }

      // Both feeds came back short → backlog drained, stop. (A feed that returns a
      // full batch may have more, so keep looping until both are under their cap.)
      if (jobRows.length < JOBS_BATCH && updateRows.length < UPDATES_BATCH) break;
    }

    await logRun({
      success: true,
      jobs_received: jobsReceived, jobs_inserted: jobsInserted,
      updates_received: updatesReceived, updates_upserted: updatesUpserted,
    });

    return new Response(JSON.stringify({
      success: true,
      jobs_received: jobsReceived, jobs_inserted: jobsInserted,
      updates_received: updatesReceived, updates_upserted: updatesUpserted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[sync-sheets] fatal:", err);
    await logRun({ success: false, error: (err as Error).message });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
