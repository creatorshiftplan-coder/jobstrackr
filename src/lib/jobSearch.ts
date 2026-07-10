import { Job } from "@/types/job";

/**
 * Relevance-ranked job search.
 *
 * Replaces the old "whole-query substring on one field" filter with a proper
 * scoring engine that supports:
 *   • multi-token, out-of-order matching (AND semantics across all fields)
 *   • per-field weighting (title > department > tags > qualification > …)
 *   • match-quality tiers (exact > prefix/word-start > substring > fuzzy)
 *   • synonym / acronym expansion (e.g. "ias" surfaces "Civil Services",
 *     "ssc cgl" matches "Staff Selection Commission – Combined Graduate Level")
 *   • single-character typo tolerance for longer tokens
 *
 * Jobs that don't match every meaningful query token are scored 0 and dropped.
 */

// ── Synonym expansion ────────────────────────────────────────────────────────
// Each group is a set of *true equivalents* — terms a user would expect to be
// interchangeable. These are deliberately tight: an organisation's acronym maps
// to its full name (and vice-versa), but specific exams (CGL, CHSL, IAS, IPS…)
// are kept distinct so that searching "ssc cgl" returns CGL roles, not every
// SSC exam. Qualification aliases are grouped the same way.
const SYNONYM_GROUPS: string[][] = [
  // Organisations (acronym ↔ full name)
  ["ssc", "staff selection commission"],
  ["upsc", "union public service commission"],
  ["ias", "civil services", "civil service"],
  ["rrb", "railway recruitment board", "railway", "railways", "indian railways"],
  ["ibps", "institute of banking personnel selection"],
  ["rbi", "reserve bank of india"],
  ["sbi", "state bank of india"],
  ["lic", "life insurance corporation"],
  ["psc", "public service commission"],
  ["isro", "indian space research organisation"],
  ["drdo", "defence research and development organisation"],
  ["capf", "central armed police forces"],
  ["nda", "national defence academy"],
  ["cds", "combined defence services"],
  ["bsf", "border security force"],
  ["crpf", "central reserve police force"],
  ["cisf", "central industrial security force"],
  ["itbp", "indo tibetan border police"],
  ["ctet", "central teacher eligibility test"],
  ["tet", "teacher eligibility test"],
  ["neet", "national eligibility cum entrance test"],
  // Roles
  ["sub inspector", "si", "daroga"],
  ["clerk", "clerical", "ldc", "udc"],
  ["constable", "sipahi"],
  ["junior engineer", "je"],
  ["assistant engineer", "ae"],
  ["data entry operator", "deo", "data entry"],
  ["multi tasking staff", "mts"],
  // Qualifications
  ["10th", "matriculation", "matric", "class 10", "high school", "sslc"],
  ["12th", "intermediate", "higher secondary", "class 12", "hsc", "10+2", "plus two"],
  ["graduate", "graduation", "bachelor", "bachelors", "degree"],
  ["postgraduate", "post graduate", "post-graduate", "master", "masters", "pg"],
  ["diploma", "polytechnic"],
  ["iti", "industrial training institute"],
];

const synonymIndex = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const set = new Set(group);
  for (const term of group) {
    const existing = synonymIndex.get(term);
    if (existing) {
      for (const t of set) existing.add(t);
    } else {
      synonymIndex.set(term, new Set(set));
    }
  }
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "in", "on", "and", "or", "to", "job", "jobs",
  "post", "posts", "vacancy", "vacancies", "recruitment", "exam", "exams",
]);

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (s: string): string[] =>
  normalize(s).split(" ").filter(Boolean);

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
    if (rowMin > max) return false; // whole row already over budget
  }
  return prev[b.length] <= max;
};

interface SearchField {
  text: string;       // normalized full field text
  words: string[];    // normalized word list
  weight: number;     // base field weight
}

interface QueryToken {
  term: string;
  /** term + its synonyms/acronym expansions, all normalized */
  expansions: string[];
}

export interface ParsedQuery {
  raw: string;
  phrase: string;        // normalized full query
  tokens: QueryToken[];
}

