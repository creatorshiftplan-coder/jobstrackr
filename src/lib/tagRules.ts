import { Job } from "@/types/job";

/**
 * Rule-based tag generation for Indian government jobs.
 * Tags are used for hybrid recommendation scoring — matching user interests
 * and tracked exams against job tags without needing embeddings.
 *
 * Categories:
 * - Sector: ssc, banking, railway, defence, upsc, teaching, state_psc, police, medical, engineering, etc.
 * - Qualification tier: 8th_pass, 10th_pass, 12th_pass, graduate, post_graduate, phd, diploma, iti
 * - Job group: group_a, group_b, group_c, group_d
 * - Organization type: psu, central_govt, state_govt, judiciary, research
 */

// Each key is a tag; its value is an array of keywords that trigger it
export const TAG_RULES: Record<string, string[]> = {
  // ── Sectors ────────────────────────────────────────────
  ssc: ["ssc", "staff selection commission", "ssc cgl", "ssc chsl", "ssc mts", "ssc gd", "ssc je", "ssc stenographer"],
  upsc: ["upsc", "union public service commission", "ias", "ips", "ifs", "civil services", "nda", "cds", "capf"],
  banking: ["ibps", "sbi", "rbi", "nabard", "idbi", "bank of baroda", "canara bank", "indian bank", "bank clerk", "bank po", "banking"],
  insurance: ["lic", "niacl", "uiic", "gic", "irda", "insurance", "oicl", "nicl"],
  railway: ["rrb", "railway", "rrb ntpc", "rrb group d", "rrb je", "rrb alp", "indian railways", "rail"],
  defence: ["army", "navy", "air force", "coast guard", "agniveer", "nda", "cds", "defence", "military", "afcat", "territorial army"],
  police: ["police", "constable", "si ", "sub inspector", "cisf", "crpf", "bsf", "itbp", "ssb", "rpf", "ssc gd", "capf", "paramilitary"],
  teaching: ["teacher", "teaching", "tet", "ctet", "b.ed", "bed ", "kvs", "nvs", "kendriya vidyalaya", "navodaya", "ugc net", "net jrf", "lecturer", "professor", "faculty"],
  state_psc: ["psc", "public service commission", "bpsc", "uppsc", "mppsc", "rpsc", "appsc", "tspsc", "wbpsc", "kpsc", "gpsc", "opsc", "jpsc", "hpsc", "ppsc", "ukpsc", "cgpsc"],
  medical: ["doctor", "mbbs", "medical officer", "ayush", "bams", "bhms", "bums", "bds", "dentist", "dental", "health department", "hospital", "pharmacist"],
  nursing: ["nurse", "nursing", "gnm", "anm", "staff nurse", "b.sc nursing"],
  engineering: ["engineer", "b.tech", "btech", "je ", "junior engineer", "ae ", "assistant engineer", "overseer", "technical"],
  judiciary: ["court", "judge", "judicial", "high court", "district court", "tribunal", "law clerk", "stenographer court"],
  post_office: ["post office", "postal", "india post", "postman", "mail guard", "gramin dak sevak", "gds"],
  forest: ["forest", "ranger", "forestry", "van vibhag", "wildlife"],
  research: ["research", "scientist", "jrf", "srf", "csir", "isro", "drdo", "icar", "icmr", "project assistant"],
  psu: ["ntpc", "bhel", "gail", "ongc", "iocl", "bpcl", "hpcl", "coal india", "sail", "pgcil", "powergrid", "bel", "hal", "mdl", "nhpc", "nlc", "bsnl", "mtnl", "concor"],
  data_entry: ["data entry", "deo", "typist", "computer operator"],
  clerical: ["clerk", "ldc", "udc", "lower division", "upper division", "office assistant", "junior assistant", "clerical"],
  apprentice: ["apprentice", "apprenticeship", "trade apprentice", "graduate apprentice", "technician apprentice"],

  // ── Qualification tiers ────────────────────────────────
  "8th_pass": ["8th pass", "class viii", "middle pass", "8th class"],
  "10th_pass": ["10th pass", "10th", "class x", "matriculation", "ssc pass", "10 pass", "matric"],
  "12th_pass": ["12th pass", "12th", "class xii", "intermediate", "higher secondary", "+2", "10+2"],
  graduate: ["graduate", "graduation", "bachelor", "degree holder", "b.a", "b.sc", "b.com", "bca", "bba"],
  post_graduate: ["post graduate", "post-graduate", "master", "m.a", "m.sc", "m.com", "mca", "mba", "m.phil"],
  phd: ["phd", "doctorate", "ph.d"],
  diploma: ["diploma"],
  iti: ["iti"],

  // ── Job groups ─────────────────────────────────────────
  group_a: ["group a", "group-a", "gazetted"],
  group_b: ["group b", "group-b"],
  group_c: ["group c", "group-c", "non-gazetted"],
  group_d: ["group d", "group-d", "mts", "multi tasking", "multi-tasking", "safaiwala", "peon"],
};

/**
 * Generate tags for a job by scanning its text content against TAG_RULES.
 * Scans: title, department, description, eligibility, qualification
 */
export function generateTags(job: Pick<Job, "title" | "department" | "description" | "eligibility" | "qualification">): string[] {
  const text = [
    job.title,
    job.department,
    job.description,
    job.eligibility,
    job.qualification,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      tags.push(tag);
    }
  }

  return tags;
}
