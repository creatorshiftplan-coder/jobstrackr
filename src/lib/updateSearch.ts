/**
 * Deep, all-fields search for exam updates.
 *
 * Unlike the job search (which scores a fixed set of weighted fields), an exam
 * update carries most of its information *inside* nested content — summary,
 * sections, overview rows, important dates, quick links, related articles,
 * tags and the raw scraped text. The user wants the Trending search to match
 * against ALL of that ("from inside also"), so we flatten every string the
 * record holds into one haystack and match query tokens against it.
 *
 * Matching is intentionally lenient:
 *   • a token matches if it appears anywhere in the haystack — including in the
 *     middle of a word (substring), so "spector" finds "inspector";
 *   • longer tokens tolerate a single-character typo (edit distance ≤ 1);
 *   • AND semantics — every query token must match somewhere.
 * Title hits are weighted highest so the most relevant updates rank first.
 */

// Keys that only hold identifiers / timestamps / machine data — searching them
// would produce meaningless matches (e.g. a UUID fragment), so we skip them.
const SKIP_KEYS = new Set([
  "id",
  "source_id",
  "job_id",
  "exam_id",
  "slug",
  "created_at",
  "updated_at",
  "scraped_at",
  "images",
  "level",
]);

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "in", "on", "and", "or", "to",
  "exam", "exams", "update", "updates", "latest", "news",
]);

export const tokenizeQuery = (raw: string): string[] => {
  const all = normalize(raw).split(" ").filter(Boolean);
  const meaningful = all.filter((t) => !STOPWORDS.has(t));
  // If the query is entirely stopwords (e.g. just "news"), keep them so the
  // search still does something sensible.
  return meaningful.length > 0 ? meaningful : all;
};

/** Recursively collect every human-readable string in a value. */
const collectStrings = (val: unknown, out: string[], key?: string): void => {
  if (key && SKIP_KEYS.has(key)) return;
  if (val == null) return;
  if (typeof val === "string") {
    out.push(val);
  } else if (typeof val === "number") {
    out.push(String(val));
  } else if (Array.isArray(val)) {
    for (const item of val) collectStrings(item, out);
  } else if (typeof val === "object") {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      collectStrings(v, out, k);
    }
  }
};

/** Build the flattened, normalized searchable text for one update (cached per object). */
const haystackCache = new WeakMap<object, string>();
export const buildUpdateHaystack = (update: Record<string, unknown>): string => {
  if (update && typeof update === "object") {
    const cached = haystackCache.get(update);
    if (cached !== undefined) return cached;
  }
  const parts: string[] = [];
  collectStrings(update, parts);
  const hay = normalize(parts.join(" "));
  if (update && typeof update === "object") haystackCache.set(update, hay);
  return hay;
};

/** Levenshtein distance with an early exit once it exceeds `max`. */
const withinEditDistance = (a: string, b: string, max: number): boolean => {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = i;
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return false;
  }
  return prev[b.length] <= max;
};

/** True if `token` matches anywhere in `haystack` (substring or 1-char typo). */
const tokenHits = (token: string, haystack: string, words: string[]): boolean => {
  if (haystack.includes(token)) return true; // substring — matches inside words too
  if (token.length >= 4) {
    for (const w of words) {
      if (Math.abs(w.length - token.length) <= 1 && withinEditDistance(w, token, 1)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Score an update against pre-tokenized query terms. Returns 0 when the update
 * is not a meaningful match (some token matched nowhere — AND semantics).
 */
export const scoreUpdateForQuery = (
  update: Record<string, unknown>,
  tokens: string[]
): number => {
  if (tokens.length === 0) return 0;
  const haystack = buildUpdateHaystack(update);
  if (!haystack) return 0;
  const words = haystack.split(" ");
  const title = normalize(String((update as { title?: string }).title ?? ""));

  let score = 0;
  for (const token of tokens) {
    if (!tokenHits(token, haystack, words)) return 0;
    // Title matches are the strongest relevance signal.
    score += title.includes(token) ? 5 : 1;
  }

  // Phrase bonus when the whole query appears intact (title strongest).
  if (tokens.length > 1) {
    const phrase = tokens.join(" ");
    if (title.includes(phrase)) score += 20;
    else if (haystack.includes(phrase)) score += 6;
  }
  return score;
};

/**
 * Filter + rank a list of exam updates by a free-text query.
 * Preserves the input order for equal-scoring items (callers pass an
 * already sorted list, e.g. newest-first).
 */
export const searchUpdates = <T extends Record<string, unknown>>(
  updates: T[],
  query: string
): T[] => {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return updates;
  const scored: { update: T; score: number; index: number }[] = [];
  updates.forEach((update, index) => {
    const score = scoreUpdateForQuery(update, tokens);
    if (score > 0) scored.push({ update, score, index });
  });
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));
  return scored.map((s) => s.update);
};
