/**
 * Backfill `exam_updates.job_id`.
 *
 * Only a handful of exam_updates rows are linked to a job, so almost every job
 * detail page misses the cheap `job_id=eq.<id>` lookup and falls through to a
 * fuzzy `title.ilike` scan over 50 rows — the single largest Supabase egress
 * item on the page. Populating `job_id` turns that scan into an indexed lookup.
 *
 * Matching reuses src/lib/titleMatcher.ts directly rather than copying it, so
 * the backfill can never drift from the runtime matcher.
 *
 * The rule here is accurate-or-absent: a wrong link is worse than no link,
 * because it pins unrelated updates to a job page permanently. Three guards,
 * all of which must pass:
 *   1. score >= MIN_SCORE (stricter than the runtime default of 45)
 *   2. hasExamIdentityConflict() rejects a different org / tier / state / force
 *   3. the best job must beat the runner-up by MIN_MARGIN — ambiguous ties are
 *      skipped rather than guessed
 *   4. at least MIN_SHARED meaningful tokens in common
 *
 * Guard 4 exists because a score of 90 only means one tokenised title contains
 * the other, which is weak when a title is short or generic. It is what rejects
 * "RSSB LDC Answer Key 2026" -> the stub job title "Junior Assistant" (2 shared
 * tokens), and "UPSSSC JE Answer Key" -> "SSC JE 2024" (1 shared token, and the
 * identity guard cannot catch it because "upsssc" is not one of its known
 * conducting-body tokens).
 *
 * Credentials are read from the project's .env (resolved from this file, not
 * the shell's cwd), falling back to VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY. Real environment variables override the file.
 *
 * Usage:
 *   # dry run — writes nothing, prints a report
 *   npx tsx scripts/backfill-exam-update-job-ids.ts
 *
 *   # apply — needs SUPABASE_SERVICE_KEY (service_role) in .env to satisfy RLS
 *   npx tsx scripts/backfill-exam-update-job-ids.ts --apply
 *
 * Flags:
 *   --apply              actually write job_id (default: dry run)
 *   --min-score=<n>      override the score threshold (default 90)
 *   --min-margin=<n>     override the runner-up margin (default 10)
 *   --min-shared=<n>     override the shared-token floor (default 3)
 *   --samples=<n>        how many sample matches to print (default 20)
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getTitleMatchScore, hasExamIdentityConflict, tokenizeTitle } from "../src/lib/titleMatcher";

// ── Config ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Read the project's .env, resolved from this file's location rather than the
 * shell's working directory, so the script behaves the same from anywhere.
 * Real environment variables always take precedence over the file.
 */
function loadProjectEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(path.join(PROJECT_ROOT, ".env"), "utf8");
  } catch {
    return; // no .env is fine — values may come from the real environment
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}
loadProjectEnv();

