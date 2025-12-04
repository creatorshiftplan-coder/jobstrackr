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

function parseAgeLimit(ageLimit: string): { min: number; max: number } {
  const match = ageLimit.match(/(\d+)\s*[-–to]\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  return { min: 18, max: 65 };
}

const JOB_DISCOVERY_PROMPT = `You are a government job information extraction assistant for India. Given a search query about a government job, provide structured information about that job.

Return ONLY a valid JSON object with this exact schema (no markdown, no extra text):
{
  "jobs": [
    {
      "exam_name": "Full official title of the job/exam (e.g., SSC CGL 2024)",
      "agency": "Department/Ministry/Commission name (e.g., Staff Selection Commission)",
      "salary_min": number in INR monthly or null,
      "salary_max": number in INR monthly or null,
      "location": "Location or 'All India'",
      "last_date": "YYYY-MM-DD format for application deadline or null",
      "exam_date": "YYYY-MM-DD format for exam date or null",
      "age_limit": "Age range like '18-32 years'",
      "application_fees": {
        "general": number or 0,
        "obc": number or 0,
        "sc_st": number or 0,
        "female": number or 0
      },
      "job_type": "Government",
      "description": "Brief description of the job (max 300 chars)",
      "requirements": "Required qualification (e.g., Graduate, 10+2, B.Tech)",
      "highlights": "Key highlights like vacancies, benefits (max 200 chars)",
      "apply_link": "Official application URL or null",
      "confidence": 0.0 to 1.0 indicating confidence level
    }
  ]
}

Important:
- Be accurate with job titles - use the official name
- For salary, provide monthly salary in INR
- For confidence: 1.0 = very sure about this info, 0.5 = somewhat sure, 0.0 = guessing
- If you find multiple relevant jobs, include all of them (max 3)
- Return ONLY the JSON, no other text`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { query, userId, saveJob, jobData } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle save job request
    if (saveJob && jobData) {
      console.log("Saving job to database:", jobData.exam_name);
      
      const ages = parseAgeLimit(jobData.age_limit || "18-65 years");
      
      const { data: savedJob, error: saveError } = await supabase.from("jobs").insert({
        title: jobData.exam_name,
        department: jobData.agency,
        location: jobData.location || "All India",
        qualification: jobData.requirements || "As per notification",
        experience: "Freshers can apply",
        eligibility: jobData.requirements,
        description: jobData.description || jobData.highlights,
        salary_min: jobData.salary_min,
        salary_max: jobData.salary_max,
        age_min: ages.min,
        age_max: ages.max,
        application_fee: jobData.application_fees?.general || 0,
        vacancies: 1,
        last_date: jobData.last_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        apply_link: jobData.apply_link,
        is_featured: false,
      }).select().single();

      if (saveError) {
        console.error("Save job error:", saveError);
        return new Response(
          JSON.stringify({ error: "Failed to save job", details: saveError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update log to mark job as created
      if (userId) {
        await supabase.from("ai_job_discover_logs")
          .update({ job_created: true })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      return new Response(
        JSON.stringify({ status: "saved", job: savedJob }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search flow
    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Call Gemini API
    console.log("Calling Gemini API for job discovery:", query);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: JOB_DISCOVERY_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: `Search query: "${query}"\n\nProvide current government job information for this search.` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
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
    let jobs: any[] = [];
    let parseOk = false;

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.jobs && Array.isArray(parsed.jobs)) {
          jobs = parsed.jobs;
          parseOk = true;
        } else if (parsed.job) {
          // Handle old format for backward compatibility
          jobs = [parsed.job];
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
        raw_ai_response: { content: aiContent, jobs },
        parse_ok: parseOk,
        latency_ms: latencyMs,
      });
    }

    if (!parseOk || jobs.length === 0) {
      return new Response(
        JSON.stringify({ status: "error", error: "Failed to extract job information", raw: aiContent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates for the first job
    const { data: existingJobs, error: searchError } = await supabase.from("jobs").select("*");

    if (searchError) throw searchError;

    let duplicateStatus = "new";
    let existingJob = null;

    for (const job of existingJobs || []) {
      const similarity = calculateSimilarity(jobs[0].exam_name || jobs[0].title || "", job.title);
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
      JSON.stringify({ status: duplicateStatus, jobs, existingJob, latencyMs }),
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
