import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getMatchedSectors(job: { title: string; department: string; qualification?: string; description?: string }): string[] {
  const text = `${job.title} ${job.department} ${job.qualification || ""} ${job.description || ""}`.toLowerCase();
  const matched: string[] = [];

  // Always match the general/govt channels
  matched.push("All Jobs");
  matched.push("Government Jobs");
  matched.push("Sarkari Naukri");

  if (text.includes("ssc") || text.includes("staff selection commission")) {
    matched.push("SSC");
  }
  if (text.includes("railway") || text.includes("rrb") || text.includes("ntpc") || text.includes("group d") || text.includes("alp") || text.includes("railway recruitment board") || text.includes("railway recruitment cell") || text.includes("assistant loco pilot") || text.includes("rpf") || text.includes("railway protection force") || text.includes("rrb je") || text.includes("railway apprentice")) {
    matched.push("RRB");
    matched.push("Railway Jobs");
  }
  if (text.includes("bank") || text.includes("ibps") || text.includes("sbi") || text.includes("rbi") || text.includes("nabard") || text.includes("sidbi") || text.includes("ecgc") || text.includes("niacl") || text.includes("uiic") || text.includes("bank of baroda") || text.includes("bank of india") || text.includes("punjab national bank") || text.includes("canara bank") || text.includes("indian bank") || text.includes("central bank of india")) {
    matched.push("Banking Jobs");
    matched.push("Banking");
  }
  if (text.includes("upsc") || text.includes("civil services") || text.includes("ias") || text.includes("ips") || text.includes("nda") || text.includes("cds")) {
    matched.push("UPSC");
  }
  if (text.includes("army") || text.includes("navy") || text.includes("air force") || text.includes("defence") || text.includes("defense") || text.includes("agniveer") || text.includes("police") || text.includes("constable") || text.includes("si ") || text.includes("sub inspector") || text.includes("cisf") || text.includes("crpf") || text.includes("bsf") || text.includes("itbp") || text.includes("ssb") || text.includes("agnipath") || text.includes("afcat") || text.includes("indian army") || text.includes("indian navy") || text.includes("indian air force") || text.includes("coast guard") || text.includes("navik") || text.includes("yantrik") || text.includes("tes") || text.includes("ssc tech") || text.includes("military nursing service") || text.includes("mns") || text.includes("delhi police") || text.includes("kolkata police") || text.includes("west bengal police") || text.includes("up police") || text.includes("bihar police") || text.includes("assam rifles")) {
    matched.push("Defence Jobs");
    matched.push("Police Jobs");
  }
  if (text.includes("psu") || text.includes("ongc") || text.includes("ntpc") || text.includes("bhel") || text.includes("sail") || text.includes("iocl") || text.includes("bpcl") || text.includes("hpcl") || text.includes("powergrid") || text.includes("gail") || text.includes("bel") || text.includes("hal") || text.includes("cil") || text.includes("coal india") || text.includes("npcil") || text.includes("drdo") || text.includes("isro") || text.includes("nlc")) {
    matched.push("PSU Jobs");
  }
  if (text.includes("psc") || text.includes("public service commission") || text.includes("bpsc") || text.includes("uppsc") || text.includes("mpsc") || text.includes("rpsc") || text.includes("wbpsc") || text.includes("opsc") || text.includes("apsc") || text.includes("tspsc") || text.includes("gpsc") || text.includes("kpsc") || text.includes("mppsc") || text.includes("ukpsc") || text.includes("hpsc") || text.includes("jkpsc")) {
    matched.push("PSC");
    matched.push("State PSC");
    matched.push("State Government Jobs");
  }
  if (text.includes("teacher") || text.includes("teaching") || text.includes("tgt") || text.includes("pgt") || text.includes("professor") || text.includes("lecturer") || text.includes("kvs") || text.includes("nvs") || text.includes("ctet") || text.includes("tet") || text.includes("ugc net") || text.includes("kendriya vidyalaya") || text.includes("navodaya vidyalaya") || text.includes("assistant professor") || text.includes("associate professor") || text.includes("prt")) {
    matched.push("Teaching Jobs");
    matched.push("Teaching");
  }
  if (text.includes("supreme court") || text.includes("high court") || text.includes("district court") || text.includes("law clerk") || text.includes("judicial assistant") || text.includes("court master") || text.includes("judiciary")) {
    matched.push("Judiciary");
    matched.push("Supreme Court");
    matched.push("High Court");
    matched.push("District Court");
  }
  if (text.includes("stenographer") || text.includes("steno") || text.includes("personal assistant") || text.includes("pa ") || text.includes("personal secretary") || text.includes("ps ") || text.includes("court stenographer") || text.includes("steno typist") || text.includes("steno-typist") || text.includes("stenographer grade c") || text.includes("stenographer grade d") || text.includes("junior stenographer") || text.includes("senior stenographer") || text.includes("hindi stenographer") || text.includes("english stenographer") || text.includes("pa") || text.includes("ps") || text.includes("stenographer recruitment")) {
    matched.push("Stenographer");
  }

  return matched;
}

