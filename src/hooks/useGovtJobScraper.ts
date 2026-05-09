import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────

export interface ScraperSource {
    id: string;
    name: string;
    url: string;
    category: string;
    is_active: boolean;
    limit_per_run: number;
    last_scraped_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExamUpdate {
    id: string;
    source_id: string | null;
    url: string;
    title: string;
    category: string;
    status: string | null;
    published_date: string | null;
    summary: string | null;
    important_dates: any[];
    overview: any[];
    download_links: { text: string; url: string }[];
    tags: string[];
    sections: { heading: string; level: string; content: string[] }[];
    related_articles: { title: string; url: string }[];
    scraped_at: string;
    created_at: string;
    updated_at: string;
}

export interface ScraperRunLog {
    id: string;
    source_id: string | null;
    category: string | null;
    articles_found: number;
    articles_scraped: number;
    articles_new: number;
    articles_updated: number;
    errors: number;
    error_details: string | null;
    latency_ms: number | null;
    is_cron: boolean;
    is_manual: boolean;
    run_at: string;
}

export interface ArticleLink {
    title: string;
    url: string;
    category: string;
    status: string;
    date: string;
}

export interface ArticleData {
    url: string;
    scraped_at: string;
    title: string;
    category: string;
    published_date: string;
    summary: string;
    status: string;
    full_text?: string;
    important_dates: any[];
    overview: any[];
    vacancy_table?: { post_name: string; vacancies: string }[];
    fee_table?: { category: string; fee: string }[];
    eligibility_table?: { criteria: string; details: string }[];
    cutoff_table?: { category: string; marks: string }[];
    download_links: { text: string; url: string }[];
    official_links?: { text: string; url: string }[];
    related_links?: { text: string; url: string }[];
    tags: string[];
    sections: { heading: string; level: string; content: string[]; type?: string }[];
    related_articles: { title: string; url: string }[];
    images?: string[];
    is_rephrased?: boolean;
    error?: string;
}

interface CrawlResult {
    sourceUrl: string;
    category: string;
    articles_found: number;
    articles_scraped: number;
    articles_new: number;
    articles_updated: number;
    errors: number;
    latency_ms: number;
}

// ─── Helper: call edge function ──────────────────────────────────────

async function callScraperFunction(body: Record<string, any>): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");

