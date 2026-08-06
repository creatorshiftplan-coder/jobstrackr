/**
 * AiEnrichment.gs — eligibility summary, required-skills extraction and vector
 * embeddings computed IN THE SHEET, before the row is ever synced to Supabase.
 *
 * Why here: previously a job landed in `jobs` raw, and enrichment happened
 * afterwards from the app — `eligibility_summary` / `required_skills` only when
 * an admin pressed "Summarise" in the Admin panel (src/pages/Admin.tsx), and
 * `embedding` on the `process-embeddings` cron. So a freshly-synced job was
 * un-summarised and unsearchable-by-vector until those ran. Computing all three
 * at scrape time means `sync-sheets` imports a row that is already complete.
 *
 * The Supabase functions are NOT retired — they still serve jobs created outside
 * the sheet (Admin-authored rows) and act as a backstop for anything this pass
 * could not fill. Same "kept as fallback" posture as the Telegram poster.
 *
 * ── One-time setup ──────────────────────────────────────────────────────────
 * Project Settings → Script Properties, add your Groq keys as either
 *   GROQ_API_KEY_1 … GROQ_API_KEY_9      (preferred — 9 keys)
 * or the .env-style naming this repo already uses:
 *   GROQ_API_KEY, GROQ_API_KEY_2 … GROQ_API_KEY_9
 * Both spellings are accepted and merged, so paste whichever you have. Then run
 * `setup()` once (adds the new columns to an existing Jobs tab and installs the
 * enrichment trigger) and `testGroqKeys()` to verify every key answers.
 *
 * ── Rotation ────────────────────────────────────────────────────────────────
 * Mirrors supabase/functions/_shared/apiKeyRotation.ts: try keys in order and on
 *   429 / 402  → key is rate-limited or out of credit, rotate (cooldown for the run)
 *   401 / 403  → key is invalid or blocked, retire it for the run
 *   5xx / timeout → transient, rotate
 * The starting offset rotates between runs (persisted in Script Properties) so
 * key 1 doesn't absorb every first request and hit its daily cap first.
 */

// ── key loading ─────────────────────────────────────────────────────────────

const GROQ_KEY_CURSOR_ = 'GROQ_KEY_CURSOR'; // Script Property: round-robin start offset
const AI_CURSOR_KEY_ = 'AI_ENRICH_CURSOR';  // Script Property: wrapping scan cursor (sheet row)

/**
 * All configured Groq keys, in a stable order, de-duplicated.
 * Accepts GROQ_API_KEY_1..9 and the GROQ_API_KEY / GROQ_API_KEY_2..9 spelling.
 */
function groqKeys_() {
  const props = PropertiesService.getScriptProperties();
  const names = ['GROQ_API_KEY'];
  for (let i = 1; i <= AI.MAX_KEYS; i++) names.push('GROQ_API_KEY_' + i);

  const seen = {}, keys = [];
  names.forEach(function (n) {
    const v = String(props.getProperty(n) || '').trim();
    if (!v || seen[v]) return;
    seen[v] = true;
    keys.push({ name: n, key: v });
  });
  return keys;
}

/**
 * Keys ordered so each run starts at a different key (round-robin), spreading
 * load across all 9 instead of always burning key 1 first.
 */
function rotatedGroqKeys_() {
  const keys = groqKeys_();
  if (keys.length < 2) return keys;
  const props = PropertiesService.getScriptProperties();
  const start = (parseInt(props.getProperty(GROQ_KEY_CURSOR_) || '0', 10) || 0) % keys.length;
  props.setProperty(GROQ_KEY_CURSOR_, String((start + 1) % keys.length));
  return keys.slice(start).concat(keys.slice(0, start));
}

// ── the rotating HTTP call ──────────────────────────────────────────────────

/**
 * POST a JSON body to a Groq endpoint, rotating through the keys until one
 * succeeds. `dead` is a run-scoped map of key names to skip (populated on
 * 401/403/429 so later calls in the same run don't retry a known-bad key).
 * Returns the parsed response, or throws with the last error seen.
 */