function getMatchedSectorsForUpdate(update: { title: string; summary?: string }): string[] {
  const text = `${update.title} ${update.summary || ""}`.toLowerCase();
  const matched: string[] = [];

  matched.push("All Jobs");
  matched.push("Government Jobs");
  matched.push("Sarkari Naukri");

  if (text.includes("ssc") || text.includes("staff selection commission")) {
    matched.push("SSC");
  }
  if (text.includes("railway") || text.includes("rrb") || text.includes("ntpc") || text.includes("group d") || text.includes("alp") || text.includes("railway recruitment board") || text.includes("railway recruitment cell") || text.includes("assistant loco pilot") || text.includes("rpf") || text.includes("railway protection force") || text.includes("rrb je") || text.includes("railway apprentice")) {
    matched.push("RRB");
    matched.push("Railway Jobs");
  }
  if (text.includes("bank") || text.includes("ibps") || text.includes("sbi") || text.includes("rbi") || text.includes("nabard") || text.includes("sidbi") || text.includes("ecgc") || text.includes("niacl") || text.includes("uiic") || text.includes("bank of baroda") || text.includes("bank of india") || text.includes("punjab national bank") || text.includes("canara bank") || text.includes("indian bank") || text.includes("central bank of india")) {
    matched.push("Banking Jobs");
    matched.push("Banking");
  }
  if (text.includes("upsc") || text.includes("civil services") || text.includes("ias") || text.includes("ips") || text.includes("nda") || text.includes("cds")) {
    matched.push("UPSC");
  }
  if (text.includes("army") || text.includes("navy") || text.includes("air force") || text.includes("defence") || text.includes("defense") || text.includes("agniveer") || text.includes("police") || text.includes("constable") || text.includes("si ") || text.includes("sub inspector") || text.includes("cisf") || text.includes("crpf") || text.includes("bsf") || text.includes("itbp") || text.includes("ssb") || text.includes("agnipath") || text.includes("afcat") || text.includes("indian army") || text.includes("indian navy") || text.includes("indian air force") || text.includes("coast guard") || text.includes("navik") || text.includes("yantrik") || text.includes("tes") || text.includes("ssc tech") || text.includes("military nursing service") || text.includes("mns") || text.includes("delhi police") || text.includes("kolkata police") || text.includes("west bengal police") || text.includes("up police") || text.includes("bihar police") || text.includes("assam rifles")) {
    matched.push("Defence Jobs");
    matched.push("Police Jobs");
  }
  if (text.includes("psu") || text.includes("ongc") || text.includes("ntpc") || text.includes("bhel") || text.includes("sail") || text.includes("iocl") || text.includes("bpcl") || text.includes("hpcl") || text.includes("powergrid") || text.includes("gail") || text.includes("bel") || text.includes("hal") || text.includes("cil") || text.includes("coal india") || text.includes("npcil") || text.includes("drdo") || text.includes("isro") || text.includes("nlc")) {
    matched.push("PSU Jobs");
  }
  if (text.includes("psc") || text.includes("public service commission") || text.includes("bpsc") || text.includes("uppsc") || text.includes("mpsc") || text.includes("rpsc") || text.includes("wbpsc") || text.includes("opsc") || text.includes("apsc") || text.includes("tspsc") || text.includes("gpsc") || text.includes("kpsc") || text.includes("mppsc") || text.includes("ukpsc") || text.includes("hpsc") || text.includes("jkpsc")) {
    matched.push("PSC");
    matched.push("State PSC");
    matched.push("State Government Jobs");
  }
  if (text.includes("teacher") || text.includes("teaching") || text.includes("tgt") || text.includes("pgt") || text.includes("professor") || text.includes("lecturer") || text.includes("kvs") || text.includes("nvs") || text.includes("ctet") || text.includes("tet") || text.includes("ugc net") || text.includes("kendriya vidyalaya") || text.includes("navodaya vidyalaya") || text.includes("assistant professor") || text.includes("associate professor") || text.includes("prt")) {
    matched.push("Teaching Jobs");
    matched.push("Teaching");
  }
  if (text.includes("supreme court") || text.includes("high court") || text.includes("district court") || text.includes("law clerk") || text.includes("judicial assistant") || text.includes("court master") || text.includes("judiciary")) {
    matched.push("Judiciary");
    matched.push("Supreme Court");
    matched.push("High Court");
    matched.push("District Court");
  }
  if (text.includes("stenographer") || text.includes("steno") || text.includes("personal assistant") || text.includes("pa ") || text.includes("personal secretary") || text.includes("ps ") || text.includes("court stenographer") || text.includes("steno typist") || text.includes("steno-typist") || text.includes("stenographer grade c") || text.includes("stenographer grade d") || text.includes("junior stenographer") || text.includes("senior stenographer") || text.includes("hindi stenographer") || text.includes("english stenographer") || text.includes("pa") || text.includes("ps") || text.includes("stenographer recruitment")) {
    matched.push("Stenographer");
  }

  return matched;
}

