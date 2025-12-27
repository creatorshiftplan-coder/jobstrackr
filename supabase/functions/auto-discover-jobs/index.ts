import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Job categories
const JOB_CATEGORIES = ["SSC", "UPSC", "Banking", "Railways", "State PSC", "Defence", "Government Jobs"];
const JOBS_PER_CATEGORY = 5;

function normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
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
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };
    return { min: 18, max: 65 };
}

const JOB_DISCOVERY_PROMPT = `You are a government job information extraction assistant for India with access to Google Search.

Return ONLY a valid JSON object (no markdown):
{
  "jobs": [
    {
      "title": "Full official title (e.g., SSC CGL 2024)",
      "company": "Department/Ministry name",
      "location": "Location or 'All India'",
      "post_date": "YYYY-MM-DD or null",
      "application_link": "Direct URL to apply or null",
      "last_date": "YYYY-MM-DD deadline or null",
      "eligibility": "Eligibility summary",
      "vacancies": number or null,
      "salary_min": number INR monthly or null,
      "salary_max": number INR monthly or null,
      "age_limit": "18-32 years",
      "description": "Brief description (max 300 chars)",
      "confidence": 0.0 to 1.0
    }
  ]
}

RULES:
- Return ${JOBS_PER_CATEGORY} latest government job notifications
- Only return NEWLY RELEASED notifications from last 7 days
- Use official names
- Return ONLY JSON`;

const URL_SCRAPE_PROMPT = `You are a government job information extraction assistant.

Extract ALL government job listings from the provided webpage content.

Return ONLY a valid JSON object (no markdown):
{
  "jobs": [
    {
      "title": "Job/Exam title",
      "company": "Department/Organization",
      "location": "Location or 'All India'",
      "last_date": "YYYY-MM-DD if found or null",
      "eligibility": "Eligibility if found",
      "vacancies": number if found or null,
      "application_link": "Apply URL if found or null",
      "description": "Brief description"
    }
  ]
}

Extract every job listing you can find. Return ONLY JSON.`;

interface JobFromAI {
    title: string;
    company: string;
    location?: string;
    post_date?: string;
    application_link?: string;
    last_date?: string;
    eligibility?: string;
    vacancies?: number;
    salary_min?: number;
    salary_max?: number;
    age_limit?: string;
    description?: string;
    confidence?: number;
}

interface DiscoveryResult {
    category: string;
    jobs_found: number;
    jobs_inserted: number;
    jobs_duplicate: number;
    jobs: JobFromAI[];
    error?: string;
    latency_ms: number;
}