function groqPost_(path, body, dead) {
  const keys = rotatedGroqKeys_();
  if (!keys.length) {
    throw new Error('No Groq keys in Script Properties — add GROQ_API_KEY_1..9');
  }
  dead = dead || {};
  let lastError = 'all Groq keys failed';

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (dead[k.name]) continue;

    let resp;
    try {
      resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1' + path, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + k.key },
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
      });
    } catch (err) {
      lastError = 'network error on ' + k.name + ': ' + err;
      continue; // transient — try the next key
    }

    const code = resp.getResponseCode();
    if (code === 200) {
      try {
        return JSON.parse(resp.getContentText());
      } catch (err) {
        lastError = 'unparseable JSON from ' + k.name;
        continue;
      }
    }

    const text = String(resp.getContentText() || '').slice(0, 200);
    if (code === 429 || code === 402) {
      dead[k.name] = true;             // exhausted for this run
      lastError = k.name + ' rate-limited/exhausted (' + code + ')';
    } else if (code === 401 || code === 403) {
      dead[k.name] = true;             // invalid or blocked — never retry
      lastError = k.name + ' invalid or blocked (' + code + ')';
      log_('AiEnrichment: ' + k.name + ' rejected (' + code + ') — check the key');
    } else if (code >= 500) {
      lastError = k.name + ' server error (' + code + ')';
    } else {
      lastError = k.name + ' error ' + code + ': ' + text;
    }
  }
  throw new Error(lastError);
}

// ── eligibility summary + required skills ───────────────────────────────────

// Ported verbatim from supabase/functions/groq-summarize/index.ts so a row
// enriched here is indistinguishable from one enriched by the edge function.
const AI_SYSTEM_PROMPT_ =
  'You are an expert at parsing and summarising Indian government job eligibility criteria.\n' +
  'You MUST respond with a JSON object containing two fields:\n' +
  '1. "summary": A dense 100-120 word text containing ONLY:\n' +
  '   - Age range with category relaxations (OBC, SC/ST, PH, ExSM)\n' +
  '   - Education: level + stream + specialisation if specified\n' +
  '   - Extra skills required: typing speed and language, stenography speed, computer certificate level, ITI trade, driving license type, law degree, NCC certificate, experience years and domain\n' +
  '   - Physical standards if mentioned\n' +
  '   - Domicile / state restriction if any\n' +
  '   Use plain dense language. No sentences. No intro. No explanation. No markdown.\n' +
  '   Format EXACTLY like: "Age 18-27 years. OBC+3, SC/ST+5. Graduate any stream. Typing 35 WPM English. CCC computer certificate. ITI Electrician or Fitter."\n' +
  '\n' +
  '2. "required_skills": An array of skill objects matching this schema:\n' +
  '   Each object in the array MUST have a "type" (string) and "required" (boolean) field.\n' +
  '   Allowed types and additional fields:\n' +
  '   - typing: { type: "typing", language: "English" | "Hindi" | string, min_wpm: number | null, required: boolean }\n' +
  '   - stenography: { type: "stenography", language: "English" | "Hindi" | string, min_wpm: number | null, required: boolean }\n' +
  '   - computer: { type: "computer", min_level: number | null, accepted: string[], required: boolean }\n' +
  '   - iti: { type: "iti", trades: string[], any_trade: boolean, required: boolean }\n' +
  '   - driving: { type: "driving", license_types: string[], required: boolean }\n' +
  '   - law: { type: "law", accepted: string[], required: boolean }\n' +
  '   - ncc: { type: "ncc", min_certificate: "A" | "B" | "C", required: boolean }\n' +
  '   - experience: { type: "experience", domain: string, min_years: number, required: boolean }\n' +
  '   - physical: { type: "physical", height_cm: { male: number, female: number } | null, required: boolean }\n' +
  '   - custom: { type: "custom", label: string, required: boolean }\n' +
  '\n' +
  'Return ONLY the JSON object. Do not include markdown wraps or backticks outside the JSON itself.';

/**
 * Reject a summary that is empty, truncated, chatty ("Here is…"), or that lost
 * every two-digit number the source had (a sign the model paraphrased away the
 * ages/speeds that are the whole point). Ported from groq-summarize.
 */
function validSummary_(summary, rawText) {
  if (!summary) return false;
  const words = String(summary).trim().split(/\s+/).filter(Boolean);
  if (words.length < 5 || words.length > 250) return false;
  if (/\b\d{2}\b/.test(rawText) && !/\b\d{2}\b/.test(summary)) return false;
  const first = words[0].toLowerCase().replace(/[^a-z]/g, '');
  return first !== 'i' && first !== 'here' && first !== 'this';
}

