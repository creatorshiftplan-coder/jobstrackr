import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (text.includes("railway") || text.includes("rrb") || text.includes("ntpc") || text.includes("group d") || text.includes("alp")) {
    matched.push("RRB");
    matched.push("Railway Jobs");
  }
  if (text.includes("bank") || text.includes("ibps") || text.includes("sbi") || text.includes("rbi") || text.includes("nabard")) {
    matched.push("Banking Jobs");
    matched.push("Banking");
  }
  if (text.includes("upsc") || text.includes("civil services") || text.includes("ias") || text.includes("ips") || text.includes("nda") || text.includes("cds")) {
    matched.push("UPSC");
  }
  if (text.includes("army") || text.includes("navy") || text.includes("air force") || text.includes("defence") || text.includes("defense") || text.includes("agniveer") || text.includes("police") || text.includes("constable") || text.includes("si ") || text.includes("sub inspector") || text.includes("cisf") || text.includes("crpf") || text.includes("bsf") || text.includes("itbp") || text.includes("ssb")) {
    matched.push("Defence Jobs");
    matched.push("Police Jobs");
  }
  if (text.includes("psu") || text.includes("ongc") || text.includes("ntpc") || text.includes("bhel") || text.includes("sail") || text.includes("iocl") || text.includes("bpcl") || text.includes("hpcl") || text.includes("powergrid")) {
    matched.push("PSU Jobs");
  }
  if (text.includes("psc") || text.includes("public service commission") || text.includes("bpsc") || text.includes("uppsc") || text.includes("mpsc") || text.includes("rpsc") || text.includes("wbpsc") || text.includes("opsc") || text.includes("apsc") || text.includes("tspsc")) {
    matched.push("PSC");
    matched.push("State Government Jobs");
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
    const { job, message, channelId } = bodyData;

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
          parse_mode: "Markdown",
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

    // B. AUTOMATIC JOB POST (DB INSERT TRIGGER)
    if (!job) {
      return new Response(
        JSON.stringify({ error: "No job data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const hashtagsStr = hashtags.join(" ");

    const vacancies = job.vacancies_display || job.vacancies || "TBD";
    const lastDate = job.last_date_display || job.last_date || "Check Details";

    const messageText = `
*🚨 NEW RECRUITMENT ALERT*

*📌 ${job.title}*

🏢 Organization: ${job.department}
👥 Vacancies: ${vacancies}
📅 Last Date: ${lastDate}

✅ Apply Online

🔗 View Full Notification:
${jobLink}

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
            parse_mode: "Markdown",
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
  } catch (err: any) {
    console.error("Error in telegram-auto-post edge function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
