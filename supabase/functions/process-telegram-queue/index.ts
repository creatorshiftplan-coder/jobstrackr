import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is missing!");
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface QueueItem {
  id: string;
  user_id: string;
  telegram_chat_id: string;
  message_text: string;
  retry_count: number;
}

// Indian states list for location matching
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar", "Chandigarh", "Dadra and Nagar", "Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Check if a text matches a category preference
function matchesCategory(val: string, pref: any): boolean {
  return (
    (pref.ssc && (val.includes("ssc") || val.includes("staff selection"))) ||
    (pref.upsc && (val.includes("upsc") || val.includes("union public"))) ||
    (pref.railway && (val.includes("railway") || val.includes("rrb"))) ||
    (pref.banking && (val.includes("bank") || val.includes("ibps") || val.includes("sbi"))) ||
    (pref.defence && (val.includes("defence") || val.includes("army") || val.includes("navy") || val.includes("police") || val.includes("constable") || val.includes("military") || val.includes("bsf") || val.includes("crpf") || val.includes("cisf"))) ||
    (pref.psu && (val.includes("psu") || val.includes("ongc") || val.includes("ntpc") || val.includes("sail") || val.includes("bhel") || val.includes("iocl") || val.includes("gail"))) ||
    (pref.state_psc && (val.includes("psc") || val.includes("public service commission"))) ||
    (pref.healthcare && (val.includes("healthcare") || val.includes("medical") || val.includes("nurse") || val.includes("doctor") || val.includes("health"))) ||
    (pref.teaching && (val.includes("kvs") || val.includes("kendriya vidyalaya") || val.includes("nvs") || val.includes("navodaya vidyalaya") || val.includes("ctet") || val.includes("tet") || val.includes("ugc net") || val.includes("assistant professor") || val.includes("lecturer") || val.includes("prt") || val.includes("tgt") || val.includes("pgt"))) ||
    (pref.judiciary && (val.includes("supreme court") || val.includes("high court") || val.includes("district court") || val.includes("law clerk") || val.includes("judicial assistant"))) ||
    (pref.stenographer && (val.includes("stenographer") || val.includes("steno")))
  );
}

// Check if location matches user's preferred states
function matchesLocation(location: string, preferredStates: string[]): boolean {
  if (!preferredStates || preferredStates.length === 0) return true;
  if (preferredStates.includes("All India")) return true;

  const locLower = location.toLowerCase();
  // All India locations always match
  if (locLower.includes("all india") || locLower.includes("across india") ||
      locLower.includes("pan india") || locLower === "india" ||
      locLower.includes("various") || locLower.includes("nationwide")) {
    return true;
  }

  // Check if any preferred state is in the location
  for (const state of preferredStates) {
    if (locLower.includes(state.toLowerCase()) || state.toLowerCase().includes(locLower)) {
      return true;
    }
  }

  // Check if location has no specific state (generic location)
  const hasAnyState = INDIAN_STATES.some(s =>
    locLower.includes(s.toLowerCase()) && !preferredStates.some(ps => ps.toLowerCase() === s.toLowerCase())
  );
  return !hasAnyState;
}

// Get qualification level from text
function getQualificationLevel(qual: string | null): number {
  if (!qual) return 0;
  const q = qual.toLowerCase();
  if (q.includes("post") && q.includes("graduat") || q.includes("master") || q.includes("mtech") || q.includes("phd") || q.includes("doctorate")) return 5;
  if (q.includes("graduat") || q.includes("degree") || q.includes("btech") || q.includes("b.e") || q.includes("bsc") || q.includes("mbbs") || q.includes("llb") || q.includes("b.ed")) return 4;
  if (q.includes("diploma")) return 3.5;
  if (q.includes("12th") || q.includes("hsc") || q.includes("intermediate") || q.includes("iti")) return 3;
  if (q.includes("10th") || q.includes("matric")) return 2;
  if (q.includes("8th") || q.includes("middle")) return 1;
  return 0;
}

function matchesQualification(jobLevel: number, pref: any): boolean {
  if (jobLevel === 0) return true;
  if (jobLevel === 5 && pref.postgraduate) return true;
  if (jobLevel === 4 && pref.graduate) return true;
  if (jobLevel === 3.5 && (pref.graduate || pref.twelfth_pass)) return true;
  if (jobLevel === 3 && pref.twelfth_pass) return true;
  if (jobLevel <= 2 && pref.tenth_pass) return true;
  return false;
}