/** Parse the model's reply, tolerating ```json fences some models add anyway. */
function parseAiJson_(content) {
  const s = String(content || '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (e) {
    const fenced = s.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (!fenced) return null;
    try { return JSON.parse(fenced[1]); } catch (e2) { return null; }
  }
}

/**
 * Summarise one eligibility blob → { summary, required_skills }.
 * Walks the same model fallback chain as the edge function, with one retry at a
 * higher temperature before dropping to the smaller model.
 */
function summariseEligibility_(rawText, dead) {
  const text = String(rawText || '').trim();
  if (!text) return { summary: '', required_skills: [] };

  for (let m = 0; m < AI.MODELS.length; m++) {
    for (let retry = 0; retry < 2; retry++) {
      let data;
      try {
        data = groqPost_('/chat/completions', {
          model: AI.MODELS[m],
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT_ },
            { role: 'user', content: 'Summarise this eligibility section:\n' + text },
          ],
          temperature: retry === 0 ? 0.1 : 0.3,
          max_tokens: 1024,
        }, dead);
      } catch (err) {
        // Every key failed for this model — no point retrying it, fall back.
        break;
      }
      const parsed = parseAiJson_(
        data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content : '');
      if (!parsed) continue;
      const summary = String(parsed.summary || '');
      if (validSummary_(summary, text)) {
        return {
          summary: summary,
          required_skills: Array.isArray(parsed.required_skills) ? parsed.required_skills : [],
        };
      }
    }
  }
  return { summary: '', required_skills: [] };
}

// ── embeddings ──────────────────────────────────────────────────────────────

/**
 * Text fed to the embedding model. MUST mirror buildJobEmbeddingText in
 * supabase/functions/process-embeddings/index.ts — a job embedded here and one
 * embedded there have to land in the same vector space, or similarity search
 * silently degrades for whichever half was built differently.
 */
function buildJobEmbeddingText_(row) {
  let tags = [];
  try {
    const md = row.job_metadata ? JSON.parse(row.job_metadata) : null;
    if (md && Array.isArray(md.tags)) tags = md.tags;
  } catch (e) { /* metadata is optional */ }

  return [
    row.title,
    row.department,
    tags.join(' '),
    row.qualification,
    row.eligibility,
    String(row.description || '').slice(0, 1000),
  ].filter(function (p) { return p && String(p).trim(); }).join(' ');
}

/** L2-normalize to unit length (mirrors normalizeVector in process-embeddings). */
function normalizeVector_(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (!norm) return v;
  return v.map(function (x) { return x / norm; });
}

/**
 * Embed one text → a 384-dim unit vector, or null.
 * Matryoshka-sliced from the model's 768 dims then re-normalized, exactly as
 * process-embeddings does, because `jobs.embedding` is a vector(384) column.
 */
function embedText_(text, dead) {
  const s = String(text || '').trim();
  if (!s) return null;
  // Let a total key exhaustion propagate — enrichPendingJobs stops the run on it
  // rather than burning the remaining budget failing every subsequent row.
  const data = groqPost_('/embeddings', { model: AI.EMBED_MODEL, input: s }, dead);
  const raw = data && data.data && data.data[0] ? data.data[0].embedding : null;
  if (!raw || !raw.length) return null;
  // Round to 6dp: full float64 text would be ~7.7KB per cell, this is ~3.5KB
  // and is far below the precision that matters after normalization.
  return normalizeVector_(raw.slice(0, AI.EMBED_DIMS)).map(function (x) {
    return Math.round(x * 1e6) / 1e6;
  });
}

// ── active-vs-expired ───────────────────────────────────────────────────────

/**
 * Has this job's application window already closed?
 *
 * Only a CONFIDENTLY past deadline counts as expired. Blank, "TBD", "tentative"
 * and anything unparseable all return false — an unknown deadline is treated as
 * still open, because wrongly skipping a live job costs a user the summary on a
 * page they can still apply from, while wrongly enriching a dead one costs a few
 * seconds of quota. The asymmetry is deliberate.
 *
 * `last_date` reaches here as "yyyy-MM-dd" (Sheets.serializeCell_ formats real
 * Date cells that way) or as free text; parseDate from Html.gs normalises the
 * text forms the scraper writes.
 */
