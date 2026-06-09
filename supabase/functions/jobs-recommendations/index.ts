import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadApiKeys, callWithRotation } from "../_shared/apiKeyRotation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculate age helper
function calculateAge(dobString: string): number {
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify User JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load active API keys for Groq
    const apiKeys = await loadApiKeys(supabase);
    const groqKeys = apiKeys.filter(k => k.provider === "groq");

    if (groqKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Groq API service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userSkills = body.skills || [];

    // 1. Fetch User Profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("preferred_sectors, gender, category, date_of_birth")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found. Please complete profile setup first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch User Education
    const { data: education, error: eduError } = await supabase
      .from("education")
      .select("qualification_type, qualification_name, board_university")
      .eq("user_id", user.id);

    if (eduError) throw eduError;

    // 3. Fetch Tracked Exams
    const { data: trackedExams, error: examsError } = await supabase
      .from("exam_attempts")
      .select("*, exams(name)")
      .eq("user_id", user.id);

    if (examsError) throw examsError;

    // 4. Pre-filter candidates from DB (RPC)
    const { data: candidates, error: rpcError } = await supabase.rpc(
      "recommend_jobs_for_user_prefilter",
      { p_user_id: user.id, p_limit: 20 }
    );

    if (rpcError) throw rpcError;

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [], success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Structure User Context for LLM
    const profileSummary = {
      age: profile.date_of_birth ? calculateAge(profile.date_of_birth) : "Not specified",
      gender: profile.gender || "Not specified",
      category: profile.category || "General",
      education: education.map(e => `${e.qualification_type} (${e.qualification_name || "Any"}) from ${e.board_university || "Any"}`),
      skills: userSkills,
      preferred_sectors: profile.preferred_sectors || [],
      tracked_exams: trackedExams.map(te => te.exams?.name).filter(Boolean),
    };

    // 6. Structure Job Candidate details
    const jobsListText = candidates.map((job: any) => `
ID: ${job.id}
Title: ${job.title}
Department: ${job.department}
Location: ${job.location}
Salary: ₹${job.salary_min || 0} - ₹${job.salary_max || 0}
Age limit: Min ${job.age_min || "none"}, Max ${job.age_max || "none"}
Vacancies: ${job.vacancies || "not specified"}
Qualification Required: ${job.qualification || ""}
Eligibility Summary: ${job.eligibility || ""}
Description: ${job.description || ""}
Tags: ${job.tags ? job.tags.join(", ") : ""}
Vector Distance to User: ${job.vector_distance}
`).join("\n---\n");

    const systemPrompt = `You are an expert Indian government job recommendation assistant.
Compare the user profile with the list of jobs and output a valid JSON containing match analysis.

User Profile:
- Age: ${profileSummary.age}
- Gender: ${profileSummary.gender}
- Category: ${profileSummary.category}
- Education Qualifications: ${JSON.stringify(profileSummary.education)}
- Additional Skills: ${JSON.stringify(profileSummary.skills)}
- Preferred Sectors: ${JSON.stringify(profileSummary.preferred_sectors)}
- Tracked Exams: ${JSON.stringify(profileSummary.tracked_exams)}

Output format must be strictly a JSON object matching this schema (no markdown, no leading/trailing text, no code blocks):
{
  "recommendations": [
    {
      "job_id": "string (UUID matching the job)",
      "match_score": number (0 to 100),
      "reasons": ["string (max 10 words per reason explaining why the job is a match/gap)"]
    }
  ]
}

Rules:
1. Hard Constraints: If the user fails a strict constraint (e.g. age range or qualification stream), set match_score = 0 and include the reason (e.g. "Over the maximum age limit").
2. Scoring:
   - High Score (80-100): Excellent qualification alignment, matches tracked exams, matches location/sector.
   - Medium Score (40-70): Qualified, but missing secondary skills or minor sector mismatches.
   - Low Score (10-30): Borderline qualified, significant skill gaps.
3. Be concise. Reasons must be short, action-oriented, and clear (e.g. "Matches your B.Tech in Engineering", "Syllabus aligns with SSC CGL focus", "Requires typing skill which you lack").`;

    // 7. Call LLM (using Groq key rotation)
    console.log(`[Recommendations] Requesting Llama 3 70B match analysis for user: ${user.id} against ${candidates.length} candidate jobs.`);
    const rotationResult = await callWithRotation(supabase, groqKeys, {
      systemPrompt,
      userPrompt: `Evaluate these jobs:\n${jobsListText}`,
      temperature: 0.2,
      maxTokens: 4096,
    });

    const aiContent = rotationResult.content;

    // Parse LLM JSON payload
    let recommendations: any[] = [];
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          recommendations = parsed.recommendations;
        }
      } catch (e) {
        console.error("[Recommendations] Failed to parse LLM JSON response:", e);
        throw new Error("Invalid recommendation payload format from AI");
      }
    } else {
      throw new Error("No JSON payload found in AI response");
    }

    // 8. Merge AI scores and reasons with candidate jobs
    const finalRecommendations = candidates.map((job: any) => {
      const match = recommendations.find(r => r.job_id === job.id);
      return {
        job,
        match_score: match ? match.match_score : 50,
        reasons: match ? match.reasons : ["Matches core profile requirements"],
        is_eligible: match ? match.match_score > 0 : true
      };
    }).sort((a: any, b: any) => b.match_score - a.match_score); // Sort descending by LLM match score

    return new Response(
      JSON.stringify({ recommendations: finalRecommendations, success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in jobs-recommendations function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
