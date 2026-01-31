import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo/placeholder values to reject
const DEMO_PATTERNS = [
    /example\.com/i,
    /placeholder/i,
    /dummy/i,
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

const QUICK_REFRESH_PROMPT = `You are a government job information assistant for India with access to Google Search.

Search for OFFICIAL, CURRENT information about the specified job/exam. Focus ONLY on these 3 fields:
1. Last date to apply
2. Age limit
3. Location

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "last_date": "YYYY-MM-DD format for application deadline or null",
  "age_min": number (minimum age, e.g., 18) or null,
  "age_max": number (maximum age, e.g., 35) or null,
  "location": "Location where job is available or 'All India'" or null
}

CRITICAL RULES:
- Use Google Search to find CURRENT, OFFICIAL information only
- Return NULL for any field you cannot verify from official sources
- NEVER use placeholder values like "TBD", "N/A"
- Dates must be in YYYY-MM-DD format
- Return ONLY the JSON object, no other text`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { jobId, autoApply } = await req.json();

        if (!jobId) {
            return new Response(
                JSON.stringify({ error: "Job ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
            .select("id, title, department, last_date, age_min, age_max, location")
            .eq("id", jobId)
            .single();

        if (jobError || !job) {
            return new Response(
                JSON.stringify({ error: "Job not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Quick refreshing job data for: ${job.title} (${job.department})`);

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
                        systemInstruction: { parts: [{ text: QUICK_REFRESH_PROMPT }] },
                        contents: [{
                            role: "user",
                            parts: [{
                                text: `Search for the latest official information about:
Job/Exam: "${job.title}"
Department/Agency: "${job.department}"

Find ONLY:
1. Last date to apply (application deadline)
2. Age limit (minimum and maximum age)
3. Location of the job

Return verified data only.`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 1024
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

            if (response.status >= 500) {
                console.log(`API key ${i + 1} server error ${response.status}, trying next...`);
                lastError = `Server error: ${response.status}`;
                continue;
            }

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

        // Filter out demo values - only keep the 3 fields we care about
        const cleanData: Record<string, any> = {};

        if (newData.last_date && !isDemoDate(newData.last_date) && !isDemoValue(newData.last_date)) {
            cleanData.last_date = newData.last_date;
        }
        if (newData.age_min !== null && newData.age_min !== undefined && typeof newData.age_min === "number") {
            cleanData.age_min = newData.age_min;
        }
        if (newData.age_max !== null && newData.age_max !== undefined && typeof newData.age_max === "number") {
            cleanData.age_max = newData.age_max;
        }
        if (newData.location && !isDemoValue(newData.location)) {
            cleanData.location = newData.location;
        }

        // Auto-apply mode: directly apply the AI-fetched data
        if (autoApply) {
            const updateData: Record<string, any> = {
                updated_at: new Date().toISOString(),
            };

            if (cleanData.last_date) updateData.last_date = cleanData.last_date;
            if (cleanData.age_min !== undefined) updateData.age_min = cleanData.age_min;
            if (cleanData.age_max !== undefined) updateData.age_max = cleanData.age_max;
            if (cleanData.location) updateData.location = cleanData.location;

            const fieldsToUpdate = Object.keys(updateData).length - 1; // Exclude updated_at

            if (fieldsToUpdate > 0) {
                const { error: updateError } = await supabase
                    .from("jobs")
                    .update(updateData)
                    .eq("id", jobId);

                if (updateError) {
                    console.error("Quick refresh update error:", updateError);
                    return new Response(
                        JSON.stringify({ error: "Failed to update job", details: updateError.message }),
                        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                console.log(`Quick refreshed job ${jobId}: ${fieldsToUpdate} fields updated`);
            }

            return new Response(
                JSON.stringify({
                    status: "applied",
                    fieldsUpdated: fieldsToUpdate,
                    data: cleanData,
                    message: fieldsToUpdate > 0
                        ? `Updated ${fieldsToUpdate} fields (last_date, age, location)`
                        : "No new data found"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Return preview data with current values for comparison (default mode)
        return new Response(
            JSON.stringify({
                status: "preview",
                current: {
                    last_date: job.last_date,
                    age_min: job.age_min,
                    age_max: job.age_max,
                    location: job.location,
                },
                new: cleanData,
                job: { id: job.id, title: job.title, department: job.department },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Quick refresh job data error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Refresh failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