function numArg(name: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const parsed = Number(raw.split("=")[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Runtime uses 45; a permanent write should be far more confident. At 90 the
 * score means one tokenised title contains the other (100 = identical), so
 * matches are near-restatements of the same posting rather than fuzzy guesses.
 */
const MIN_SCORE = numArg("min-score", 90);
/** Best match must beat the runner-up by this much, else it is ambiguous. */
const MIN_MARGIN = numArg("min-margin", 10);
/** Floor on shared meaningful tokens — see guard 4 in the header. */
const MIN_SHARED = numArg("min-shared", 3);
const SAMPLE_COUNT = numArg("samples", 20);

// Accept the script-specific names or the VITE_* ones already in .env.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

/**
 * A dry run only reads, so the publishable key is enough. --apply writes, which
 * RLS blocks for that key, so it requires the service_role (secret) key.
 */
const SUPABASE_KEY = APPLY
  ? process.env.SUPABASE_SERVICE_KEY
  : process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  console.error(
    `Missing SUPABASE_URL (or VITE_SUPABASE_URL).\nChecked the environment and ${path.join(PROJECT_ROOT, ".env")}`
  );
  process.exit(1);
}

if (!SUPABASE_KEY) {
  console.error(
    APPLY
      ? "Missing SUPABASE_SERVICE_KEY.\n\n" +
          "--apply writes through RLS, so it needs the service_role (secret) key —\n" +
          "Supabase dashboard > Project Settings > API Keys > service_role.\n\n" +
          `Add it to ${path.join(PROJECT_ROOT, ".env")} as:\n\n` +
          "  SUPABASE_SERVICE_KEY=<key>\n\n" +
          "Do NOT prefix it with VITE_ — Vite inlines VITE_* vars into the browser bundle."
      : "Missing a Supabase key (SUPABASE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Types ─────────────────────────────────────────────────────────────
interface JobRow {
  id: string;
  title: string;
}
interface UpdateRow {
  id: string;
  title: string;
}
interface Match {
  update: UpdateRow;
  job: JobRow;
  score: number;
  runnerUp: number;
}

// ── Paged fetch (keeps each request small; no full-table ad-hoc scans) ─
async function fetchAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log(
    `Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (writes nothing)"} | ` +
      `min-score=${MIN_SCORE} min-margin=${MIN_MARGIN}\n`
  );

  const jobs = await fetchAll<JobRow>("jobs", "id,title");
  const updates = await fetchAll<UpdateRow>("exam_updates", "id,title", (q) => q.is("job_id", null));
  console.log(`Loaded ${jobs.length} jobs, ${updates.length} unlinked exam_updates.\n`);

  // Inverted index token -> job indices. getTitleMatchScore() returns 0 when no
  // tokens are shared, so restricting candidates to jobs sharing at least one
  // token cannot change any result — it only avoids ~17M pointless comparisons.
  const byToken = new Map<string, number[]>();
  const jobTokens: Set<string>[] = [];
  jobs.forEach((job, i) => {
    const tokens = new Set(tokenizeTitle(job.title));
    jobTokens[i] = tokens;
    for (const token of tokens) {
      const bucket = byToken.get(token);
      if (bucket) bucket.push(i);
      else byToken.set(token, [i]);
    }
  });

  const matched: Match[] = [];
  let noCandidates = 0;
  let belowScore = 0;
  let rejectedByGuard = 0;
  let tooFewShared = 0;
  let ambiguous = 0;

  for (const update of updates) {
    const updateTokens = new Set(tokenizeTitle(update.title));
    const candidateIdx = new Set<number>();
    for (const token of updateTokens) {
      for (const i of byToken.get(token) || []) candidateIdx.add(i);
    }
    if (candidateIdx.size === 0) {
      noCandidates++;
      continue;
    }

    let best: JobRow | null = null;
    let bestScore = 0;
    let runnerUp = 0;
    let sawGuardRejection = false;
    let sawTooFewShared = false;

    for (const i of candidateIdx) {
      const job = jobs[i];
      // Source is the job title, matching the runtime direction in
      // useExamUpdatesForJob (sortByTitleMatch(jobTitle, updates, ...)).
      const score = getTitleMatchScore(job.title, update.title);
      if (score < MIN_SCORE) continue;
      if (hasExamIdentityConflict(job.title, update.title)) {
        sawGuardRejection = true;
        continue;
      }
      let shared = 0;
      for (const token of jobTokens[i]) if (updateTokens.has(token)) shared++;
      if (shared < MIN_SHARED) {
        sawTooFewShared = true;
        continue;
      }
      if (score > bestScore) {
        runnerUp = bestScore;
        bestScore = score;
        best = job;
      } else if (score > runnerUp) {
        runnerUp = score;
      }
    }

    if (!best) {
      if (sawGuardRejection) rejectedByGuard++;
      else if (sawTooFewShared) tooFewShared++;
      else belowScore++;
      continue;
    }
    if (bestScore - runnerUp < MIN_MARGIN && runnerUp > 0) {
      ambiguous++;
      continue;
    }
    matched.push({ update, job: best, score: bestScore, runnerUp });
  }

  // ── Report ──────────────────────────────────────────────────────────
  const pct = (n: number) => `${((n / updates.length) * 100).toFixed(1)}%`;
  console.log("── Result ───────────────────────────────────────────────");
  console.log(`  confident matches : ${matched.length} (${pct(matched.length)})`);
  console.log(`  no shared tokens  : ${noCandidates} (${pct(noCandidates)})`);
  console.log(`  below min-score   : ${belowScore} (${pct(belowScore)})`);
  console.log(`  rejected by guard : ${rejectedByGuard} (${pct(rejectedByGuard)})`);
  console.log(`  too few shared    : ${tooFewShared} (${pct(tooFewShared)})`);
  console.log(`  ambiguous (tie)   : ${ambiguous} (${pct(ambiguous)})`);

  const samples = [...matched].sort((a, b) => b.score - a.score);
  const show = (list: Match[], label: string) => {
    if (list.length === 0) return;
    console.log(`\n── ${label} ─────────────────────────────────────`);
    for (const m of list) {
      console.log(`  [${m.score}${m.runnerUp ? ` vs ${m.runnerUp}` : ""}]`);
      console.log(`    update: ${m.update.title}`);
      console.log(`    job   : ${m.job.title}`);
    }
  };
  show(samples.slice(0, Math.ceil(SAMPLE_COUNT / 2)), `Top ${Math.ceil(SAMPLE_COUNT / 2)} matches`);
  show(
    samples.slice(-Math.floor(SAMPLE_COUNT / 2)),
    `Weakest ${Math.floor(SAMPLE_COUNT / 2)} matches (review these closely)`
  );

  if (!APPLY) {
    console.log(`\nDry run complete — nothing written. Re-run with --apply to write ${matched.length} links.`);
    return;
  }

  // ── Apply: one request per job, updating all of its matched rows ────
  const byJob = new Map<string, string[]>();
  for (const m of matched) {
    const bucket = byJob.get(m.job.id);
    if (bucket) bucket.push(m.update.id);
    else byJob.set(m.job.id, [m.update.id]);
  }

  console.log(`\nWriting ${matched.length} links across ${byJob.size} jobs...`);
  let written = 0;
  let failed = 0;
  for (const [jobId, updateIds] of byJob) {
    for (let i = 0; i < updateIds.length; i += 100) {
      const chunk = updateIds.slice(i, i + 100);
      const { error } = await supabase
        .from("exam_updates")
        .update({ job_id: jobId })
        .in("id", chunk)
        .is("job_id", null); // never overwrite a link that already exists
      if (error) {
        failed += chunk.length;
        console.error(`  FAILED job ${jobId}: ${error.message}`);
      } else {
        written += chunk.length;
      }
    }
  }
  console.log(`Done. Written: ${written}, failed: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
