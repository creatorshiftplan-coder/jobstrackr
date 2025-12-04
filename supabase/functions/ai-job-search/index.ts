import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 20;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1.0;
  const words1 = new Set(s1.split(" "));
  const words2 = new Set(s2.split(" "));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

const JOB_DISCOVERY_PROMPT = `You are a government job information extraction assistant for India. Given a search query about a government job, provide structured information about that job.

Return ONLY a valid JSON object with this exact schema (no markdown, no extra text):
{
  "job": {
    "title": "Full official title of the job/post",
    "department": "Department or ministry name",
    "location": "Location (city/state) or 'All India'",
    "qualification": "Required qualification (e.g., 10th Pass, Graduate, B.Tech)",
    "experience": "Experience required or 'Freshers can apply'",
    "eligibility": "Brief eligibility criteria",
    "description": "Brief description of the job (max 500 chars)",
    "salary_min": number or null,
    "salary_max": number or null,
    "age_min": number or 18,
    "age_max": number or 65,
    "application_fee": number or 0,
    "vacancies": number or 1,
    "last_date": "YYYY-MM-DD format for application deadline",
    "apply_link": "Official application URL or null",
    "confidence": 0.0 to 1.0 indicating confidence level
  }
}

Important:
- Be accurate with job titles - use the official name
- For salary, provide monthly salary in INR
- For confidence: 1.0 = very sure, 0.5 = somewhat sure, 0.0 = guessing
- Return ONLY the JSON, no other text`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { query, userId } = await req.json();

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit if userId is provided
    if (userId) {
      const { data: rateLimitData, error: rateLimitError } = await supabase.rpc(
        "check_user_rate_limit",
        { _user_id: userId, _daily_limit: DAILY_LIMIT }
      );

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      } else if (rateLimitData && !rateLimitData.allowed) {
        return new Response(
          JSON.stringify({
            error: `Daily limit of ${DAILY_LIMIT} API calls reached. Please try again tomorrow.`,
            rate_limit: rateLimitData,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Call Gemini API directly
    console.log("Calling Gemini API for job discovery:", query);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: JOB_DISCOVERY_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: `Search query: "${query}"\n\nProvide information about this government job.` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      throw new Error(`AI API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI raw response:", aiContent);

    // Parse JSON from response
    let jobData: any = null;
    let parseOk = false;

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.job) {
          jobData = parsed.job;
          parseOk = true;
        }
      } catch (e) {
        console.error("JSON parse error:", e);
      }
    }

    const latencyMs = Date.now() - startTime;

    // Log the discovery attempt
    if (userId) {
      await supabase.from("ai_job_discover_logs").insert({
        user_id: userId,
        query,
        raw_ai_response: { content: aiContent },
        parse_ok: parseOk,
        latency_ms: latencyMs,
      });
    }

    if (!parseOk || !jobData) {
      return new Response(
        JSON.stringify({ status: "error", error: "Failed to extract job information", raw: aiContent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates in existing jobs
    const { data: existingJobs, error: searchError } = await supabase.from("jobs").select("*");

    if (searchError) throw searchError;

    let duplicateStatus = "new";
    let existingJob = null;

    for (const job of existingJobs || []) {
      const similarity = calculateSimilarity(jobData.title, job.title);
      if (similarity > 0.8) {
        duplicateStatus = "exists";
        existingJob = job;
        break;
      } else if (similarity > 0.6) {
        duplicateStatus = "similar";
        existingJob = job;
      }
    }

    return new Response(
      JSON.stringify({ status: duplicateStatus, job: jobData, existingJob, latencyMs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Job discovery error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Discovery failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
