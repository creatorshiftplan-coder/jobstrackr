import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadApiKeys, callWithRotation } from "../_shared/apiKeyRotation.ts";
import { notifyGoogleIndexing } from "../_shared/google-indexing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = parseInt(Deno.env.get("AI_ASSIST_DAILY_LIMIT") || "10", 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load API keys from DB with env-var fallback
    const apiKeys = await loadApiKeys(supabase);
    if (apiKeys.length === 0) {
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
    let isAdmin = false;
    try {
      const { data: isAdminData, error: adminError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin"
      });
      if (adminError) {
        console.error("Error checking admin role:", adminError);
      } else {
        isAdmin = isAdminData === true;
      }
    } catch (roleCheckError) {
      console.error("Exception checking admin role:", roleCheckError);
      // Continue as non-admin if check fails
    }

    // Check rate limit only for non-admin users
    let rateLimitInfo: Record<string, unknown> | null = null;
    if (!isAdmin) {
      try {
        const { data: rateLimitData, error: rateLimitError } = await supabase.rpc("check_user_rate_limit", {
          _user_id: user.id,
          _daily_limit: DAILY_LIMIT,
          _minute_limit: 1,
        });

        if (rateLimitError) {
          console.error("Error checking rate limit:", rateLimitError);
          // Continue without rate limiting if check fails
        } else if (rateLimitData) {
          rateLimitInfo = rateLimitData;

          if (!rateLimitData.allowed) {
            const isMinuteLimited = rateLimitData.rate_limited === true;
            const errorMessage = isMinuteLimited
              ? "Please wait a minute before making another AI request."
              : `Daily limit of ${DAILY_LIMIT} AI requests reached. Resets at midnight IST.`;

            const retryAfterSeconds = isMinuteLimited ? 60 : Math.ceil(
              (new Date(rateLimitData.resets_at as string).getTime() - Date.now()) / 1000
            );

            return new Response(
              JSON.stringify({
                data: null,
                error: errorMessage,
                rate_limit: rateLimitData,
                success: false,
              }),
              {
                status: 429,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                  "Retry-After": String(Math.max(retryAfterSeconds, 1)),
                  "X-RateLimit-Limit": String(DAILY_LIMIT),
                  "X-RateLimit-Remaining": String(Math.max(0, DAILY_LIMIT - (rateLimitData.used as number))),
                  "X-RateLimit-Reset": String(Math.floor(new Date(rateLimitData.resets_at as string).getTime() / 1000)),
                },
              }
            );
          }
        }
      } catch (rateLimitCheckError) {
        console.error("Exception checking rate limit:", rateLimitCheckError);
        // Continue without rate limiting if check fails
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

        const { data: attemptData, error: attemptFetchError } = await supabase
          .from("exam_attempts")
          .select("*, exams(*, ai_last_updated_at, ai_cached_response)")
          .eq("id", exam_attempt_id)
          .single();

        if (attemptFetchError) {
          console.error("Error fetching exam attempt:", attemptFetchError);
          return new Response(
            JSON.stringify({ data: null, error: `Database error: ${attemptFetchError.message}`, success: false }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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
  "recommendations": ["suggestions"],
  "confidence_score": 0-100 (your overall confidence in the accuracy of this entire response, based on how recent and reliable the sources are)
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

    // Call AI with key rotation
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const dateAwarePrompt = `Current Date: ${formattedDate}.\n\n${userPrompt}`;

    let aiContent = "";
    try {
      const rotationResult = await callWithRotation(supabase, apiKeys, {
        systemPrompt,
        userPrompt: dateAwarePrompt,
        temperature: 0.3,
        maxTokens: 4096,
        useGoogleSearch,
      });
      aiContent = rotationResult.content;
    } catch (rotationError) {
      // If Google Search was requested and all keys failed, retry once without it.
      // Some key tiers don't support grounding; this surfaces results rather than failing entirely.
      if (useGoogleSearch) {
        console.warn("All keys failed with Google Search enabled, retrying without grounding:", (rotationError as Error).message);
        try {
          const fallbackResult = await callWithRotation(supabase, apiKeys, {
            systemPrompt,
            userPrompt: dateAwarePrompt,
            temperature: 0.3,
            maxTokens: 4096,
            useGoogleSearch: false,
          });
          aiContent = fallbackResult.content;
        } catch (fallbackError) {
          console.error("All keys failed (with and without Google Search):", fallbackError);
          return new Response(
            JSON.stringify({ data: null, error: "AI service temporarily unavailable. Please try again later.", success: false }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
          );
        }
      } else {
        console.error("All keys failed:", rotationError);
        return new Response(
          JSON.stringify({ data: null, error: "AI service temporarily unavailable. Please try again later.", success: false }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
        );
      }
    }

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

    // Normalize the response into the canonical shape (predicted_events +
    // phases.phaseN) so new cache rows never require readers to shape-sniff
    // the legacy variants (phase_1/phase_2, flat exam_dates/last_date_to_apply,
    // event_type aliases). Flat fields are kept for old readers; readers keep
    // their fallbacks for rows cached before this change.
    const normalizeStatusResponse = (res: Record<string, any>): Record<string, any> => {
      // 1) Fold legacy phase_1/phase_2 objects into phases.phaseN (never overwrite)
      const phases = res.phases && typeof res.phases === "object" ? res.phases : {};
      for (const [legacyKey, canonKey] of [["phase_1", "phase1"], ["phase_2", "phase2"]] as const) {
        const legacy = res[legacyKey];
        if (legacy && typeof legacy === "object") {
          phases[canonKey] = { ...legacy, ...(phases[canonKey] ?? {}) };
          delete res[legacyKey];
        }
      }
      if (Object.keys(phases).length > 0) res.phases = phases;

      // 2) Canonicalize predicted_events: alias event types, unify the date
      // field, drop entries with no usable date
      const isDate = (d: unknown): d is string =>
        typeof d === "string" && !!d.trim() && d.trim().toLowerCase() !== "null";
      const aliases: Record<string, string> = { exam: "exam_date", examination: "exam_date" };
      const events = (Array.isArray(res.predicted_events) ? res.predicted_events : [])
        .filter((e: any) => e && typeof e === "object")
        .map((e: any) => {
          const type = String(e.event_type ?? "").toLowerCase();
          return { ...e, event_type: aliases[type] ?? type, predicted_date: e.predicted_date ?? e.date };
        })
        .filter((e: any) => isDate(e.predicted_date));

      // 3) Synthesize events for types the AI expressed only in structured or
      // flat fields, so predicted_events is the complete canonical source
      const hasType = (t: string) => events.some((e: any) => e.event_type === t);
      const addEvent = (event_type: string, date: unknown, phase?: number) => {
        if (!isDate(date)) return;
        events.push(phase ? { event_type, predicted_date: date, phase } : { event_type, predicted_date: date });
      };
      if (!hasType("exam_date")) {
        addEvent("exam_date", phases.phase1?.exam_date, 1);
        addEvent("exam_date", phases.phase2?.exam_date, 2);
        if (!hasType("exam_date")) addEvent("exam_date", res.exam_dates ?? res.exam_date);
      }
      if (!hasType("result")) {
        addEvent("result", phases.phase1?.result_date, 1);
        addEvent("result", phases.phase2?.result_date, 2);
        if (!hasType("result")) addEvent("result", res.expected_result_date);
      }
      if (!hasType("application_close")) addEvent("application_close", res.last_date_to_apply);

      // Assign the cleaned list whenever we have events or the raw key existed —
      // otherwise junk-only input would survive untouched on res
      if (events.length > 0 || Array.isArray(res.predicted_events)) res.predicted_events = events;
      return res;
    };

    if (!("raw_response" in result)) {
      result = normalizeStatusResponse(result as Record<string, any>);
    }

    // Helper function to validate AI response before caching
    const isValidStatusResponse = (res: Record<string, unknown>): boolean => {
      // Must be an object
      if (!res || typeof res !== 'object') return false;

      // Must not be just a raw_response fallback (parse failure)
      if ('raw_response' in res && Object.keys(res).length === 1) return false;

      // Check confidence threshold (skip if < 70)
      const confidence = typeof res.confidence_score === 'number' ? res.confidence_score : 100;
      if (confidence < 70) {
        console.warn(`Skipping cache update: confidence score ${confidence} < 70`);
        return false;
      }

      // Must contain at least one meaningful field
      const hasStatus = 'current_status' in res && res.current_status;
      const hasSummary = 'summary' in res && res.summary;
      const hasPhases = 'phases' in res && res.phases;

      return !!(hasStatus || hasSummary || hasPhases);
    };

    // Cache status_update results (only if valid)
    if (action === "status_update" && exam_attempt_id) {
      if (!isValidStatusResponse(result)) {
        console.warn("Skipping cache update: AI response is empty or invalid", result);
      } else {
        try {
          const { data: attemptData, error: attemptError } = await supabase
            .from("exam_attempts")
            .select("exam_id")
            .eq("id", exam_attempt_id)
            .single();

          if (attemptError) {
            console.error("Error fetching exam attempt for cache:", attemptError);
          } else if (attemptData?.exam_id) {
            const { data: updatedExam, error: updateError } = await supabase
              .from("exams")
              .update({
                ai_cached_response: result,
                ai_last_updated_at: new Date().toISOString(),
                ai_updated_by: "gemini",
              })
              .eq("id", attemptData.exam_id)
              .select("update_slug")
              .single();

            if (updateError) {
              console.error("Error updating exam cache:", updateError);
            } else if (updatedExam?.update_slug) {
              // Fresh content on /updates/:slug — tell Google promptly instead
              // of waiting for the next sitemap crawl. Best-effort, non-blocking.
              notifyGoogleIndexing(`https://jobstrackr.in/updates/${updatedExam.update_slug}`, "URL_UPDATED")
                .catch((e) => console.warn("Indexing notify failed:", e));
            }
          }
        } catch (cacheError) {
          console.error("Error caching AI response:", cacheError);
          // Continue without crashing - caching is non-critical
        }
      }
    }

    // Log the update (non-critical - don't crash if this fails)
    try {
      const { error: logError } = await supabase.from("update_logs").insert({
        user_id: user.id,
        source: "ai_assist",
        action,
        new_data: result,
      });

      if (logError) {
        console.error("Error inserting update log:", logError);
      }
    } catch (logInsertError) {
      console.error("Error logging update:", logInsertError);
      // Continue without crashing - logging is non-critical
    }

    const rateLimitHeaders: Record<string, string> = {};
    if (!isAdmin && rateLimitInfo) {
      const used = (rateLimitInfo.used as number) + 1; // +1 for the current request
      rateLimitHeaders["X-RateLimit-Limit"] = String(DAILY_LIMIT);
      rateLimitHeaders["X-RateLimit-Remaining"] = String(Math.max(0, DAILY_LIMIT - used));
      rateLimitHeaders["X-RateLimit-Reset"] = String(
        Math.floor(new Date(rateLimitInfo.resets_at as string).getTime() / 1000)
      );
    }

    return new Response(
      JSON.stringify({ data: result, error: null, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", ...rateLimitHeaders } }
    );
  } catch (error) {
    console.error("Error in ai-assist function:", error);
    return new Response(
      JSON.stringify({ data: null, error: error instanceof Error ? error.message : "Unknown error", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});