async function discoverCategory(
    category: string,
    apiKey: string,
    existingJobs: { id: string; title: string; department: string }[],
    supabase: any,
    autoInsert: boolean,
    supabaseUrl?: string,
    supabaseServiceKey?: string
): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const result: DiscoveryResult = {
        category,
        jobs_found: 0,
        jobs_inserted: 0,
        jobs_duplicate: 0,
        jobs: [],
        latency_ms: 0,
    };

    try {
        console.log(`Discovering jobs for category: ${category}`);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: JOB_DISCOVERY_PROMPT }] },
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `Search for the ${JOBS_PER_CATEGORY} latest ${category} government job notifications released in India in the last 7 days.
              
Find: official notifications, application dates, eligibility, vacancies, direct application links.
Return structured JSON.`
                        }]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
                    tools: [{ google_search: {} }],
                }),
            }
        );

        if (!response.ok) {
            result.error = response.status === 429 ? "Rate limited" : `API error: ${response.status}`;
            result.latency_ms = Date.now() - startTime;
            return result;
        }

        const geminiData = await response.json();
        let aiContent = "";
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) aiContent += part.text;
        }

        // Parse JSON
        let jobs: JobFromAI[] = [];
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.jobs && Array.isArray(parsed.jobs)) {
                    jobs = parsed.jobs;
                }
            } catch (e) {
                console.error(`JSON parse error for ${category}:`, e);
                result.error = "Parse error";
            }
        }

        result.jobs_found = jobs.length;

        // Check duplicates and optionally insert
        for (const job of jobs) {
            let isDuplicate = false;
            let duplicateOf = null;

            for (const existingJob of existingJobs) {
                const similarity = calculateSimilarity(job.title || "", existingJob.title);
                if (similarity > 0.8) {
                    isDuplicate = true;
                    duplicateOf = existingJob.title;
                    break;
                }
            }

            const jobWithStatus = {
                ...job,
                isDuplicate,
                duplicateOf,
            };
            result.jobs.push(jobWithStatus as any);

            if (isDuplicate) {
                result.jobs_duplicate++;
                continue;
            }

            if (autoInsert) {
                const ages = parseAgeLimit(job.age_limit || "18-65 years");
                const { data: insertedJob, error: insertError } = await supabase
                    .from("jobs")
                    .insert({
                        title: job.title,
                        department: job.company,
                        location: job.location || "All India",
                        qualification: job.eligibility || "As per notification",
                        experience: "Freshers can apply",
                        eligibility: job.eligibility,
                        description: job.description,
                        salary_min: job.salary_min,
                        salary_max: job.salary_max,
                        age_min: ages.min,
                        age_max: ages.max,
                        application_fee: 0,
                        vacancies: job.vacancies || null,
                        application_start_date: job.post_date,
                        last_date: job.last_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                        apply_link: job.application_link,
                        is_featured: false,
                        auto_discovered: true,
                    })
                    .select()
                    .single();

                if (!insertError && insertedJob) {
                    result.jobs_inserted++;
                    existingJobs.push({ id: insertedJob.id, title: insertedJob.title, department: insertedJob.department });

                    // Trigger auto-verification for the newly discovered job (non-blocking)
                    if (supabaseUrl && supabaseServiceKey) {
                        console.log(`Triggering auto-verification for discovered job: ${insertedJob.id}`);
                        fetch(`${supabaseUrl}/functions/v1/refresh-job-data`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${supabaseServiceKey}`,
                            },
                            body: JSON.stringify({ jobId: insertedJob.id, autoApply: true }),
                        })
                            .then((res) => {
                                if (!res.ok) console.error(`Auto-verify failed for job ${insertedJob.id}: ${res.status}`);
                                else console.log(`Auto-verify triggered successfully for job ${insertedJob.id}`);
                            })
                            .catch((err) => console.error("Auto-verify trigger error:", err));
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error processing category ${category}:`, error);
        result.error = error instanceof Error ? error.message : "Unknown error";
    }

    result.latency_ms = Date.now() - startTime;
    return result;
}

async function scrapeUrl(
    url: string,
    apiKey: string,
    existingJobs: { id: string; title: string; department: string }[]
): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const result: DiscoveryResult = {
        category: "URL Scrape",
        jobs_found: 0,
        jobs_inserted: 0,
        jobs_duplicate: 0,
        jobs: [],
        latency_ms: 0,
    };

    try {
        console.log(`Scraping URL: ${url}`);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: URL_SCRAPE_PROMPT }] },
                    contents: [{
                        role: "user",
                        parts: [{
                            text: `Visit and extract all government job listings from this URL: ${url}

Use Google Search to access the URL content and extract every job listing you find.
Return structured JSON with job details.`
                        }]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                    tools: [{ google_search: {} }],
                }),
            }
        );

        if (!response.ok) {
            result.error = response.status === 429 ? "Rate limited" : `API error: ${response.status}`;
            result.latency_ms = Date.now() - startTime;
            return result;
        }

        const geminiData = await response.json();
        let aiContent = "";
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) aiContent += part.text;
        }

        console.log("URL scrape response:", aiContent.substring(0, 500));

        // Parse JSON
        let jobs: JobFromAI[] = [];
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.jobs && Array.isArray(parsed.jobs)) {
                    jobs = parsed.jobs;
                }
            } catch (e) {
                console.error("JSON parse error:", e);
                result.error = "Parse error";
            }
        }

        result.jobs_found = jobs.length;

        // Check duplicates (don't auto-insert for URL scrape - let admin decide)
        for (const job of jobs) {
            let isDuplicate = false;
            let duplicateOf = null;

            for (const existingJob of existingJobs) {
                const similarity = calculateSimilarity(job.title || "", existingJob.title);
                if (similarity > 0.8) {
                    isDuplicate = true;
                    duplicateOf = existingJob.title;
                    break;
                }
            }

            result.jobs.push({
                ...job,
                isDuplicate,
                duplicateOf,
            } as any);

            if (isDuplicate) {
                result.jobs_duplicate++;
            }
        }
    } catch (error) {
        console.error("Error scraping URL:", error);
        result.error = error instanceof Error ? error.message : "Unknown error";
    }

    result.latency_ms = Date.now() - startTime;
    return result;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const body = await req.json().catch(() => ({}));
        const { category, categories, scrapeUrl: urlToScrape, autoInsert = true } = body;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

        // Fetch existing jobs for duplicate checking
        const { data: existingJobs } = await supabase
            .from("jobs")
            .select("id, title, department");

        const jobsList = existingJobs || [];
        const apiKey = geminiApiKeys[Math.floor(Math.random() * geminiApiKeys.length)];

        // MODE 1: URL Scraping
        if (urlToScrape) {
            const result = await scrapeUrl(urlToScrape, apiKey, jobsList);

            // Log the scrape
            await supabase.from("auto_discover_logs").insert({
                jobs_found: result.jobs_found,
                jobs_inserted: 0,
                jobs_duplicate: result.jobs_duplicate,
                raw_response: { url: urlToScrape, jobs: result.jobs },
                latency_ms: result.latency_ms,
                is_manual: true,
            });

            return new Response(
                JSON.stringify({
                    status: "completed",
                    mode: "scrape",
                    result,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // MODE 2: Single Category Discovery
        if (category) {
            const result = await discoverCategory(category, apiKey, jobsList, supabase, autoInsert, supabaseUrl, supabaseServiceKey);

            // Log the discovery
            await supabase.from("auto_discover_logs").insert({
                jobs_found: result.jobs_found,
                jobs_inserted: result.jobs_inserted,
                jobs_duplicate: result.jobs_duplicate,
                raw_response: { category, jobs: result.jobs },
                latency_ms: result.latency_ms,
                is_manual: true,
            });

            return new Response(
                JSON.stringify({
                    status: "completed",
                    mode: "category",
                    result,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // MODE 3: Multiple Categories (legacy)
        const categoriesToSearch = categories || JOB_CATEGORIES;
        const results: DiscoveryResult[] = [];
        let keyIndex = 0;

        for (const cat of categoriesToSearch) {
            const key = geminiApiKeys[keyIndex % geminiApiKeys.length];
            keyIndex++;
            const result = await discoverCategory(cat, key, jobsList, supabase, autoInsert, supabaseUrl, supabaseServiceKey);
            results.push(result);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const totalLatencyMs = Date.now() - startTime;

        await supabase.from("auto_discover_logs").insert({
            jobs_found: results.reduce((acc, r) => acc + r.jobs_found, 0),
            jobs_inserted: results.reduce((acc, r) => acc + r.jobs_inserted, 0),
            jobs_duplicate: results.reduce((acc, r) => acc + r.jobs_duplicate, 0),
            raw_response: { categories: categoriesToSearch, results },
            latency_ms: totalLatencyMs,
            is_manual: true,
        });

        return new Response(
            JSON.stringify({
                status: "completed",
                mode: "multi-category",
                results,
                summary: {
                    total_jobs_found: results.reduce((acc, r) => acc + r.jobs_found, 0),
                    total_jobs_inserted: results.reduce((acc, r) => acc + r.jobs_inserted, 0),
                    total_jobs_duplicate: results.reduce((acc, r) => acc + r.jobs_duplicate, 0),
                    latency_ms: totalLatencyMs,
                },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Auto-discover error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Discovery failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