    const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/govtjob-scraper`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useGovtJobScraper() {
    const queryClient = useQueryClient();

    // ── Scraper Sources CRUD ─────────────────────────────────────────

    const { data: sources = [], isLoading: sourcesLoading } = useQuery({
        queryKey: ["scraper-sources"],
        queryFn: async () => {
            const { data, error } = await (supabase.from as any)("scraper_sources")
                .select("*")
                .order("created_at", { ascending: true });
            if (error) throw error;
            return (data || []) as ScraperSource[];
        },
    });

    const addSource = useMutation({
        mutationFn: async (source: { name: string; url: string; category: string; limit_per_run: number }) => {
            const { error } = await (supabase.from as any)("scraper_sources").insert(source);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scraper-sources"] }),
    });

    const updateSource = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<ScraperSource> & { id: string }) => {
            const { error } = await (supabase.from as any)("scraper_sources")
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scraper-sources"] }),
    });

    const deleteSource = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from as any)("scraper_sources").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scraper-sources"] }),
    });

    const toggleSourceActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await (supabase.from as any)("scraper_sources")
                .update({ is_active, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scraper-sources"] }),
    });

    // ── Exam Updates ─────────────────────────────────────────────────

    const { data: examUpdates = [], isLoading: updatesLoading, refetch: refetchUpdates } = useQuery({
        queryKey: ["exam-updates"],
        queryFn: async () => {
            const { data, error } = await (supabase.from as any)("exam_updates")
                .select("*")
                .order("scraped_at", { ascending: false })
                .limit(100);
            if (error) throw error;
            return (data || []) as ExamUpdate[];
        },
    });

    const deleteExamUpdate = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase.from as any)("exam_updates").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam-updates"] }),
    });

    // ── Scraper Run Logs ─────────────────────────────────────────────

    const { data: runLogs = [], isLoading: logsLoading } = useQuery({
        queryKey: ["scraper-run-logs"],
        queryFn: async () => {
            const { data, error } = await (supabase.from as any)("scraper_run_logs")
                .select("*")
                .order("run_at", { ascending: false })
                .limit(30);
            if (error) throw error;
            return (data || []) as ScraperRunLog[];
        },
    });

    // ── Scraper Actions ──────────────────────────────────────────────

    const triggerSourceCrawl = useMutation({
        mutationFn: async ({ sourceId, limit }: { sourceId: string; limit?: number }) => {
            return callScraperFunction({ sourceId, limit }) as Promise<{ status: string; result: CrawlResult }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exam-updates"] });
            queryClient.invalidateQueries({ queryKey: ["scraper-run-logs"] });
            queryClient.invalidateQueries({ queryKey: ["scraper-sources"] });
        },
    });

    const triggerUrlCrawl = useMutation({
        mutationFn: async ({ url, limit, category }: { url: string; limit?: number; category?: string }) => {
            return callScraperFunction({ url, limit, category }) as Promise<{ status: string; result: CrawlResult }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exam-updates"] });
            queryClient.invalidateQueries({ queryKey: ["scraper-run-logs"] });
        },
    });

    const triggerCron = useMutation({
        mutationFn: async () => {
            return callScraperFunction({ mode: "cron" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exam-updates"] });
            queryClient.invalidateQueries({ queryKey: ["scraper-run-logs"] });
            queryClient.invalidateQueries({ queryKey: ["scraper-sources"] });
        },
    });

    // ── Discover: links only (Python Vercel API) ──────────────────

    const scrapeLinks = useMutation({
        mutationFn: async ({ url, limit, pages = 1 }: { url: string; limit: number; pages?: number }) => {
            const resp = await fetch("/api/scrape-article-links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, limit, pages }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            return resp.json() as Promise<{ links: ArticleLink[]; total: number }>;
        },
    });

    // ── Discover: single article scrape (Python Vercel API) ──────────

    const scrapeSingleArticle = useMutation({
        mutationFn: async ({ articleUrl, rephrase = false }: { articleUrl: string; rephrase?: boolean }) => {
            const resp = await fetch("/api/scrape-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: articleUrl, rephrase }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const data = await resp.json();
            return { status: data.status, article: data.article as ArticleData };
        },
    });

    // ── Discover: save article to DB ─────────────────────────────────

    const saveArticle = useMutation({
        mutationFn: async (payload: ArticleData | { article: ArticleData; sourceId?: string }) => {
            const article = "article" in payload ? payload.article : payload;
            const sourceId = "article" in payload ? payload.sourceId : undefined;
            const record: Record<string, any> = {
                url: article.url,
                title: article.title,
                category: article.category,
                status: article.status || null,
                published_date: article.published_date || null,
                summary: article.summary || null,
                full_text: article.full_text || null,
                important_dates: article.important_dates,
                overview: article.overview,
                vacancy_table: article.vacancy_table || null,
                fee_table: article.fee_table || null,
                eligibility_table: article.eligibility_table || null,
                cutoff_table: article.cutoff_table || null,
                download_links: article.download_links,
                official_links: article.official_links || null,
                related_links: article.related_links || null,
                tags: article.tags,
                sections: article.sections,
                related_articles: article.related_articles,
                scraped_at: article.scraped_at,
                updated_at: new Date().toISOString(),
            };
            if (sourceId) record.source_id = sourceId;

            // Auto-match to a job listing by title
            try {
                const { data: matchedJobId } = await (supabase.rpc as any)("match_exam_update_to_job", {
                    update_title: article.title,
                });
                if (matchedJobId) {
                    record.job_id = matchedJobId;
                }
            } catch (e) {
                console.warn("Auto-match to job failed:", e);
            }

            // Check if exists (upsert)
            const { data: existing } = await (supabase.from as any)("exam_updates")
                .select("id")
                .eq("url", article.url)
                .maybeSingle();

            if (existing) {
                const { error } = await (supabase.from as any)("exam_updates")
                    .update(record)
                    .eq("url", article.url);
                if (error) throw error;
                return { action: "updated" as const };
            } else {
                record.created_at = new Date().toISOString();
                const { error } = await (supabase.from as any)("exam_updates")
                    .insert(record);
                if (error) throw error;
                return { action: "new" as const };
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam-updates"] }),
    });

    return {
        // Sources
        sources,
        sourcesLoading,
        addSource,
        updateSource,
        deleteSource,
        toggleSourceActive,
        // Exam updates
        examUpdates,
        updatesLoading,
        refetchUpdates,
        deleteExamUpdate,
        // Run logs
        runLogs,
        logsLoading,
        // Scraper actions
        triggerSourceCrawl,
        triggerUrlCrawl,
        triggerCron,
        // Discover
        scrapeLinks,
        scrapeSingleArticle,
        saveArticle,
    };
}