function jobIsExpired_(row) {
  const raw = String(row.last_date == null ? '' : row.last_date).trim();
  if (!raw || raw === CONFIG.NA_DATE) return false;      // unknown → treat as open

  let iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseDate(raw);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;  // unparseable → open

  const due = new Date(String(iso) + 'T23:59:59');       // deadline day counts as open
  if (isNaN(due.getTime())) return false;
  const cutoff = Date.now() - (AI.EXPIRY_GRACE_DAYS || 0) * 864e5;
  return due.getTime() < cutoff;
}

// ── the enrichment pass ─────────────────────────────────────────────────────

/**
 * Fill `eligibility_summary`, `required_skills` and `embedding` for Jobs rows
 * that don't have them yet, then bump `scraped_at` so the hourly `sync-sheets`
 * re-feeds the row and the new values reach Supabase.
 *
 * Runs as its own trigger rather than inline in processJobsQueue: the scrape
 * loop already budgets ~4 of Apps Script's 6 minutes for fetching, and three
 * Groq round-trips per job on top of that would push it into a hard kill.
 *
 * Self-terminating (unlike backfillDeficientJobs, which needs a cursor): a row
 * is only "pending" while its summary/embedding cells are blank, so a filled row
 * drops out of the set permanently. Rows the model genuinely can't summarise
 * would otherwise be retried forever, so `ai_attempts` counts tries and retires
 * a row after AI.MAX_ATTEMPTS.
 */
function enrichPendingJobs() {
  ensureSheets();
  const keys = groqKeys_();
  if (!keys.length) {
    log_('enrichPendingJobs: no Groq keys in Script Properties — skipping');
    return;
  }

  // AI.MAX_RUNTIME_MS, deliberately NOT the scrapers' CONFIG.MAX_RUNTIME_MS —
  // see the budget note in Config.gs. This pass blocks on a network call per row,
  // so giving it the scrapers' 4 minutes exhausts the project's daily quota and
  // silences every other trigger.
  const deadline = Date.now() + AI.MAX_RUNTIME_MS;
  const props = PropertiesService.getScriptProperties();
  // Windowed scan with a WRAPPING cursor. Bounds how much the run reads (a full
  // tab read would move ~3.5KB of embedding JSON per row), and wrapping means
  // newly-appended rows are always reached and filled rows are re-checked cheaply
  // — unlike the backfill's forward-only cursor, a row here stops being pending
  // once it's enriched, so re-visiting costs a comparison and nothing more.
  // Cursor is a distance back from the newest row, not an absolute row index, so
  // it keeps pointing at the freshest slice as the tab grows.
  const offset = parseInt(props.getProperty(AI_CURSOR_KEY_) || '0', 10) || 0;
  const win = readRecentWindow_(CONFIG.TAB_JOBS, JOB_COLUMNS, offset, AI.SCAN_WINDOW);
  const rows = win.rows;
  const dead = {}; // keys that 401/403/429'd this run — skipped by later calls
  let summarised = 0, embedded = 0, examined = 0, retired = 0, expired = 0;
  let stoppedIdx = -1; // index we bailed on, so the cursor resumes just before it

  for (let i = 0; i < rows.length; i++) {
    if (Date.now() >= deadline) { stoppedIdx = i; break; }
    const r = rows[i];

    // Skip closed vacancies: with only a few minutes of Apps Script quota a day,
    // every second spent summarising a job nobody can apply to is a second not
    // spent on one they can.
    if (AI.SKIP_EXPIRED && jobIsExpired_(r)) { expired++; continue; }

    const attempts = Number(r.ai_attempts) || 0;
    const needsSummary = !String(r.eligibility_summary || '').trim();
    // Only chase an embedding when a provider can actually produce one — with
    // EMBED_ENABLED false this stays false, so rows aren't re-examined forever
    // for a column that can never be filled here.
    const needsEmbedding = AI.EMBED_ENABLED && !String(r.embedding || '').trim();
    if (!needsSummary && !needsEmbedding) continue;
    if (attempts >= AI.MAX_ATTEMPTS) continue; // permanently unsummarisable — leave it

    examined++;
    let changed = false;

    try {
      if (needsSummary) {
        // The edge function summarises the raw eligibility text; fall back to
        // qualification when `eligibility` is blank, so a row that only carries a
        // qualification line still gets something useful instead of nothing.
        const raw = String(r.eligibility || '').trim() || String(r.qualification || '').trim();
        if (raw && raw !== CONFIG.NA_TEXT) {
          const res = summariseEligibility_(raw, dead);
          if (res.summary) {
            setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'eligibility_summary', res.summary);
            setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'required_skills',
              JSON.stringify(res.required_skills || []));
            summarised++;
            changed = true;
          }
        }
      }

      if (needsEmbedding) {
        const vec = embedText_(buildJobEmbeddingText_(r), dead);
        if (vec) {
          setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'embedding', JSON.stringify(vec));
          embedded++;
          changed = true;
        }
      }
    } catch (err) {
      log_('enrichPendingJobs error row ' + r._row + ': ' + err);
      // All keys exhausted mid-pass — stop cleanly rather than burning the
      // remaining runtime failing every row. Next trigger picks up where we left.
      if (String(err).indexOf('rate-limited') !== -1 || String(err).indexOf('all Groq keys') !== -1) {
        setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'ai_attempts', attempts + 1);
        log_('enrichPendingJobs: all keys exhausted — stopping this run');
        stoppedIdx = i + 1; // resume just past this row next time
        break;
      }
    }

    setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'ai_attempts', attempts + 1);
    if (attempts + 1 >= AI.MAX_ATTEMPTS && !changed) retired++;

    if (changed) {
      // Bump scraped_at so the row re-feeds and sync-sheets' repair path patches
      // the new columns into an already-imported job.
      setCell_(CONFIG.TAB_JOBS, JOB_COLUMNS, r._row, 'scraped_at', new Date().toISOString());
    }
    Utilities.sleep(AI.CALL_DELAY_MS);
  }

  // Persist where to resume, as a distance back from the NEWEST row. If we ran
  // out of time mid-window, resume at the row we stopped on; otherwise continue
  // past it (readRecentWindow_ wraps nextOffset to 0 at the end of the tab).
  const nextOffset = stoppedIdx >= 0 ? offset + stoppedIdx : win.nextOffset;
  props.setProperty(AI_CURSOR_KEY_, String(nextOffset));

  log_('enrichPendingJobs: rows ' + win.startRow + '–' + win.endRow +
    ' of ' + win.total + ' (offset ' + offset + ', newest-first), examined ' + examined +
    ', summarised ' + summarised + ', embedded ' + embedded +
    ', skipped expired ' + expired + ', retired ' + retired +
    ', keys dead this run ' + Object.keys(dead).length +
    ', next offset ' + nextOffset);
}

