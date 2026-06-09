import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadApiKeys, callWithRotation } from "../_shared/apiKeyRotation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYLLABUS_PROMPT = `You are a government exam syllabus expert for India with access to Google Search.

Search for the OFFICIAL, LATEST syllabus for the specified exam. Return ONLY verified data from official sources (conducting body website, official notifications).

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "exam_name": "Official exam name",
  "year": 2025,
  "syllabus": [
    {
      "subject": "Subject Name",
      "section_title": "Section or Paper name",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "marks_weightage": "e.g. 25 marks / 20%",
      "marks": 25,
      "stage_name": "Prelims/Mains/Tier-1 etc or null",
      "exam_type": "MCQ/Descriptive/CBT etc or null",
      "total_marks": 200,
      "duration_mins": 120
    }
  ],
  "stages": [
    {
      "stage_name": "Prelims/Tier-1/Paper-I etc",
      "exam_type": "MCQ/Descriptive/CBT",
      "total_marks": 200,
      "duration_mins": 120,
      "sections": [
        {
          "subject": "Subject Name",
          "section_title": "Section name",
          "topics": ["Topic 1", "Topic 2"],
          "marks_weightage": "25 marks",
          "marks": 25
        }
      ]
    }
  ],
  "grounding_sources": ["URL1", "URL2"],
  "confidence": 0.0 to 1.0
}

CRITICAL RULES:
- Use Google Search to find the CURRENT official syllabus
- If the exam has multiple stages (Prelims + Mains, Tier 1 + Tier 2), include ALL stages
- Include detailed topics for each subject/section
- grounding_sources must be real URLs you found the information from
- Return ONLY the JSON object, no other text
- If you cannot find verified syllabus data, return {"error": "Syllabus not found for this exam"}`;

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
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { exam_name } = body;

    if (!exam_name || typeof exam_name !== "string") {
      return new Response(
        JSON.stringify({ error: "exam_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syllabus search for: "${exam_name}" by user ${user.id}`);

    const normalizedName = exam_name.replace(/\s*\d{4}\s*/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

    // Call AI with key rotation and Google Search
    let aiContent = "";
    try {
      const rotationResult = await callWithRotation(supabase, apiKeys, {
        systemPrompt: SYLLABUS_PROMPT,
        userPrompt: `Search for the latest official syllabus for: "${exam_name}"

Find:
1. All subjects and topics covered
2. Exam pattern (MCQ/Descriptive, marks, duration)
3. If multiple stages exist (Prelims, Mains, Tier 1, Tier 2), include all
4. Official source URLs

Return structured JSON with detailed syllabus breakdown.`,
        temperature: 0.2,
        maxTokens: 8192,
        useGoogleSearch: true,
      });
      aiContent = rotationResult.content;
    } catch (rotationError) {
      console.error("All keys failed:", rotationError);
      return new Response(
        JSON.stringify({ error: (rotationError as Error).message || "AI service temporarily unavailable" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI raw response length:", aiContent.length);

    // Parse JSON from response
    let syllabusData: Record<string, any> = {};
    try {
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      syllabusData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      // Try extracting JSON from within the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          syllabusData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("JSON parse error:", e);
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.error("No JSON found in AI response");
        return new Response(
          JSON.stringify({ error: "No structured data in AI response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if AI returned an error
    if (syllabusData.error) {
      return new Response(
        JSON.stringify({ error: syllabusData.error }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure required fields
    if (!syllabusData.exam_name) {
      syllabusData.exam_name = exam_name;
    }
    if (!syllabusData.year) {
      syllabusData.year = new Date().getFullYear();
    }

    // Cache the result in syllabus_cache table
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Cache for 30 days

      await supabase
        .from("syllabus_cache")
        .upsert({
          exam_name: normalizedName,
          syllabus_data: syllabusData,
          source_urls: syllabusData.grounding_sources || [],
          year: syllabusData.year,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: "exam_name",
        });

      console.log(`Cached syllabus for: ${normalizedName}`);
    } catch (cacheError) {
      console.error("Cache error (non-critical):", cacheError);
      // Continue without crashing — caching is non-critical
    }

    return new Response(
      JSON.stringify({ syllabus: syllabusData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Syllabus search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Syllabus search failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