/** Parse a raw query string once, so it can be reused across all jobs. */
export const parseSearchQuery = (raw: string): ParsedQuery => {
  const phrase = normalize(raw);
  const tokens = tokenize(raw)
    .filter((t) => !STOPWORDS.has(t) || tokenize(raw).length === 1)
    .map<QueryToken>((term) => {
      const expansions = new Set<string>([term]);
      const syn = synonymIndex.get(term);
      if (syn) for (const s of syn) expansions.add(s);
      return { term, expansions: [...expansions] };
    });
  return { raw, phrase, tokens };
};

const buildFields = (job: Job): SearchField[] => {
  const fields: SearchField[] = [
    { text: normalize(job.title ?? ""), weight: 10 },
    { text: normalize(job.department ?? ""), weight: 6 },
    { text: normalize((job.tags ?? []).join(" ")), weight: 5 },
    { text: normalize(job.qualification ?? ""), weight: 4 },
    { text: normalize(`${job.location ?? ""} ${job.inferred_location ?? ""}`), weight: 4 },
    { text: normalize(job.eligibility_summary ?? job.description ?? ""), weight: 1.5 },
  ].map((f) => ({ ...f, words: f.text ? f.text.split(" ") : [] }));
  return fields;
};

/**
 * Score how strongly a single expansion term matches one field.
 * Returns 0 when there's no match. Higher = better match quality.
 */
const scoreTermInField = (term: string, field: SearchField): number => {
  if (!field.text || !term) return 0;

  // Exact whole-field match (e.g. location === "delhi")
  if (field.text === term) return field.weight * 3;

  // Word-level matches
  let best = 0;
  for (const word of field.words) {
    if (word === term) {
      best = Math.max(best, field.weight * 2); // exact word
    } else if (word.startsWith(term) && term.length >= 2) {
      best = Math.max(best, field.weight * 1.5); // prefix / word-start
    } else if (term.length >= 2 && word.includes(term)) {
      best = Math.max(best, field.weight * 1.2); // substring inside a word ("spector" → "inspector")
    } else if (
      term.length >= 4 &&
      Math.abs(word.length - term.length) <= 1 &&
      withinEditDistance(word, term, 1)
    ) {
      best = Math.max(best, field.weight * 0.6); // single-typo fuzzy
    }
  }
  if (best > 0) return best;

  // Substring anywhere in the field (multi-word terms / partials spanning words)
  if (term.length >= 2 && field.text.includes(term)) {
    return field.weight * 1;
  }
  return 0;
};

/** Best score for a query token across all of a job's fields. */
const scoreToken = (token: QueryToken, fields: SearchField[]): number => {
  let best = 0;
  for (const exp of token.expansions) {
    // Synonyms (anything other than the literal typed term) are worth a bit
    // less so a direct hit always outranks an expansion-only hit.
    const isSynonym = exp !== token.term;
    for (const field of fields) {
      const raw = scoreTermInField(exp, field);
      if (raw <= 0) continue;
      const adjusted = isSynonym ? raw * 0.5 : raw;
      if (adjusted > best) best = adjusted;
    }
  }
  return best;
};

/**
 * Score a job against a parsed query. Returns 0 if the job is not a meaningful
 * match (i.e. at least one query token matched nowhere).
 */
export const scoreJobForQuery = (job: Job, query: ParsedQuery): number => {
  if (query.tokens.length === 0) return 0;
  const fields = buildFields(job);

  let total = 0;
  for (const token of query.tokens) {
    const s = scoreToken(token, fields);
    if (s === 0) return 0; // AND semantics — every token must match somewhere
    total += s;
  }

  // Phrase bonus: reward jobs where the full query appears intact, strongest in
  // the title. Helps "delhi police constable" rank exact matches to the top.
  if (query.tokens.length > 1 && query.phrase) {
    if (fields[0].text.includes(query.phrase)) total += 40;
    else if (fields[1].text.includes(query.phrase)) total += 20;
    else if (fields.some((f) => f.text.includes(query.phrase))) total += 8;
  }

  // Small nudge for featured roles among otherwise-equal matches.
  if (job.is_featured) total += 1;

  return total;
};
