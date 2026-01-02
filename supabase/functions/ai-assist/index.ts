import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Support multiple API keys for rotation
    const geminiApiKeys = [
      Deno.env.get("GEMINI_API_KEY"),
      Deno.env.get("GEMINI_API_KEY_2"),
      Deno.env.get("GEMINI_API_KEY_3"),
      Deno.env.get("GEMINI_API_KEY_4"),
      Deno.env.get("GEMINI_API_KEY_5"),
      Deno.env.get("GEMINI_API_KEY_6"),
      Deno.env.get("GEMINI_API_KEY_7"),
    ].filter(Boolean) as string[];

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (geminiApiKeys.length === 0) {
      return new Response(
        JSON.stringify({ data: null, error: "AI service not configured", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ data: null, error: "Authorization required", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create a client with the user's token to validate authentication
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ data: null, error: "Invalid or expired session. Please log in again.", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin (admins bypass rate limit)
    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });
    const isAdmin = isAdminData === true;

    // Check rate limit only for non-admin users
    if (!isAdmin) {
      const { data: rateLimitData } = await supabase.rpc("check_user_rate_limit", {
        _user_id: user.id,
        _daily_limit: DAILY_LIMIT,
        _minute_limit: 1,
      });

      if (rateLimitData && !rateLimitData.allowed) {
        const errorMessage = rateLimitData.rate_limited
          ? "Please wait a minute before making another AI request."
          : `Daily limit of ${DAILY_LIMIT} AI requests reached. Resets at 11:59 PM IST.`;

        return new Response(
          JSON.stringify({
            data: null,
            error: errorMessage,
            rate_limit: rateLimitData,
            success: false,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ data: null, error: "Method not allowed", success: false }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, exam_attempt_id, context, force_refresh } = body;

    console.log(`AI assist request: ${action} for user ${user.id}`);

    let systemPrompt: string;
    let userPrompt: string;
    let useGoogleSearch = false;

    switch (action) {
      case "form_tips": {
        const { exam_name, form_fields, profile_data } = context || {};

        systemPrompt = `You are an expert assistant helping users fill government exam application forms in India. 
Provide practical, specific tips for each form field. Focus on common mistakes, format requirements, and important guidelines.
Always respond in JSON format.`;

        userPrompt = `Generate helpful tips for filling the ${exam_name || "government exam"} application form.
Form fields: ${JSON.stringify(form_fields || [])}
User's current profile data: ${JSON.stringify(profile_data || {})}

Return ONLY a JSON object:
{
  "field_tips": [{ "field_name": "string", "tip": "string", "importance": "high|medium|low" }],
  "general_tips": ["string"],
  "warnings": ["string"]
}`;
        break;
      }

      case "status_update": {
        if (!exam_attempt_id) {
          return new Response(
            JSON.stringify({ data: null, error: "Exam attempt ID required", success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        useGoogleSearch = true;

        const { data: attemptData } = await supabase
          .from("exam_attempts")
          .select("*, exams(*, ai_last_updated_at, ai_cached_response)")
          .eq("id", exam_attempt_id)
          .single();

        if (!attemptData) {
          return new Response(
            JSON.stringify({ data: null, error: "Exam attempt not found", success: false }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const examData = attemptData.exams;
        const examName = examData?.name || "Unknown Exam";
        const examYear = attemptData.year || new Date().getFullYear();
        const conductingBody = examData?.conducting_body || "";
        const officialWebsite = examData?.official_website || "";

        // Check cache (24 hours TTL)
        if (!force_refresh && examData?.ai_last_updated_at && examData?.ai_cached_response) {
          const hoursSinceUpdate = (Date.now() - new Date(examData.ai_last_updated_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate < 24) {
            return new Response(
              JSON.stringify({
                data: { ...examData.ai_cached_response, from_cache: true, cache_age_hours: Math.round(hoursSinceUpdate * 10) / 10 },
                error: null,
                success: true,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        systemPrompt = `You are an AI assistant that searches for government exam information from official websites and job aggregator sites.
IMPORTANT: Use Google Search to find CURRENT information. Return ONLY valid JSON.
Many government exams have multiple phases/stages (e.g., Prelims + Mains, Tier 1 + Tier 2). Search for information about ALL phases.`;

        userPrompt = `Search for the latest information about:
- Exam Name: ${examName}
- Year: ${examYear}
- Conducting Body: ${conductingBody || "Not specified"}
- Official Website: ${officialWebsite || "Not specified"}

IMPORTANT: Many exams have multiple phases (Prelims/Tier-1 and Mains/Tier-2). Search for BOTH phases.

Return ONLY this JSON format:
{
  "summary": "Brief overall status summary",
  "current_status": "not_yet_notified|registration_open|registration_closed|admit_card_available|exam_scheduled|exam_completed|result_declared",
  "phases": {
    "phase1": {
      "name": "Prelims/Tier-1/CBT/Stage-1 (use official name)",
      "status": "not_applicable|not_notified|registration_open|admit_card_available|exam_scheduled|exam_completed|result_declared",
      "admit_card_available": true/false (MUST be false if admit card is only announced/expected. Only set true if candidates can download it NOW),
      "admit_card_link": "URL or null",
      "exam_date": "YYYY-MM-DD or null",
      "exam_details": "Exam timing, centers info",
      "result_available": true/false,
      "result_link": "URL or null",
      "result_date": "YYYY-MM-DD or null"
    },
    "phase2": {
      "name": "Mains/Tier-2/Stage-2 (use official name, or null if single-phase exam)",
      "status": "not_applicable|not_notified|registration_open|admit_card_available|exam_scheduled|exam_completed|result_declared",
      "admit_card_available": true/false,
      "admit_card_link": "URL or null",
      "exam_date": "YYYY-MM-DD or null",
      "exam_details": "Exam timing, centers info",
      "result_available": true/false,
      "result_link": "URL or null",
      "result_date": "YYYY-MM-DD or null"
    }
  },
  "admit_card_available": true/false,
  "admit_card_link": "URL or null",
  "result_available": true/false,
  "result_link": "URL or null",
  "predicted_events": [
    { "event_type": "application_open|application_close|admit_card|exam_date|result", "phase": 1/2, "predicted_date": "YYYY-MM-DD or null", "confidence": "high|medium|low", "notes": "details" }
  ],
  "latest_updates": ["list of recent news"],
  "recommendations": ["suggestions"]
}`;
        break;
      }

      case "extract_info": {
        const { ocr_text, document_type } = context || {};

        systemPrompt = `You are an expert at extracting structured information from OCR text of Indian identity documents.`;

        userPrompt = `Extract structured information from this ${document_type || "document"} OCR text:
${ocr_text}

Return ONLY a JSON object with fields like: full_name, date_of_birth, gender, father_name, address, document_number.`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ data: null, error: `Unknown action: ${action}`, success: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Call Gemini API with optional Google Search grounding - with key rotation
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const dateAwarePrompt = `Current Date: ${formattedDate}.\n\n${userPrompt}`;

    const requestBody: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: dateAwarePrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    };

    if (useGoogleSearch) {
      requestBody.tools = [{ google_search: {} }];
    }

    let geminiResponse: Response | null = null;
    let lastError = "";

    for (let i = 0; i < geminiApiKeys.length; i++) {
      const apiKey = geminiApiKeys[i];
      console.log(`Trying API key ${i + 1} of ${geminiApiKeys.length}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        geminiResponse = response;
        console.log(`API key ${i + 1} succeeded`);
        break;
      }

      if (response.status === 429) {
        console.log(`API key ${i + 1} rate limited, trying next...`);
        lastError = "All API keys rate limited";
        continue;
      }

      if (response.status >= 500) {
        console.log(`API key ${i + 1} server error ${response.status}, trying next...`);
        lastError = `Server error: ${response.status}`;
        continue;
      }

      // Client error - stop trying
      const errorText = await response.text();
      console.error(`API key ${i + 1} error:`, response.status, errorText);
      lastError = `AI API error: ${response.status}`;
      break;
    }

    if (!geminiResponse) {
      return new Response(
        JSON.stringify({ data: null, error: lastError || "AI service temporarily unavailable", success: false }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI raw response:", aiContent);

    // Parse JSON
    let result: Record<string, unknown> = {};
    try {
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      result = JSON.parse(jsonStr.trim());

      // Validate and normalize boolean fields in AI response
      if (result && typeof result === 'object') {
        const res = result as Record<string, any>;
        // Normalize admit_card_available to strict boolean
        if ('admit_card_available' in res) {
          res.admit_card_available = res.admit_card_available === true;
        }
        // Normalize phases
        if (res.phases?.phase1?.admit_card_available !== undefined) {
          res.phases.phase1.admit_card_available =
            res.phases.phase1.admit_card_available === true;
        }
        if (res.phases?.phase2?.admit_card_available !== undefined) {
          res.phases.phase2.admit_card_available =
            res.phases.phase2.admit_card_available === true;
        }
        // Same for result_available
        if ('result_available' in res) {
          res.result_available = res.result_available === true;
        }

        // Ensure future dates don't have "available" flags set to true
        // This is a defensive check against AI hallucinations
        const today = new Date();
        if (res.phases?.phase1?.admit_card_available === true && res.phases?.phase1?.exam_date) {
          // If exam is more than 30 days away, admit card is unlikely to be available
          // This is a heuristic, but helps prevent obvious errors
          try {
            const examDate = new Date(res.phases.phase1.exam_date);
            const diffTime = examDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 30) {
              console.log("Defensive check: Unsetting admit_card_available because exam is > 30 days away");
              res.phases.phase1.admit_card_available = false;
              if ('admit_card_available' in res) res.admit_card_available = false;
            }
          } catch (e) {
            // Ignore date parsing errors
          }
        }
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = { raw_response: aiContent };
    }

    // Cache status_update results
    if (action === "status_update" && exam_attempt_id) {
      const { data: attemptData } = await supabase
        .from("exam_attempts")
        .select("exam_id")
        .eq("id", exam_attempt_id)
        .single();

      if (attemptData?.exam_id) {
        await supabase
          .from("exams")
          .update({
            ai_cached_response: result,
            ai_last_updated_at: new Date().toISOString(),
            ai_updated_by: "gemini",
          })
          .eq("id", attemptData.exam_id);
      }
    }

    // Log the update
    await supabase.from("update_logs").insert({
      user_id: user.id,
      source: "ai_assist",
      action,
      new_data: result,
    });

    return new Response(
      JSON.stringify({ data: result, error: null, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-assist function:", error);
    return new Response(
      JSON.stringify({ data: null, error: error instanceof Error ? error.message : "Unknown error", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});