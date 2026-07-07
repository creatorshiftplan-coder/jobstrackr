const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "govt", "government", "recruitment",
  "notification", "apply", "online", "admit", "card", "result", "answer", "key", "syllabus",
  "exam", "examination", "released", "declared", "download", "available", "out", "latest", "update",
  "updates", "post", "posts", "vacancy", "vacancies", "job", "jobs", "new", "final", "provisional",
  "merit", "list", "score", "scorecard", "marks", "cut", "off", "hall", "ticket", "call", "letter",
  "date", "dates", "schedule", "phase", "stage", "tier", "part", "paper", "notice", "pdf", "link",
  "how", "check", "know", "important", "details", "status", "pattern", "cutoff",
]);

const YEAR_PATTERN = /^(19|20)\d{2}$/;

const SYNONYMS: Record<string, string> = {
  constable: "constable",
  gd: "constable",
  police: "police",
  si: "subinspector",
  sub: "subinspector",
  inspector: "subinspector",
  assistant: "assistant",
  asst: "assistant",
  junior: "junior",
  jr: "junior",
  senior: "senior",
  sr: "senior",
  officer: "officer",
  po: "officer",
  clerk: "clerk",
  clerical: "clerk",
  apprentice: "apprentice",
  apprenticehip: "apprentice",
  ssc: "ssc",
  cgl: "cgl",
  chsl: "chsl",
  mts: "mts",
  ntpc: "ntpc",
  rrb: "rrb",
  ibps: "ibps",
  ctet: "ctet",
  nda: "nda",
  cds: "cds",
  upsc: "upsc",
  bpsc: "bpsc",
  uppsc: "uppsc",
  mppsc: "mppsc",
  rpsc: "rpsc",
  capf: "capf",
  afcat: "afcat",
  tet: "tet",
  kvs: "kvs",
  nvs: "nvs",
  dsssb: "dsssb",
  nabard: "nabard",
  rbi: "rbi",
  sbi: "sbi",
  lic: "lic",
  neet: "neet",
  jee: "jee",
  rpf: "rpf",
  crpf: "crpf",
  bsf: "bsf",
  cisf: "cisf",
  osssc: "osssc",
  esic: "esic",
  fci: "fci",
  ongc: "ongc",
  drdo: "drdo",
  isro: "isro",
  nhpc: "nhpc",
  sail: "sail",
  hpcl: "hpcl",
  bpcl: "bpcl",
  iocl: "iocl",
  prelims: "prelims",
  preliminary: "prelims",
  mains: "mains",
  main: "mains",
  railway: "rrb",
  railways: "rrb",
  uttar: "up",
  madhya: "mp",
  himachal: "hp",
  tn: "tamil",
  nadu: "tamil",
  wb: "bengal",
  orissa: "odisha",
  combined: "combined",
  graduate: "graduate",
  level: "level",
  group: "group",
  technician: "technician",
  tech: "technician",
  steno: "stenographer",
  stenographer: "stenographer",
  havaldar: "havaldar",
  head: "head",
};

export function tokenizeTitle(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token) && !YEAR_PATTERN.test(token))
    .map((token) => SYNONYMS[token] || token);
}