// Enqueue matching notifications for a new job
async function enqueueJobNotifications(supabase: any, payload: any) {
  const {
    job_id, title, department, location, qualification,
    vacancies_display, last_date_display, slug,
  } = payload;

  const val = `${title || ""} ${department || ""}`.toLowerCase();
  const jobLevel = getQualificationLevel(qualification);
  const jobUrl = `https://www.jobstrackr.in/job/${slug || job_id}`;

  // Fetch all active telegram connections with preferences
  const { data: connections, error: connError } = await supabase
    .from("telegram_connections")
    .select("telegram_chat_id, user_id, notification_preferences!inner(*)")
    .eq("is_active", true);

  if (connError || !connections || connections.length === 0) {
    console.log("[process-telegram-queue] No active connections found or error:", connError?.message);
    return 0;
  }

  const itemsToInsert = [];

  for (const conn of connections) {
    const pref = conn.notification_preferences;
    if (!pref?.job_notifications) continue;

    // 1. Category match
    if (!matchesCategory(val, pref)) continue;

    // 2. Location match
    if (!matchesLocation(location || "India", pref.preferred_states || [])) continue;

    // 3. Qualification match
    if (!matchesQualification(jobLevel, pref)) continue;

    // Build HTML message
    const msg = [
      `🚨 <b>NEW JOB ALERT</b>`,
      ``,
      `📋 <b>Title</b>: ${escapeHtml(title)}`,
      `🏢 <b>Organization</b>: ${escapeHtml(department)}`,
      `🎓 <b>Qualification</b>: ${escapeHtml(qualification || "Refer Notification")}`,
      `📍 <b>Location</b>: ${escapeHtml(location || "India")}`,
      `👥 <b>Vacancies</b>: ${escapeHtml(vacancies_display || "Not Published")}`,
      `📅 <b>Last Date</b>: ${escapeHtml(last_date_display || "Check Website")}`,
      ``,
      `🔗 <b><a href="${jobUrl}">View Details on Website</a></b>`,
    ].join("\n");

    itemsToInsert.push({
      user_id: conn.user_id,
      telegram_chat_id: conn.telegram_chat_id,
      job_id: job_id,
      message_text: msg,
    });
  }

  if (itemsToInsert.length === 0) return 0;

  // Batch upsert to eliminate N+1 queries. Ignore conflicts (duplicates).
  const { data, error } = await supabase
    .from("telegram_notifications_queue")
    .upsert(itemsToInsert, { onConflict: "telegram_chat_id,job_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[process-telegram-queue] Batch insert error for jobs:", error.message);
    return 0;
  }

  return data?.length || 0;
}

// Enqueue matching notifications for a new exam update
async function enqueueUpdateNotifications(supabase: any, payload: any) {
  const { update_id, title, category, summary } = payload;

  // Build alert title
  let alertTitle = "";
  if (category === "admit_card") alertTitle = "🎫 <b>NEW ADMIT CARD ALERT</b>";
  else if (category === "result") alertTitle = "🏆 <b>NEW RESULT ALERT</b>";
  else if (category === "answer_key") alertTitle = "🔑 <b>NEW ANSWER KEY ALERT</b>";
  else return 0; // Skip other categories

  const val = `${title || ""} ${summary || ""}`.toLowerCase();
  const updateUrl = `https://www.jobstrackr.in/exam-update/${update_id}`;

  // Fetch all active connections with preferences
  const { data: connections, error: connError } = await supabase
    .from("telegram_connections")
    .select("telegram_chat_id, user_id, notification_preferences!inner(*)")
    .eq("is_active", true);

  if (connError || !connections || connections.length === 0) {
    console.log("[process-telegram-queue] No active connections found or error:", connError?.message);
    return 0;
  }

  const itemsToInsert = [];

  for (const conn of connections) {
    const pref = conn.notification_preferences;

    // Check if user wants this type of alert
    if (category === "admit_card" && !pref?.admit_card_notifications) continue;
    if (category === "result" && !pref?.result_notifications) continue;
    if (category === "answer_key" && !pref?.answer_key_notifications) continue;

    // Category text match
    const catMatch = matchesCategory(val, pref);

    // Location text match in title
    const locMatch = matchesLocation(title || "", pref.preferred_states || []);

    if (!catMatch && !locMatch) continue;

    // Build message
    const msg = [
      alertTitle,
      ``,
      `📋 <b>Title</b>: ${escapeHtml(title || "New Update")}`,
      `📝 <b>Summary</b>: ${escapeHtml(summary || "New update published.")}`,
      ``,
      `🔗 <b><a href="${updateUrl}">View Details on Website</a></b>`,
    ].join("\n");

    itemsToInsert.push({
      user_id: conn.user_id,
      telegram_chat_id: conn.telegram_chat_id,
      update_id: update_id,
      message_text: msg,
    });
  }

  if (itemsToInsert.length === 0) return 0;

  // Batch upsert to eliminate N+1 queries. Ignore conflicts (duplicates).
  const { data, error } = await supabase
    .from("telegram_notifications_queue")
    .upsert(itemsToInsert, { onConflict: "telegram_chat_id,update_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[process-telegram-queue] Batch insert error for updates:", error.message);
    return 0;
  }

  return data?.length || 0;
}

