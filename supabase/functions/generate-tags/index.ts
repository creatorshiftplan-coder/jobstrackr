/**
 * Edge Function: generate-tags
 *
 * Generates rule-based tags for a job.
 * Called after job insert/update (via DB webhook or admin UI).
 *
 * Request body:
 *   { job_id: string }           — tag a single job
 *   { job_ids: string[] }        — tag multiple jobs
 *   { backfill: true, limit: N } — tag all un-tagged jobs (batch mode)
 *
 * Tags are written directly to jobs.tags column.
 * Embedding generation is NOT done here — run scripts/generate-embeddings.mjs locally.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Tag rules (mirrored from src/lib/tagRules.ts) ──────────────────────
const TAG_RULES: Record<string, string[]> = {
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

function generateTags(job: { title: string; department: string; description?: string; eligibility?: string; qualification?: string }): string[] {
  const text = [job.title, job.department, job.description, job.eligibility, job.qualification]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    if (keywords.some((k) => text.includes(k))) {
      tags.push(tag);
    }
  }
  return tags;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { job_id, job_ids, backfill, limit = 100 } = body;

    let targetIds: string[] = [];

    if (backfill) {
      // Fetch jobs without tags
      const { data, error } = await supabase
        .from("jobs")
        .select("id")
        .is("tags", null)
        .limit(limit);

      if (error) throw error;
      targetIds = (data || []).map((j: { id: string }) => j.id);
    } else if (job_ids && Array.isArray(job_ids)) {
      targetIds = job_ids;
    } else if (job_id) {
      targetIds = [job_id];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide job_id, job_ids, or backfill:true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job data
    const { data: jobs, error: fetchError } = await supabase
      .from("jobs")
      .select("id, title, department, description, eligibility, qualification")
      .in("id", targetIds);

    if (fetchError) throw fetchError;

    let tagged = 0;
    for (const job of jobs || []) {
      const tags = generateTags(job);
      if (tags.length > 0) {
        const { error: updateError } = await supabase
          .from("jobs")
          .update({ tags })
          .eq("id", job.id);

        if (!updateError) tagged++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: targetIds.length, tagged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
