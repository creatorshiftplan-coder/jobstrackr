import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 7;

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

const JOB_DISCOVERY_PROMPT = `You are a government job information extraction assistant for India with access to Google Search.

IMPORTANT: Use Google Search to find the LATEST and most ACCURATE information about Indian government jobs.

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

CRITICAL RULES:
- ALWAYS return at least 1-3 relevant government job postings from your search
- If exact match not found, return similar/related government jobs
- Use Google Search to find current, real job notifications
- Be accurate with job titles - use the official name
- For salary, provide monthly salary in INR
- For confidence: 1.0 = verified from official source, 0.7 = from reliable news, 0.5 = estimated
- Return ONLY the JSON, no other text
- If unsure, still provide best effort results with appropriate confidence scores`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { query, userId, saveJob, jobData, createExam, examData, year } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle create exam request (for AI-discovered exams - bypasses RLS using service role)
    if (createExam && examData) {
      console.log("Creating exam server-side:", examData.name);

      // Get user ID from auth header
      const authHeader = req.headers.get("Authorization");
      let authenticatedUserId = userId;

      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          authenticatedUserId = user.id;
        }
      }

      if (!authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if exam already exists
      const { data: existingExam } = await supabase
        .from("exams")
        .select("id")
        .ilike("name", examData.name)
        .limit(1)
        .single();

      let examId: string;

      if (existingExam) {
        console.log("Exam already exists, using existing ID:", existingExam.id);
        examId = existingExam.id;
      } else {
        // Create the exam using service role (bypasses RLS)
        const { data: newExam, error: examError } = await supabase
          .from("exams")
          .insert({
            name: examData.name,
            conducting_body: examData.conducting_body || null,
            category: examData.category || "Government",
            description: examData.description || null,
            official_website: examData.official_website || null,
            is_active: true,
          })
          .select()
          .single();

        if (examError) {
          console.error("Create exam error:", examError);
          return new Response(
            JSON.stringify({ error: "Failed to create exam", details: examError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Created new exam:", newExam.id);
        examId = newExam.id;
      }

      // Add exam attempt for the user
      const attemptYear = year || new Date().getFullYear();

      // Check if user already has this exam in tracker
      const { data: existingAttempt } = await supabase
        .from("exam_attempts")
        .select("id")
        .eq("user_id", authenticatedUserId)
        .eq("exam_id", examId)
        .eq("year", attemptYear)
        .limit(1)
        .single();

      if (existingAttempt) {
        return new Response(
          JSON.stringify({ status: "exists", message: "Exam already in your tracker", examId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: attempt, error: attemptError } = await supabase
        .from("exam_attempts")
        .insert({
          user_id: authenticatedUserId,
          exam_id: examId,
          year: attemptYear,
          status: "tracking",
        })
        .select()
        .single();

      if (attemptError) {
        console.error("Create attempt error:", attemptError);
        return new Response(
          JSON.stringify({ error: "Failed to add exam to tracker", details: attemptError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Added exam attempt:", attempt.id);

      return new Response(
        JSON.stringify({ status: "created", examId, attemptId: attempt.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

      // Fix: Update log to mark job as created - first get the latest log ID
      if (userId) {
        const { data: latestLog } = await supabase
          .from("ai_job_discover_logs")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestLog) {
          await supabase
            .from("ai_job_discover_logs")
            .update({ job_created: true })
            .eq("id", latestLog.id);
        }
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
        { _user_id: userId, _daily_limit: DAILY_LIMIT, _minute_limit: 1 }
      );

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      } else if (rateLimitData && !rateLimitData.allowed) {
        const errorMessage = rateLimitData.rate_limited
          ? "Please wait a minute before making another AI request."
          : `Daily limit of ${DAILY_LIMIT} AI requests reached. Resets at 11:59 PM IST.`;

        return new Response(
          JSON.stringify({
            error: errorMessage,
            rate_limit: rateLimitData,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Call Gemini API with Google Search grounding
    console.log("Calling Gemini API with Google Search grounding for:", query);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: JOB_DISCOVERY_PROMPT }] },
          contents: [{
            role: "user",
            parts: [{
              text: `Search for current Indian government jobs matching: "${query}"

Please use Google Search to find:
1. Official notifications from government websites
2. Current application dates and deadlines
3. Eligibility criteria and fees
4. Any recent news about this exam/job

Return structured JSON with the job details.`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096
          },
          tools: [{ google_search: {} }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);

      // Handle rate limit from Gemini API
      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable due to high demand. Please try again in a few minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini response candidates:", JSON.stringify(geminiData.candidates?.[0]?.content?.parts?.length || 0, null, 2));

    // Extract text from all parts
    let aiContent = "";
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        aiContent += part.text;
      }
    }

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
      console.log("No jobs found or parse failed, returning error");
      return new Response(
        JSON.stringify({
          status: "error",
          error: "No jobs found for this search. Try a different query.",
          raw: aiContent
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out very low confidence results
    const validJobs = jobs.filter((j: any) => (j.confidence || 0.5) >= 0.3);

    if (validJobs.length === 0) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "No reliable job information found. Try a more specific query."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates for the first job
    const { data: existingJobs, error: searchError } = await supabase.from("jobs").select("*");

    if (searchError) throw searchError;

    let duplicateStatus = "new";
    let existingJob = null;

    for (const job of existingJobs || []) {
      const similarity = calculateSimilarity(validJobs[0].exam_name || validJobs[0].title || "", job.title);
      if (similarity > 0.8) {
        duplicateStatus = "exists";
        existingJob = job;
        break;
      } else if (similarity > 0.6) {
        duplicateStatus = "similar";
        existingJob = job;
      }
    }

    console.log("Returning", validJobs.length, "jobs with status:", duplicateStatus);

    return new Response(
      JSON.stringify({ status: duplicateStatus, jobs: validJobs, existingJob, latencyMs }),
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