function getBigrams(tokens: string[]): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]}|${tokens[i + 1]}`);
  }
  return bigrams;
}

function getBigramOverlapScore(sourceTokens: string[], candidateTokens: string[]): number {
  if (sourceTokens.length < 2 || candidateTokens.length < 2) return 0;
  const sourceBigrams = getBigrams(sourceTokens);
  const candidateBigrams = getBigrams(candidateTokens);
  let shared = 0;
  for (const bg of sourceBigrams) {
    if (candidateBigrams.has(bg)) shared++;
  }
  if (shared === 0) return 0;
  return (shared / Math.min(sourceBigrams.size, candidateBigrams.size)) * 15;
}

export function getTitleMatchScore(sourceTitle: string | null | undefined, candidateTitle: string | null | undefined): number {
  const sourceTokens = Array.from(new Set(tokenizeTitle(sourceTitle)));
  const candidateTokens = Array.from(new Set(tokenizeTitle(candidateTitle)));

  if (sourceTokens.length === 0 || candidateTokens.length === 0) return 0;

  const sourceText = sourceTokens.join(" ");
  const candidateText = candidateTokens.join(" ");

  if (sourceText === candidateText) return 100;
  if (sourceText.includes(candidateText) || candidateText.includes(sourceText)) return 90;

  const sourceSet = new Set(sourceTokens);
  const candidateSet = new Set(candidateTokens);
  const overlap = sourceTokens.filter((token) => candidateSet.has(token));
  const reverseOverlap = candidateTokens.filter((token) => sourceSet.has(token));
  const shared = Math.max(overlap.length, reverseOverlap.length);

  if (shared === 0) return 0;

  const sourceCoverage = shared / sourceTokens.length;
  const candidateCoverage = shared / candidateTokens.length;
  const jaccard = shared / new Set([...sourceTokens, ...candidateTokens]).size;
  const importantBoost = overlap.some((token) => token.length >= 4) ? 10 : 0;
  const bigramBonus = getBigramOverlapScore(sourceTokens, candidateTokens);

  return Math.round((sourceCoverage * 35) + (candidateCoverage * 30) + (jaccard * 10) + importantBoost + bigramBonus);
}

export function sortByTitleMatch<T>(sourceTitle: string, candidates: T[], getTitle: (candidate: T) => string | null | undefined, minScore: number = 45): T[] {
  return [...candidates]
    .map((candidate) => ({ candidate, score: getTitleMatchScore(sourceTitle, getTitle(candidate)) }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}

// Tokens that identify WHICH exam a title refers to: conducting body, exam
// tier, state, or armed-force branch (post-SYNONYMS forms). Role words like
// "constable"/"clerk" are deliberately excluded — they are shared across
// unrelated recruitments and are what makes overlap scoring match the wrong
// exam (e.g. "UP Police Constable" vs "Bihar Police Constable").
const EXAM_IDENTITY_TOKENS = new Set([
  // Conducting bodies / organisations
  "ssc", "upsc", "ibps", "rrb", "rbi", "sbi", "lic", "nabard", "dsssb",
  "kvs", "nvs", "esic", "fci", "ongc", "drdo", "isro", "nhpc", "sail",
  "hpcl", "bpcl", "iocl", "rpf", "crpf", "bsf", "cisf", "capf", "osssc",
  "bpsc", "uppsc", "mppsc", "rpsc", "tnpsc", "afcat", "nda", "cds",
  "neet", "jee", "ctet", "gate", "cuet", "clat",
  // Exam tiers / streams under one conducting body
  "cgl", "chsl", "mts", "ntpc", "alp", "ug", "pg",
  // States and union territories
  "bihar", "up", "mp", "hp", "delhi", "punjab", "haryana", "rajasthan",
  "gujarat", "maharashtra", "goa", "karnataka", "kerala", "tamil",
  "telangana", "andhra", "odisha", "bengal", "assam", "jharkhand",
  "chhattisgarh", "uttarakhand", "sikkim", "tripura", "manipur",
  "meghalaya", "mizoram", "nagaland", "jammu", "kashmir", "ladakh",
  "puducherry", "chandigarh",
  // Armed-force branches
  "army", "navy", "iaf",
]);

/**
 * True when the candidate title names a different exam identity than the
 * source — e.g. "SSC CGL" vs "SSC MTS", or "UP Police" vs "Bihar Police".
 * A candidate may omit identity tokens (generic updates are fine), but must
 * not introduce identity tokens the source exam doesn't have.
 */
export function hasExamIdentityConflict(sourceTitle: string | null | undefined, candidateTitle: string | null | undefined): boolean {
  const sourceIds = new Set(tokenizeTitle(sourceTitle).filter((t) => EXAM_IDENTITY_TOKENS.has(t)));
  if (sourceIds.size === 0) return false;
  const candidateIds = tokenizeTitle(candidateTitle).filter((t) => EXAM_IDENTITY_TOKENS.has(t));
  if (candidateIds.length === 0) return false;
  return candidateIds.some((t) => !sourceIds.has(t));
}