// Send queued pending notifications
async function processQueue(supabase: any): Promise<{ sent: number; failed: number }> {
  // Claim next batch of 50 pending/retrying notifications
  const { data: queueItems, error: claimError } = await supabase.rpc(
    "claim_next_notifications_batch",
    { batch_size: 50 }
  );

  if (claimError) {
    console.error("[process-telegram-queue] Claim batch RPC error:", claimError);
    // Fallback: select pending items directly
    const { data: fallbackItems, error: fallbackError } = await supabase
      .from("telegram_notifications_queue")
      .select("id, user_id, telegram_chat_id, message_text, retry_count")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fallbackError || !fallbackItems || fallbackItems.length === 0) {
      return { sent: 0, failed: 0 };
    }
    return await sendBatch(supabase, fallbackItems);
  }

  if (!queueItems || queueItems.length === 0) {
    console.log("[process-telegram-queue] No pending notifications to process.");
    return { sent: 0, failed: 0 };
  }

  return await sendBatch(supabase, queueItems);
}

async function sendBatch(supabase: any, queueItems: QueueItem[]): Promise<{ sent: number; failed: number }> {
  console.log(`[process-telegram-queue] Processing ${queueItems.length} claimed notifications...`);
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < queueItems.length; i++) {
    const item: QueueItem = queueItems[i];

    try {
      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: item.telegram_chat_id,
          text: item.message_text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      const resData = await response.json();

      if (response.ok && resData.ok) {
        await supabase
          .from("telegram_notifications_queue")
          .update({ status: "sent", processed_at: new Date().toISOString(), error_message: null })
          .eq("id", item.id);
        sentCount++;
      } else {
        const errDesc = resData.description || "Telegram API Send Error";
        console.error(`[process-telegram-queue] Telegram send error for item ${item.id}:`, errDesc);

        let nextRetryCount = item.retry_count + 1;
        let connectionDeactivated = false;

        const isBlocked =
          errDesc.toLowerCase().includes("blocked") ||
          errDesc.toLowerCase().includes("chat not found") ||
          errDesc.toLowerCase().includes("deactivated");

        if (isBlocked) {
          nextRetryCount = 99;
          connectionDeactivated = true;
          await supabase
            .from("telegram_connections")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("telegram_chat_id", item.telegram_chat_id);
        }

        await supabase
          .from("telegram_notifications_queue")
          .update({
            status: "failed",
            retry_count: nextRetryCount,
            error_message: `${errDesc}${connectionDeactivated ? " (Bot blocked/chat unavailable)" : ""}`,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failedCount++;
      }
    } catch (err: any) {
      console.error(`[process-telegram-queue] Network exception for item ${item.id}:`, err);
      await supabase
        .from("telegram_notifications_queue")
        .update({
          status: "failed",
          retry_count: item.retry_count + 1,
          error_message: err.message || "Network request failed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      failedCount++;
    }

    // 50ms delay to stay within Telegram rate limits
    if (queueItems.length > 1 && i < queueItems.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return { sent: sentCount, failed: failedCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Authorization Header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("Security Alert: Missing authorization header on queue processor.");
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = authHeader.replace("Bearer ", "");
  let isAuthorized = false;

  // 1. Check if authorized via service role key (webhook/db trigger)
  if (token === supabaseKey) {
    isAuthorized = true;
  } else {
    // 2. Authenticate user JWT from frontend (Admin panel actions)
    try {
      const supabaseUserClient = createClient(supabaseUrl, supabaseKey);
      const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);
      if (!authError && user) {
        // Query user's admin role using has_any_admin_role RPC
        const { data: isAdmin, error: roleError } = await supabaseUserClient.rpc("has_any_admin_role", {
          _user_id: user.id
        });
        if (!roleError && isAdmin === true) {
          isAuthorized = true;
        }
      }
    } catch (err) {
      console.error("[process-telegram-queue] Auth verification exception:", err);
    }
  }

  if (!isAuthorized) {
    console.error("Security Alert: Unauthorized access attempt to queue processor.");
    return new Response(
      JSON.stringify({ error: "Unauthorized access" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-telegram-queue] Worker started...");

    // Check if this is a trigger-invoked call with job/update payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Phase 1: If payload contains job/update data, enqueue notifications first
    if (body.type === "job" && body.job_id) {
      console.log(`[process-telegram-queue] Enqueuing notifications for job: ${body.title}`);
      const queued = await enqueueJobNotifications(supabase, body);
      console.log(`[process-telegram-queue] Queued ${queued} job notifications`);
    } else if (body.type === "exam_update" && body.update_id) {
      console.log(`[process-telegram-queue] Enqueuing notifications for update: ${body.title}`);
      const queued = await enqueueUpdateNotifications(supabase, body);
      console.log(`[process-telegram-queue] Queued ${queued} update notifications`);
    }

    // Phase 2: Process the queue (send pending messages)
    const { sent, failed } = await processQueue(supabase);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[process-telegram-queue] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
