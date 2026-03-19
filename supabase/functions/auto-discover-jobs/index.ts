import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Job categories
const JOB_CATEGORIES = ["SSC", "UPSC", "Banking", "Railways", "State PSC", "Defence", "Government Jobs"];
const JOBS_PER_CATEGORY = 5;

function normalizeText(text: string): string {
    if (!text || typeof text !== 'string') return "";
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")  // Replace special chars with space (not remove)
        .replace(/\s+/g, " ")
        .trim();
}

// Extract year from text (e.g., "SSC CGL 2024" -> "2024")
function extractYear(text: string): string | null {
    const match = text.match(/\b(20\d{2})\b/);
    return match ? match[1] : null;
}

// Levenshtein distance for short string comparison
function levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length, n = s2.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

// Jaccard similarity (word-based)
function jaccardSimilarity(str1: string, str2: string): number {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const words1 = new Set(s1.split(" ").filter(w => w.length > 0));
    const words2 = new Set(s2.split(" ").filter(w => w.length > 0));

    if (words1.size === 0 || words2.size === 0) return 0.0;

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

// Levenshtein-based similarity (0-1 scale)
function levenshteinSimilarity(str1: string, str2: string): number {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const distance = levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
}

interface DuplicateCheckResult {
    isDuplicate: boolean;
    duplicateOf: string | null;
    similarity: number;
    matchType: 'exact' | 'title' | 'title_dept' | 'none';
}

// Enhanced duplicate checking with multiple strategies
function checkDuplicate(
    newTitle: string,
    newDepartment: string,
    existingJobs: { id: string; title: string; department: string }[]
): DuplicateCheckResult {
    const result: DuplicateCheckResult = {
        isDuplicate: false,
        duplicateOf: null,
        similarity: 0,
        matchType: 'none'
    };

    // Handle empty/null titles
    if (!newTitle || newTitle.trim().length === 0) {
        return result;
    }

    const normalizedNewTitle = normalizeText(newTitle);
    const normalizedNewDept = normalizeText(newDepartment || "");
    const newYear = extractYear(newTitle);

    // Dynamic threshold based on title length (shorter titles need higher confidence)
    const wordCount = normalizedNewTitle.split(" ").filter(w => w.length > 0).length;
    const baseThreshold = wordCount <= 3 ? 0.85 : 0.75;

    for (const existingJob of existingJobs) {
        const existingYear = extractYear(existingJob.title);

        // RULE 1: Different years = NOT duplicate (e.g., "SSC CGL 2023" vs "SSC CGL 2024")
        if (newYear && existingYear && newYear !== existingYear) {
            continue;
        }

        // Calculate title similarity using both algorithms
        const jaccardSim = jaccardSimilarity(newTitle, existingJob.title);
        const levenshteinSim = levenshteinSimilarity(newTitle, existingJob.title);

        // Use higher of the two for short titles, Jaccard for longer ones
        const titleSimilarity = wordCount <= 4
            ? Math.max(jaccardSim, levenshteinSim)
            : jaccardSim;

        // RULE 2: Exact match
        if (normalizedNewTitle === normalizeText(existingJob.title)) {
            result.isDuplicate = true;
            result.duplicateOf = existingJob.title;
            result.similarity = 1.0;
            result.matchType = 'exact';
            console.log(`[Duplicate:Exact] "${newTitle}" === "${existingJob.title}"`);
            return result;
        }

        // RULE 3: High title similarity
        if (titleSimilarity > baseThreshold) {
            result.isDuplicate = true;
            result.duplicateOf = existingJob.title;
            result.similarity = titleSimilarity;
            result.matchType = 'title';
            console.log(`[Duplicate:Title] "${newTitle}" ~ "${existingJob.title}" (sim=${titleSimilarity.toFixed(2)})`);
            return result;
        }

        // RULE 4: Combined title + department check (lower threshold if both match)
        if (titleSimilarity > 0.6) {
            const deptSimilarity = jaccardSimilarity(newDepartment || "", existingJob.department || "");
            const combinedSim = (titleSimilarity * 0.7) + (deptSimilarity * 0.3);

            if (combinedSim > 0.75) {
                result.isDuplicate = true;
                result.duplicateOf = existingJob.title;
                result.similarity = combinedSim;
                result.matchType = 'title_dept';
                console.log(`[Duplicate:TitleDept] "${newTitle}" + "${newDepartment}" ~ "${existingJob.title}" + "${existingJob.department}" (combined=${combinedSim.toFixed(2)})`);
                return result;
            }
        }

        // Track highest similarity for logging near-misses
        if (titleSimilarity > result.similarity) {
            result.similarity = titleSimilarity;
            result.duplicateOf = existingJob.title; // For debugging
        }
    }

    // Log near-misses for debugging
    if (result.similarity > 0.5) {
        console.log(`[Near-miss] "${newTitle}" closest to "${result.duplicateOf}" (sim=${result.similarity.toFixed(2)}, threshold=${baseThreshold})`);
        result.duplicateOf = null; // Clear since it's not a duplicate
    }

    return result;
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
      "title": "Full official Job/Exam title (REQUIRED)",
      "company": "Department/Organization name (REQUIRED)",
      "location": "Location or 'All India'",
      "post_date": "YYYY-MM-DD when notification was posted or null",
      "last_date": "YYYY-MM-DD application deadline (REQUIRED if available)",
      "eligibility": "Education and eligibility requirements",
      "vacancies": number (REQUIRED - must extract total vacancies, look for 'posts', 'vacancies', 'positions'),
      "salary_min": number (minimum monthly salary in INR) or null,
      "salary_max": number (maximum monthly salary in INR) or null,
      "age_limit": "XX-YY years (REQUIRED - must find age limit, e.g., '18-35 years')",
      "application_link": "Direct official apply URL or null",
      "description": "Brief description (max 300 chars)",
      "confidence": 0.0 to 1.0 (how confident you are in the extracted data)
    }
  ]
}