// ── manual helpers ──────────────────────────────────────────────────────────

/** Verify every configured key answers Groq. Run from the editor after setup. */
function testGroqKeys() {
  const keys = groqKeys_();
  if (!keys.length) {
    log_('testGroqKeys: no keys found — add GROQ_API_KEY_1..9 to Script Properties');
    return;
  }
  let ok = 0;
  keys.forEach(function (k) {
    try {
      const resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + k.key },
        payload: JSON.stringify({
          model: AI.MODELS[AI.MODELS.length - 1], // cheapest model for a ping
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode();
      if (code === 200) { ok++; log_('testGroqKeys: ' + k.name + ' OK'); }
      else log_('testGroqKeys: ' + k.name + ' FAILED (' + code + ') ' +
        String(resp.getContentText() || '').slice(0, 120));
    } catch (err) {
      log_('testGroqKeys: ' + k.name + ' error ' + err);
    }
  });
  log_('testGroqKeys: ' + ok + '/' + keys.length + ' keys healthy');
}

/**
 * Re-enrich everything from scratch: clears the three AI columns and the attempt
 * counter on every Jobs row, so the next enrichPendingJobs() passes rebuild them.
 * Use after changing the prompt or the embedding model.
 */
function resetAiEnrichment() {
  ensureSheets();
  const sh = getTab_(CONFIG.TAB_JOBS, JOB_COLUMNS);
  const last = sh.getLastRow();
  if (last < 2) return;
  ['eligibility_summary', 'required_skills', 'embedding', 'ai_attempts'].forEach(function (c) {
    const idx = JOB_COLUMNS.indexOf(c);
    if (idx >= 0) sh.getRange(2, idx + 1, last - 1, 1).clearContent();
  });
  // Rewind the scan cursor too (offset 0 = start again from the newest rows),
  // or the next pass would resume mid-tab and leave the freshest jobs waiting
  // until the cursor wrapped all the way round.
  PropertiesService.getScriptProperties().deleteProperty(AI_CURSOR_KEY_);
  log_('resetAiEnrichment: cleared AI columns on ' + (last - 1) + ' rows, cursor rewound');
}