function formatChannelId(id: string): string {
  let cleaned = id.trim();
  if (/^\d+$/.test(cleaned)) {
    return `-100${cleaned}`;
  }
  if (/^-\d+$/.test(cleaned) && !cleaned.startsWith("-100")) {
    return `-100${cleaned.substring(1)}`;
  }
  if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(cleaned)) {
    return `@${cleaned}`;
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    let isAuthorized = false;

    // 1. Check if authorized via service role key (webhook/db trigger)
    if (token === supabaseKey) {
      isAuthorized = true;
    } else {
      // 2. Authenticate user JWT from frontend
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        // Query user's admin role usinghas_any_admin_role RPC
        const { data: isAdmin, error: roleError } = await supabase.rpc("has_any_admin_role", {
          _user_id: user.id
        });
        if (!roleError && isAdmin === true) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bodyData = await req.json();
    const { job, exam_update, message, channelId } = bodyData;

    // A. MANUAL MESSAGE DISPATCH (FRONTEND PROXY)
    if (message && channelId) {
      console.log(`Manual post request received for channel: ${channelId}`);
      
      const { data: channel, error: channelError } = await supabase
        .from("telegram_channels")
        .select("*")
        .eq("id", channelId)
        .single();

      if (channelError || !channel) {
        return new Response(
          JSON.stringify({ error: channelError?.message || "Telegram channel not found in database" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedChannelId = formatChannelId(channel.channel_id);
      console.log(`Sending manual message to Telegram chat: "${formattedChannelId}" using bot token length: ${channel.bot_token?.length || 0}`);

      const response = await fetch(`https://api.telegram.org/bot${channel.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: formattedChannelId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          link_preview_options: { is_disabled: true }
        })
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.error("Telegram manual post error:", data.description);
        return new Response(
          JSON.stringify({ error: data.description || "Unknown Telegram API error" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // B. AUTOMATIC EXAM UPDATE POST (DB INSERT TRIGGER)
    if (exam_update) {
      console.log(`Processing auto-post for exam update: ${exam_update.id} - ${exam_update.title}`);
      
      const matchedSectors = getMatchedSectorsForUpdate(exam_update);
      console.log(`Matched sectors for update:`, matchedSectors);

      const { data: channels, error: fetchError } = await supabase
        .from("telegram_channels")
        .select("*");

      if (fetchError) throw fetchError;

      if (!channels || channels.length === 0) {
        console.log("No configured Telegram channels found. Skipping posts.");
        return new Response(
          JSON.stringify({ success: true, message: "No channels configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const channelsToPost = channels.filter((channel: any) => {
        return matchedSectors.some(sector => sector.toLowerCase() === channel.sector.toLowerCase());
      });

      if (channelsToPost.length === 0) {
        console.log(`No Telegram channels matched the sectors: ${matchedSectors.join(", ")}`);
        return new Response(
          JSON.stringify({ success: true, message: "No matching channels for sectors" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sending update to ${channelsToPost.length} channel(s)...`);

      const updateLink = `https://jobstrackr.in/exam-update/${exam_update.id}`;
      const categoryLower = exam_update.category.toLowerCase();
      const titleLower = exam_update.title.toLowerCase();

      let tagCategory = "#ExamUpdate";
      let templateType: "admit_card" | "result" | "answer_key" | "recruitment" = "recruitment";

      if (categoryLower.includes("admit") || titleLower.includes("admit") || categoryLower.includes("city") || titleLower.includes("city") || categoryLower.includes("hall") || categoryLower.includes("call") || categoryLower.includes("syllabus")) {
        templateType = "admit_card";
        tagCategory = "#AdmitCard";
      } else if (categoryLower.includes("result") || titleLower.includes("result") || categoryLower.includes("cutoff") || titleLower.includes("cutoff") || categoryLower.includes("scorecard") || categoryLower.includes("merit")) {
        templateType = "result";
        tagCategory = "#Result";
      } else if (categoryLower.includes("answer") || titleLower.includes("answer") || categoryLower.includes("key") || titleLower.includes("key") || categoryLower.includes("sheet")) {
        templateType = "answer_key";
        tagCategory = "#AnswerKey";
      }

      const hashtags = [tagCategory];
      if (templateType === "result" || templateType === "recruitment") {
        hashtags.push("#GovernmentJobs");
      } else {
        hashtags.push("#ExamUpdate");
      }

      if (titleLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence")) hashtags.unshift("#Defence");
      const hashtagsStr = hashtags.join(" ");

      let messageText = "";
      if (templateType === "admit_card") {
        const statusText = exam_update.status || (titleLower.includes("city") ? "Exam City Slip Released" : "Admit Card Released");
        const examDate = (() => {
          if (exam_update.important_dates && Array.isArray(exam_update.important_dates)) {
            const match = exam_update.important_dates.find((d: any) => 
              /exam|test|written|cbt|date/i.test(d.event) && !/admit|result|apply|registration/i.test(d.event)
            );
            if (match) return match.date;
          }
          return "Check Details";
        })();

        messageText = `
<b>🔔 IMPORTANT UPDATE</b>

<b>📌 ${escapeHtml(exam_update.title)}</b>

📍 ${escapeHtml(statusText)}
📅 Exam Date: ${escapeHtml(examDate)}

✅ Download Now

🔗 <b><a href="${updateLink}">View Details on Website</a></b>

${hashtagsStr}
        `.trim();
      } else if (templateType === "result") {
        messageText = `
<b>🔔 IMPORTANT UPDATE</b>

<b>📌 ${escapeHtml(exam_update.title)}</b>

📢 Result Released Successfully

✅ Check Your Result

🔗 <b><a href="${updateLink}">View Result on Website</a></b>

${hashtagsStr}
        `.trim();
      } else if (templateType === "answer_key") {
        messageText = `
<b>🔔 IMPORTANT UPDATE</b>

<b>📌 ${escapeHtml(exam_update.title)}</b>

📢 Official Answer Key Available

✅ Check Response Sheet & Answer Key

🔗 <b><a href="${updateLink}">View Details on Website</a></b>

${hashtagsStr}
        `.trim();
      } else {
        const orgText = (() => {
          if (titleLower.includes("ssc")) return "SSC";
          if (titleLower.includes("upsc")) return "UPSC";
          if (titleLower.includes("rrb") || titleLower.includes("railway")) return "RRB / Railways";
          if (titleLower.includes("sbi")) return "SBI";
          if (titleLower.includes("ibps")) return "IBPS";
          const match = exam_update.title.match(/^(.*?)\s+(recruitment|exam|vacancy|admit|result)/i);
          if (match && match[1]) return match[1].trim();
          return "Government Agency";
        })();

        messageText = `
<b>🔔 IMPORTANT UPDATE</b>

<b>📌 ${escapeHtml(exam_update.title)}</b>

🏢 Organization: ${escapeHtml(orgText)}
📢 Notification Details Available

✅ View Notification & Apply

🔗 <b><a href="${updateLink}">View Details on Website</a></b>

${hashtagsStr}
        `.trim();
      }

      let successCount = 0;

      for (const channel of channelsToPost) {
        const formattedChannelId = formatChannelId(channel.channel_id);
        console.log(`Posting update to channel: ${channel.name} (${formattedChannelId})`);

        try {
          const { data: existing, error: checkError } = await supabase
            .from("telegram_sent_jobs")
            .select("id")
            .eq("update_id", exam_update.id)
            .eq("channel_id", channel.id)
            .eq("status", "success")
            .maybeSingle();

          if (existing) {
            console.log(`Update ${exam_update.id} was already posted successfully to channel: ${channel.name}. Skipping duplicate.`);
            successCount++;
            continue;
          }

          const response = await fetch(`https://api.telegram.org/bot${channel.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: formattedChannelId,
              text: messageText,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              link_preview_options: { is_disabled: true }
            })
          });

          const data = await response.json();
          if (response.ok && data.ok) {
            successCount++;
            console.log(`Successfully posted update to channel: ${channel.name}`);

            await supabase.from("telegram_sent_jobs").insert({
              update_id: exam_update.id,
              channel_id: channel.id,
              status: "success"
            });
          } else {
            console.error(`Failed to post update to channel ${channel.name}:`, data.description);

            await supabase.from("telegram_sent_jobs").insert({
              update_id: exam_update.id,
              channel_id: channel.id,
              status: "failed",
              error_message: data.description || "Unknown Telegram API error"
            });
          }
        } catch (err: any) {
          console.error(`Fetch error posting update to channel ${channel.name}:`, err);

          await supabase.from("telegram_sent_jobs").insert({
            update_id: exam_update.id,
            channel_id: channel.id,
            status: "failed",
            error_message: err.message || "Network/Fetch error"
          });
        }

        if (channelsToPost.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return new Response(
        JSON.stringify({ success: true, postedCount: successCount, totalCount: channelsToPost.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // C. AUTOMATIC JOB POST (DB INSERT TRIGGER)
    if (job) {
      console.log(`Processing auto-post for job: ${job.id} - ${job.title}`);

      // Get matching sectors for the job
      const matchedSectors = getMatchedSectors(job);
      console.log(`Matched sectors:`, matchedSectors);

      // Retrieve all active Telegram channels from database
      const { data: channels, error: fetchError } = await supabase
        .from("telegram_channels")
        .select("*");

      if (fetchError) throw fetchError;

      if (!channels || channels.length === 0) {
        console.log("No configured Telegram channels found. Skipping posts.");
        return new Response(
          JSON.stringify({ success: true, message: "No channels configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter channels that match the job's sectors
      const channelsToPost = channels.filter((channel: any) => {
        return matchedSectors.some(sector => sector.toLowerCase() === channel.sector.toLowerCase());
      });

      if (channelsToPost.length === 0) {
        console.log(`No Telegram channels matched the sectors: ${matchedSectors.join(", ")}`);
        return new Response(
          JSON.stringify({ success: true, message: "No matching channels for sectors" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sending to ${channelsToPost.length} channel(s)...`);

      // Prepare message text
      const jobLink = `https://jobstrackr.in/jobs/${job.slug || job.id}`;
      
      // Dynamic hashtags
      const hashtags = ["#GovernmentJobs", "#SarkariNaukri"];
      const titleLower = job.title.toLowerCase();
      const deptLower = job.department.toLowerCase();
      if (titleLower.includes("ssc") || deptLower.includes("ssc")) hashtags.unshift("#SSC");
      else if (titleLower.includes("upsc") || deptLower.includes("upsc")) hashtags.unshift("#UPSC");
      else if (titleLower.includes("rrb") || titleLower.includes("railway") || deptLower.includes("railway")) hashtags.unshift("#Railway");
      else if (titleLower.includes("bank") || deptLower.includes("bank") || titleLower.includes("sbi") || titleLower.includes("ibps")) hashtags.unshift("#Banking");
      else if (titleLower.includes("police") || deptLower.includes("police")) hashtags.unshift("#Police");
      else if (titleLower.includes("defence") || titleLower.includes("army") || titleLower.includes("navy") || titleLower.includes("air force")) hashtags.unshift("#Defence");
      else if (titleLower.includes("teacher") || titleLower.includes("teaching")) hashtags.unshift("#TeachingJobs");
      else if (titleLower.includes("court") || titleLower.includes("judic")) hashtags.unshift("#Judiciary");
      else if (titleLower.includes("steno")) hashtags.unshift("#Stenographer");
      const hashtagsStr = hashtags.join(" ");

      const vacancies = job.vacancies_display || job.vacancies || "TBD";
      const lastDate = job.last_date_display || job.last_date || "Check Details";

      const messageText = `
<b>🚨 NEW RECRUITMENT ALERT</b>

<b>📌 ${escapeHtml(job.title)}</b>

🏢 Organization: ${escapeHtml(job.department)}
👥 Vacancies: ${escapeHtml(vacancies)}
📅 Last Date: ${escapeHtml(lastDate)}

✅ Apply Online

🔗 <b><a href="${jobLink}">View Full Notification on Website</a></b>

${hashtagsStr}
      `.trim();

      let successCount = 0;

      for (const channel of channelsToPost) {
        const formattedChannelId = formatChannelId(channel.channel_id);
        console.log(`Posting to channel: ${channel.name} (${formattedChannelId})`);
        
        try {
          // Check for duplicate posting
          const { data: existing, error: checkError } = await supabase
            .from("telegram_sent_jobs")
            .select("id")
            .eq("job_id", job.id)
            .eq("channel_id", channel.id)
            .eq("status", "success")
            .maybeSingle();

          if (existing) {
            console.log(`Job ${job.id} was already posted successfully to channel: ${channel.name}. Skipping to prevent duplicate.`);
            successCount++; // Count as success since it's already there
            continue;
          }

          const response = await fetch(`https://api.telegram.org/bot${channel.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: formattedChannelId,
              text: messageText,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              link_preview_options: { is_disabled: true }
            })
          });

          const data = await response.json();
          if (response.ok && data.ok) {
            successCount++;
            console.log(`Successfully posted to channel: ${channel.name}`);
            
            // Log success
            await supabase.from("telegram_sent_jobs").insert({
              job_id: job.id,
              channel_id: channel.id,
              status: "success"
            });
          } else {
            console.error(`Failed to post to channel ${channel.name}:`, data.description);
            
            // Log failure
            await supabase.from("telegram_sent_jobs").insert({
              job_id: job.id,
              channel_id: channel.id,
              status: "failed",
              error_message: data.description || "Unknown Telegram API error"
            });
          }
        } catch (err: any) {
          console.error(`Fetch error posting to channel ${channel.name}:`, err);
          
          // Log fetch exception
          await supabase.from("telegram_sent_jobs").insert({
            job_id: job.id,
            channel_id: channel.id,
            status: "failed",
            error_message: err.message || "Network/Fetch error"
          });
        }

        // Add a 1000ms delay between posts to prevent Telegram rate limits
        if (channelsToPost.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return new Response(
        JSON.stringify({ success: true, postedCount: successCount, totalCount: channelsToPost.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "No job or exam_update data provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in telegram-auto-post edge function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