CRITICAL RULES:
- vacancies and age_limit are MANDATORY - search thoroughly for these values
- If vacancies appears as 'Various' or 'Multiple', estimate based on context or use 1
- If age limit is not explicitly stated, use common government job limits (18-35 years)
- Extract EVERY job listing you can find from the page
- Return ONLY valid JSON, no markdown or extra text`;


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

async function authorizeAdminOrService(
    req: Request,
    supabase: any,
    serviceRoleKey: string,
): Promise<Response | null> {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
        return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (token === serviceRoleKey) {
        return null;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
        return new Response(
            JSON.stringify({ error: "Invalid authentication token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
    });

    if (roleError) {
        console.error("Role check error:", roleError);
        return new Response(
            JSON.stringify({ error: "Authorization check failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (isAdmin !== true) {
        return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return null;
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
            // Use enhanced duplicate checking
            const duplicateCheck = checkDuplicate(job.title || "", job.company || "", existingJobs);

            const jobWithStatus = {
                ...job,
                isDuplicate: duplicateCheck.isDuplicate,
                duplicateOf: duplicateCheck.duplicateOf,
                similarity: duplicateCheck.similarity,
                matchType: duplicateCheck.matchType,
            };
            result.jobs.push(jobWithStatus as any);

            if (duplicateCheck.isDuplicate) {
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
            // Use enhanced duplicate checking
            const duplicateCheck = checkDuplicate(job.title || "", job.company || "", existingJobs);

            result.jobs.push({
                ...job,
                isDuplicate: duplicateCheck.isDuplicate,
                duplicateOf: duplicateCheck.duplicateOf,
                similarity: duplicateCheck.similarity,
                matchType: duplicateCheck.matchType,
            } as any);

            if (duplicateCheck.isDuplicate) {
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

        const authError = await authorizeAdminOrService(req, supabase, supabaseServiceKey);
        if (authError) {
            return authError;
        }

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
