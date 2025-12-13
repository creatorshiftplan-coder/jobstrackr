import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo/placeholder values to reject
const DEMO_PATTERNS = [
    /example\.com/i,
    /test\.com/i,
    /placeholder/i,
    /dummy/i,
    /lorem ipsum/i,
    /^tbd$/i,
    /^n\/a$/i,
    /^na$/i,
    /to be announced/i,
    /not available/i,
    /not applicable/i,
    /^-$/,
    /^nil$/i,
];

const DEMO_DATE_PATTERNS = [
    /^0000-00-00$/,
    /^9999-12-31$/,
    /^1970-01-01$/,
];

function isDemoValue(value: string | null | undefined): boolean {
    if (!value || typeof value !== "string") return false;
    const trimmed = value.trim();
    return DEMO_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isDemoDate(value: string | null | undefined): boolean {
    if (!value) return false;
    return DEMO_DATE_PATTERNS.some(pattern => pattern.test(value));
}

function parseAgeLimit(ageLimit: string): { min: number; max: number } {
    const match = ageLimit.match(/(\d+)\s*[-–to]\s*(\d+)/);
    if (match) {
        return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
    return { min: 18, max: 65 };
}

const JOB_REFRESH_PROMPT = `You are a government job information assistant for India with access to Google Search.

Search for OFFICIAL, CURRENT information about the specified job/exam. Return ONLY verified data from official government sources.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "location": "Actual location or 'All India'",
  "vacancies": number or null if unknown,
  "eligibility": "Actual eligibility criteria from official notification",
  "application_start_date": "YYYY-MM-DD format or null",
  "last_date": "YYYY-MM-DD format for application deadline or null",
  "age_min": number (minimum age, e.g., 18),
  "age_max": number (maximum age, e.g., 35),
  "apply_link": "Direct official application URL (not example.com)",
  "confidence": 0.0 to 1.0
}

CRITICAL RULES:
- Use Google Search to find CURRENT, OFFICIAL information only
- Return NULL for any field you cannot verify from official sources
- NEVER use placeholder values like "TBD", "N/A", "example.com"
- Dates must be in YYYY-MM-DD format
- Return ONLY the JSON object, no other text`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { jobId, applyData } = await req.json();

        if (!jobId) {
            return new Response(
                JSON.stringify({ error: "Job ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch current job data
        const { data: job, error: jobError } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .single();

        if (jobError || !job) {
            return new Response(
                JSON.stringify({ error: "Job not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If applyData is provided, apply the changes (phase 2)
        if (applyData) {
            const updateData: Record<string, any> = {
                admin_refreshed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Only update fields that have valid, non-demo values
            if (applyData.location && !isDemoValue(applyData.location)) {
                updateData.location = applyData.location;
            }
            if (applyData.vacancies !== null && applyData.vacancies !== undefined) {
                updateData.vacancies = applyData.vacancies;
            }
            if (applyData.eligibility && !isDemoValue(applyData.eligibility)) {
                updateData.eligibility = applyData.eligibility;
            }
            if (applyData.application_start_date && !isDemoDate(applyData.application_start_date)) {
                updateData.application_start_date = applyData.application_start_date;
            }
            if (applyData.last_date && !isDemoDate(applyData.last_date)) {
                updateData.last_date = applyData.last_date;
            }
            if (applyData.age_min !== null && applyData.age_min !== undefined) {
                updateData.age_min = applyData.age_min;
            }
            if (applyData.age_max !== null && applyData.age_max !== undefined) {
                updateData.age_max = applyData.age_max;
            }
            if (applyData.apply_link && !isDemoValue(applyData.apply_link)) {
                updateData.apply_link = applyData.apply_link;
            }

            const { error: updateError } = await supabase
                .from("jobs")
                .update(updateData)
                .eq("id", jobId);

            if (updateError) {
                console.error("Update error:", updateError);
                return new Response(
                    JSON.stringify({ error: "Failed to update job", details: updateError.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const fieldsUpdated = Object.keys(updateData).length - 2; // Exclude timestamps

            return new Response(
                JSON.stringify({
                    status: "updated",
                    fieldsUpdated,
                    message: `Updated ${fieldsUpdated} fields successfully`
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Preview mode: fetch data from AI
        if (!geminiApiKey) {
            return new Response(
                JSON.stringify({ error: "AI service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Refreshing job data for: ${job.title} (${job.department})`);

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: JOB_REFRESH_PROMPT }] },
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `Search for the latest official information about:
Job/Exam: "${job.title}"
Department/Agency: "${job.department}"

Find the current:
1. Application start and end dates
2. Age limit for applying
3. Number of vacancies
4. Eligibility criteria
5. Official application link

Return verified data only.`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2048
                    },
                    tools: [{ google_search: {} }],
                }),
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API error:", geminiResponse.status, errorText);

            if (geminiResponse.status === 429) {
                return new Response(
                    JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            throw new Error(`AI API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();

        // Extract text from response
        let aiContent = "";
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) {
                aiContent += part.text;
            }
        }

        console.log("AI raw response:", aiContent);

        // Parse JSON from response
        let newData: Record<string, any> = {};
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                newData = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error("JSON parse error:", e);
                return new Response(
                    JSON.stringify({ error: "Failed to parse AI response" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Filter out demo values
        const cleanData: Record<string, any> = {};

        if (newData.location && !isDemoValue(newData.location)) {
            cleanData.location = newData.location;
        }
        if (newData.vacancies !== null && newData.vacancies !== undefined && typeof newData.vacancies === "number") {
            cleanData.vacancies = newData.vacancies;
        }
        if (newData.eligibility && !isDemoValue(newData.eligibility)) {
            cleanData.eligibility = newData.eligibility;
        }
        if (newData.application_start_date && !isDemoDate(newData.application_start_date) && !isDemoValue(newData.application_start_date)) {
            cleanData.application_start_date = newData.application_start_date;
        }
        if (newData.last_date && !isDemoDate(newData.last_date) && !isDemoValue(newData.last_date)) {
            cleanData.last_date = newData.last_date;
        }
        if (newData.age_min !== null && newData.age_min !== undefined && typeof newData.age_min === "number") {
            cleanData.age_min = newData.age_min;
        }
        if (newData.age_max !== null && newData.age_max !== undefined && typeof newData.age_max === "number") {
            cleanData.age_max = newData.age_max;
        }
        if (newData.apply_link && !isDemoValue(newData.apply_link)) {
            cleanData.apply_link = newData.apply_link;
        }
        if (newData.confidence !== undefined) {
            cleanData.confidence = newData.confidence;
        }

        // Return preview data with current values for comparison
        return new Response(
            JSON.stringify({
                status: "preview",
                current: {
                    location: job.location,
                    vacancies: job.vacancies,
                    eligibility: job.eligibility,
                    application_start_date: job.application_start_date,
                    last_date: job.last_date,
                    age_min: job.age_min,
                    age_max: job.age_max,
                    apply_link: job.apply_link,
                },
                new: cleanData,
                job: { id: job.id, title: job.title, department: job.department },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Refresh job data error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Refresh failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
