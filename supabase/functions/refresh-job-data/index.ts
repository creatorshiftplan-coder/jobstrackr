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
        const { jobId, applyData, autoApply } = await req.json();

        if (!jobId) {
            return new Response(
                JSON.stringify({ error: "Job ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Support multiple API keys for rotation (up to 6)
        const geminiApiKeys = [
            Deno.env.get("GEMINI_API_KEY"),
            Deno.env.get("GEMINI_API_KEY_2"),
            Deno.env.get("GEMINI_API_KEY_3"),
            Deno.env.get("GEMINI_API_KEY_4"),
            Deno.env.get("GEMINI_API_KEY_5"),
            Deno.env.get("GEMINI_API_KEY_6"),
            Deno.env.get("GEMINI_API_KEY_7"),
        ].filter(Boolean) as string[];

        if (geminiApiKeys.length === 0) {
            return new Response(
                JSON.stringify({ error: "AI service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

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

        // For autoApply mode: check if job is already verified to prevent duplicate verifications
        if (autoApply && job.admin_refreshed_at) {
            console.log(`Job ${jobId} already verified at ${job.admin_refreshed_at}, skipping auto-verification`);
            return new Response(
                JSON.stringify({ status: "already_verified", message: "Job already verified" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If applyData is provided, apply the changes (phase 2 - manual apply from preview)
        if (applyData) {
            const updateData: Record<string, any> = {
                admin_refreshed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Only update fields that have valid, non-demo values
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
        console.log(`Refreshing job data for: ${job.title} (${job.department})`);

        // Try each API key until one works
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

            // Also retry on server errors (500, 502, 503, etc.)
            if (response.status >= 500) {
                console.log(`API key ${i + 1} server error ${response.status}, trying next...`);
                lastError = `Server error: ${response.status}`;
                continue;
            }

            // Other client errors (400, 401, 403) - don't try more keys
            const errorText = await response.text();
            console.error(`API key ${i + 1} error:`, response.status, errorText);
            lastError = `AI API error: ${response.status}`;
            break;
        }

        if (!geminiResponse) {
            return new Response(
                JSON.stringify({ error: lastError || "All API keys failed" }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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

        // For autoApply mode: directly apply the AI-fetched data and always mark as verified
        if (autoApply) {
            const updateData: Record<string, any> = {
                admin_refreshed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Copy clean data fields to update (if any)
            if (cleanData.vacancies !== undefined) updateData.vacancies = cleanData.vacancies;
            if (cleanData.eligibility) updateData.eligibility = cleanData.eligibility;
            if (cleanData.application_start_date) updateData.application_start_date = cleanData.application_start_date;
            if (cleanData.last_date) updateData.last_date = cleanData.last_date;
            if (cleanData.age_min !== undefined) updateData.age_min = cleanData.age_min;
            if (cleanData.age_max !== undefined) updateData.age_max = cleanData.age_max;
            if (cleanData.apply_link) updateData.apply_link = cleanData.apply_link;

            const { error: updateError } = await supabase
                .from("jobs")
                .update(updateData)
                .eq("id", jobId);

            if (updateError) {
                console.error("Auto-apply update error:", updateError);
                return new Response(
                    JSON.stringify({ error: "Failed to auto-update job", details: updateError.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const fieldsUpdated = Object.keys(updateData).length - 2; // Exclude timestamps
            console.log(`Auto-verified job ${jobId}: ${fieldsUpdated} fields updated`);

            return new Response(
                JSON.stringify({
                    status: "applied",
                    fieldsUpdated,
                    message: fieldsUpdated > 0
                        ? `Auto-verified: ${fieldsUpdated} fields updated`
                        : "Verified (no additional data found)"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Return preview data with current values for comparison (default mode)
        return new Response(
            JSON.stringify({
                status: "preview",
                current: {
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
