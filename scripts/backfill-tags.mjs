/**
 * Backfill tags for all existing jobs.
 * 
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/backfill-tags.mjs
 * 
 * Requires: @supabase/supabase-js (already in project deps)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Tag rules (mirrored from src/lib/tagRules.ts) ──────────────────────
const TAG_RULES = {
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
  "8th_pass": ["8th pass", "class viii", "middle pass", "8th class"],
  "10th_pass": ["10th pass", "10th", "class x", "matriculation", "ssc pass", "10 pass", "matric"],
  "12th_pass": ["12th pass", "12th", "class xii", "intermediate", "higher secondary", "+2", "10+2"],
  graduate: ["graduate", "graduation", "bachelor", "degree holder", "b.a", "b.sc", "b.com", "bca", "bba"],
  post_graduate: ["post graduate", "post-graduate", "master", "m.a", "m.sc", "m.com", "mca", "mba", "m.phil"],
  phd: ["phd", "doctorate", "ph.d"],
  diploma: ["diploma"],
  iti: ["iti"],
  group_a: ["group a", "group-a", "gazetted"],
  group_b: ["group b", "group-b"],
  group_c: ["group c", "group-c", "non-gazetted"],
  group_d: ["group d", "group-d", "mts", "multi tasking", "multi-tasking", "safaiwala", "peon"],
};

function generateTags(job) {
  const text = [job.title, job.department, job.description, job.eligibility, job.qualification]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const tags = [];
  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    if (keywords.some(k => text.includes(k))) {
      tags.push(tag);
    }
  }
  return tags;
}

async function run() {
  const BATCH_SIZE = 100;
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  console.log('Starting tag backfill...');

  while (true) {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, department, description, eligibility, qualification')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      break;
    }

    if (!jobs || jobs.length === 0) break;

    for (const job of jobs) {
      const tags = generateTags(job);

      if (tags.length === 0) {
        totalSkipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ tags })
        .eq('id', job.id);

      if (updateError) {
        console.error(`Failed to update job ${job.id}:`, updateError.message);
      } else {
        totalUpdated++;
      }
    }

    console.log(`Processed ${offset + jobs.length} jobs (${totalUpdated} tagged, ${totalSkipped} no tags)`);
    offset += BATCH_SIZE;
  }

  console.log(`\nDone! ${totalUpdated} jobs tagged, ${totalSkipped} had no matching tags.`);
}

run().catch(console.error);
