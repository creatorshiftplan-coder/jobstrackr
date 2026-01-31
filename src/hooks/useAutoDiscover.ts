import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JobFromDiscovery {
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
    isDuplicate?: boolean;
    duplicateOf?: string;
}

interface DiscoveryResult {
    category: string;
    jobs_found: number;
    jobs_inserted: number;
    jobs_duplicate: number;
    jobs: JobFromDiscovery[];
    error?: string;
    latency_ms: number;
}

interface AutoDiscoverLog {
    id: string;
    run_at: string;
    jobs_found: number;
    jobs_inserted: number;
    jobs_duplicate: number;
    raw_response: any;
    error: string | null;
    latency_ms: number;
    is_manual: boolean;
    reviewed: boolean;
    reviewed_at: string | null;
    reviewed_by: string | null;
}

interface CategoryDiscoveryResponse {
    status: string;
    mode: string;
    result: DiscoveryResult;
}

interface ScrapeResponse {
    status: string;
    mode: string;
    result: DiscoveryResult;
}

export function useAutoDiscover() {
    const queryClient = useQueryClient();

    // Get unreviewed count for badge
    const { data: unreviewedCount = 0 } = useQuery({
        queryKey: ["auto-discover-unreviewed-count"],
        queryFn: async () => {
            const { data, error } = await (supabase.rpc as any)("get_unreviewed_auto_discover_count");
            if (error) {
                console.error("Error fetching unreviewed count:", error);
                return 0;
            }
            return data || 0;
        },
        refetchInterval: 60000,
    });

    // Get recent logs
    const { data: logs = [], isLoading: logsLoading } = useQuery({
        queryKey: ["auto-discover-logs"],
        queryFn: async () => {
            const { data, error } = await (supabase.from as any)("auto_discover_logs")
                .select("*")
                .order("run_at", { ascending: false })
                .limit(20);

            if (error) {
                console.error("Error fetching auto-discover logs:", error);
                throw error;
            }
            return (data || []) as AutoDiscoverLog[];
        },
    });

    // Mark logs as reviewed
    const markAsReviewed = useMutation({
        mutationFn: async (logIds: string[]) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await (supabase.from as any)("auto_discover_logs")
                .update({
                    reviewed: true,
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user.id,
                })
                .in("id", logIds);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["auto-discover-logs"] });
            queryClient.invalidateQueries({ queryKey: ["auto-discover-unreviewed-count"] });
        },
    });

    // Discover by single category
    const discoverByCategory = useMutation({
        mutationFn: async (category: string): Promise<CategoryDiscoveryResponse> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error("Not authenticated");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-discover-jobs`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ category }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Discovery failed");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["auto-discover-logs"] });
            queryClient.invalidateQueries({ queryKey: ["auto-discover-unreviewed-count"] });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
    });

    // Scrape URL
    const scrapeUrl = useMutation({
        mutationFn: async (url: string): Promise<ScrapeResponse> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error("Not authenticated");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-discover-jobs`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ scrapeUrl: url }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Scraping failed");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["auto-discover-logs"] });
        },
    });

    // Add discovered jobs to database and trigger auto-verification
    const addDiscoveredJobs = useMutation({
        mutationFn: async (jobs: JobFromDiscovery[]) => {
            const jobsToAdd = jobs.filter(j => !j.isDuplicate);

            if (jobsToAdd.length === 0) {
                throw new Error("No new jobs to add");
            }

            const parseAgeLimit = (ageLimit?: string) => {
                if (!ageLimit) {
                    console.log("No age limit provided, using default 18-65");
                    return { min: 18, max: 65 };
                }

                console.log("Parsing age limit:", ageLimit);

                // Try multiple patterns to extract age range
                const rangePatterns = [
                    /(\d+)\s*[-–—]\s*(\d+)/,           // 18-30, 18 - 30, 18–30
                    /(\d+)\s*to\s*(\d+)/i,              // 18 to 30
                    /min[:\s]*(\d+)[^\d].*max[:\s]*(\d+)/i,  // min: 18, max: 30
                    /age[:\s]*(\d+)[^\d]+(\d+)/i,       // age: 18-30 or age 18 to 30
                ];

                for (const pattern of rangePatterns) {
                    const match = ageLimit.match(pattern);
                    if (match) {
                        const min = parseInt(match[1]);
                        const max = parseInt(match[2]);
                        console.log(`Parsed age range: ${min}-${max}`);
                        return { min, max };
                    }
                }

                // If no range found, try to find max age only
                const maxOnlyPatterns = [
                    /max(?:imum)?[:\s]*(\d+)/i,         // max: 30, maximum: 30
                    /below\s*(\d+)/i,                    // below 30
                    /under\s*(\d+)/i,                    // under 30
                    /upto\s*(\d+)/i,                     // upto 30
                    /up\s*to\s*(\d+)/i,                  // up to 30
                ];

                for (const pattern of maxOnlyPatterns) {
                    const match = ageLimit.match(pattern);
                    if (match) {
                        const max = parseInt(match[1]);
                        console.log(`Parsed max age only: 18-${max}`);
                        return { min: 18, max };
                    }
                }

                // Last resort: find any two numbers in the string
                const allNumbers = ageLimit.match(/\d+/g);
                if (allNumbers && allNumbers.length >= 2) {
                    const nums = allNumbers.map(n => parseInt(n)).filter(n => n >= 10 && n <= 70);
                    if (nums.length >= 2) {
                        const min = Math.min(...nums);
                        const max = Math.max(...nums);
                        console.log(`Extracted numbers: ${min}-${max}`);
                        return { min, max };
                    }
                }

                console.log("Could not parse age limit, using default 18-65");
                return { min: 18, max: 65 };
            };

            // Prepare all job records for batch insert
            const jobRecords = jobsToAdd.map(job => {
                const ages = parseAgeLimit(job.age_limit);
                return {
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
                };
            });

            // Batch insert for better performance
            const { data: insertedJobs, error } = await supabase
                .from("jobs")
                .insert(jobRecords)
                .select("id");

            if (error) throw error;
            const insertedJobIds = insertedJobs?.map(j => j.id) || [];

            // Trigger auto-verification with staggered delays (2s between each)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token && insertedJobIds.length > 0) {
                const VERIFY_DELAY_MS = 2000;
                for (let i = 0; i < insertedJobIds.length; i++) {
                    setTimeout(() => {
                        fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-job-data`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({ jobId: insertedJobIds[i], autoApply: true }),
                            }
                        ).catch(err => console.error("Auto-verify trigger error:", err));
                    }, i * VERIFY_DELAY_MS);
                }
            }

            return { inserted: jobsToAdd.length };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
    });

    return {
        unreviewedCount,
        logs,
        logsLoading,
        markAsReviewed,
        discoverByCategory,
        scrapeUrl,
        addDiscoveredJobs,
    };
}
