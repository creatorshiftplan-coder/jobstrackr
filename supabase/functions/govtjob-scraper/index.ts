import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.47/deno-dom-wasm.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Config ──────────────────────────────────────────────────────────

const BASE_URL = "https://www.freejobalert.com";

const LISTING_PAGES: Record<string, string> = {
    admit_card: "/admit-card/",
    result: "/exam-results/",
    answer_key: "/answer-key/",
    latest: "/latest-notifications/",
    syllabus: "/syllabus/",
};

const HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: BASE_URL,
};

// ─── Nav link filter — paths and texts to skip ──────────────────────

const NAV_PATHS = new Set([
    "/government-jobs", "/state-government-jobs", "/bank-jobs",
    "/teaching-faculty-jobs", "/engineering-jobs", "/railway-jobs",
    "/police-defence-jobs", "/latest-notifications", "/employment-news",
    "/search-jobs", "/sarkarijob", "/sarkari-naukri",
    "/admit-card", "/exam-results", "/answer-key", "/cutoff-marks",
    "/written-marks", "/interview-results", "/last-date-reminder",
    "/eligibility", "/syllabus", "/exam-pattern", "/selection-process",
    "/previous-papers", "/education", "/contact-us", "/policy",
    "/author",
]);

const NAV_TEXTS = new Set([
    "view all", "join whatsapp", "join telegram", "join instagram",
    "join youtube", "download mobile app", "free mock test",
    "google news", "follow us", "add as a preferred source",
    "play fun games", "image resizer", "pdf to word",
    "image to pdf", "word to pdf", "free ai interview",
]);

const SKIP_HEADINGS_RE = /follow us|join|advertisement|share|about the author|other posts|job notifications|jobs by|state job|other active|other ssc/i;

const DOWNLOAD_KW = [
    "download", "admit card", "hall ticket", "result", "apply",
    "login", "official", "click here", "direct link", "answer key", "scorecard",
];

// ─── Helpers ─────────────────────────────────────────────────────────

function clean(text: string | null | undefined): string {
    return (text || "").replace(/\s+/g, " ").trim();
}

function absUrl(href: string): string {
    if (!href) return "";
    if (href.startsWith("http")) return href;
    try {
        return new URL(href, BASE_URL).href;
    } catch {
        return BASE_URL + (href.startsWith("/") ? "" : "/") + href;
    }
}

function isNavLink(href: string, text: string): boolean {
    const stripped = href.replace(/\/$/, "");
    for (const path of NAV_PATHS) {
        if (stripped.endsWith(path)) return true;
    }
    return NAV_TEXTS.has(text.toLowerCase());
}

function detectCategory(title: string): string {
    const t = title.toLowerCase();
    if (/admit card|hall ticket|call letter|admit\b/.test(t)) return "admit_card";
    if (/result|scorecard|merit list|cut.?off|marks/.test(t)) return "result";
    if (/answer key/.test(t)) return "answer_key";
    if (/syllabus|exam pattern/.test(t)) return "syllabus";
    if (/recruitment|apply online|vacancy|vacancies|notification/.test(t)) return "recruitment";
    return "news";
}

function parseDate(text: string): string {
    const m = text.match(
        /(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})/,
    );
    return m ? m[1] : "";
}

function parseStatus(text: string): string {
    const m = text.match(
        /\b(Out|Released|Active|Available|Declared|Upcoming|Soon|Live Now)\b/i,
    );
    return m ? m[1] : "";
}

// ─── Fetch with timeout + retry ──────────────────────────────────────

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10_000);
            const resp = await fetch(url, {
                headers: HEADERS,
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.text();
        } catch (e) {
            console.warn(`fetchHtml attempt ${attempt + 1} failed for ${url}: ${e}`);
            if (attempt < retries) {
                const jitter = Math.random() * 500;
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) + jitter));
            }
        }
    }
    console.error(`All retries exhausted for ${url}`);
    return null;
}

// ─── Table parsers ───────────────────────────────────────────────────

interface DateRow {
    event: string;
    date: string;
    status: string;
    link: string;
}

interface OverviewRow {
    field: string;
    value: string;
}

function parseDatesTable(tableEl: any): DateRow[] {
    const rows: DateRow[] = [];
    try {
        for (const tr of tableEl.querySelectorAll("tr")) {
            const cells = tr.querySelectorAll("td, th");
            if (!cells.length) continue;
            const texts = Array.from(cells).map((c: any) => clean(c.textContent));

            let link = "";
            for (const c of cells) {
                const a = (c as any).querySelector("a[href]");
                if (a) {
                    const h = a.getAttribute("href") || "";
                    if (h && !h.startsWith("javascript") && !h.startsWith("#") && !h.startsWith("mailto")) {
                        link = absUrl(h);
                        break;
                    }
                }
            }

            if (texts.length < 2) continue;

            let event: string, date: string, status: string;
            if (texts.length === 2) {
                event = texts[0];
                date = parseDate(texts[1]) || texts[1];
                status = parseStatus(texts[1]);
            } else {
                event = texts[0];
                date = parseDate(texts[1]) || texts[1];
                status = parseStatus(texts.slice(2).join(" ")) || texts[2];
            }

            if (event) rows.push({ event, date, status, link });
        }
    } catch (e) {
        console.warn("parseDatesTable error:", e);
    }
    return rows;
}

function parseOverviewTable(tableEl: any): OverviewRow[] {
    const rows: OverviewRow[] = [];
    try {
        for (const tr of tableEl.querySelectorAll("tr")) {
            const cells = tr.querySelectorAll("td, th");
            if (cells.length < 2) continue;
            const field = clean(cells[0].textContent);
            const value = clean(cells[1].textContent);
            if (field && value) rows.push({ field, value });
        }
    } catch (e) {
        console.warn("parseOverviewTable error:", e);
    }
    return rows;
}

// ─── Link collector ──────────────────────────────────────────────────

interface ArticleLink {
    title: string;
    url: string;
    category: string;
    status: string;
    date: string;
}

function collectLinks(html: string, listingUrl: string, limit: number): ArticleLink[] {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return [];

    const seen = new Set<string>();
    const items: ArticleLink[] = [];

    for (const a of doc.querySelectorAll('a[href*="/articles/"]')) {
        const href = absUrl((a as any).getAttribute("href") || "");
        const text = clean(a.textContent);
        if (!text || !href || seen.has(href)) continue;
        if (isNavLink(href, text)) continue;

        seen.add(href);

        let dateStr = "";
        let statusStr = "";
        const parent = (a as any).closest("li, tr, div, p");
        if (parent) {
            const full = clean(parent.textContent);
            dateStr = parseDate(full);
            statusStr = parseStatus(full);
        }

        items.push({
            title: text,
            url: href,
            category: detectCategory(text),
            status: statusStr,
            date: dateStr,
        });

        if (items.length >= limit) break;
    }

    return items;
}

// ─── Article parser ──────────────────────────────────────────────────

interface ArticleData {
    url: string;
    scraped_at: string;
    title: string;
    category: string;
    published_date: string;
    summary: string;
    status: string;
    important_dates: DateRow[];
    overview: OverviewRow[];
    download_links: { text: string; url: string }[];
    tags: string[];
    sections: { heading: string; level: string; content: string[] }[];
    related_articles: { title: string; url: string }[];
    error?: string;
}

async function parseArticle(url: string): Promise<ArticleData> {
    const out: ArticleData = {
        url,
        scraped_at: new Date().toISOString(),
        title: "",
        category: "",
        published_date: "",
        summary: "",
        status: "",
        important_dates: [],
        overview: [],
        download_links: [],
        tags: [],
        sections: [],
        related_articles: [],
    };

    const html = await fetchHtml(url);
    if (!html) {
        return { ...out, error: "Failed to fetch" };
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
        return { ...out, error: "Failed to parse HTML" };
    }

    // Title & category
    const h1 = doc.querySelector("h1");
    if (h1) {
        out.title = clean(h1.textContent);
        out.category = detectCategory(out.title);
        out.status = parseStatus(out.title);
    }

    // Published date (meta tags)
    const pubMeta =
        doc.querySelector('meta[property="article:published_time"]') ||
        doc.querySelector('meta[property="og:updated_time"]');
    if (pubMeta) {
        out.published_date = (pubMeta as any).getAttribute("content") || "";
    }
    if (!out.published_date) {
        for (const tag of doc.querySelectorAll("time, span, p")) {
            const txt = clean(tag.textContent);
            const d = parseDate(txt);
            if (d && /\d{4}/.test(d)) {
                out.published_date = d;
                break;
            }
        }
    }

    // Summary (meta description)
    const descMeta =
        doc.querySelector('meta[name="description"]') ||
        doc.querySelector('meta[property="og:description"]');
    if (descMeta) {
        out.summary = (descMeta as any).getAttribute("content") || "";
    }

    // Tags
    const allPs = doc.querySelectorAll("p");
    for (const p of allPs) {
        if (/Tags\s*:/i.test(p.textContent || "")) {
            const raw = (p.textContent || "").replace(/Tags\s*:/i, "");
            out.tags = raw.split(",").map((t: string) => clean(t)).filter(Boolean);
            break;
        }
    }

    // Article body
    const body =
        doc.querySelector(".entry-content, .article-content, .post-content, .article__body") ||
        doc.querySelector("article") ||
        doc.querySelector("main");

    if (body) {
        // Tables
        for (const table of body.querySelectorAll("table")) {
            const ttext = (table.textContent || "").toLowerCase();

            const isDates = [
                "exam date", "result date", "admit card", "last date",
                "release date", "notification", "tier", "phase",
                "answer key", "hall ticket", "city intimation",
            ].some((k) => ttext.includes(k));

            const isOverview = [
                "conducting body", "exam name", "official website",
                "vacancies", "total posts", "total vacancy", "post name",
            ].some((k) => ttext.includes(k));

            if (isOverview && out.overview.length === 0) {
                out.overview = parseOverviewTable(table);
            } else if (isDates && out.important_dates.length === 0) {
                out.important_dates = parseDatesTable(table);
            }
        }

        // Download / official links
        const seenLinks = new Set<string>();
        for (const a of body.querySelectorAll("a[href]")) {
            const href = absUrl((a as any).getAttribute("href") || "");
            const text = clean(a.textContent);
            if (!text || !href) continue;
            if (href.startsWith("javascript") || href.startsWith("#") || href.startsWith("mailto")) continue;
            if (isNavLink(href, text)) continue;
            if (href.includes("freejobalert.com") && !href.includes("/articles/")) {
                if (!["gov.in", "nic.in", "login", "download", "admit", "result"].some((k) => href.includes(k))) {
                    continue;
                }
            }
            const loT = text.toLowerCase();
            const loH = href.toLowerCase();
            if (DOWNLOAD_KW.some((k) => loT.includes(k) || loH.includes(k))) {
                if (!seenLinks.has(href)) {
                    seenLinks.add(href);
                    out.download_links.push({ text, url: href });
                }
            }
        }

        // Sections (headings + body)
        let current: { heading: string; level: string; content: string[] } | null = null;
        for (const tag of body.querySelectorAll("h2, h3, h4, p, ul, ol")) {
            const tagName = tag.tagName.toLowerCase();
            if (["h2", "h3", "h4"].includes(tagName)) {
                const heading = clean(tag.textContent);
                if (SKIP_HEADINGS_RE.test(heading)) {
                    current = null;
                    continue;
                }
                if (current) out.sections.push(current);
                current = { heading, level: tagName, content: [] };
            } else if (current) {
                const txt = clean(tag.textContent);
                if (txt) current.content.push(txt);
            }
        }
        if (current) out.sections.push(current);
    }

    // Related articles
    const seenRel = new Set<string>();
    for (const a of doc.querySelectorAll('a[href*="/articles/"]')) {
        const href = absUrl((a as any).getAttribute("href") || "");
        const text = clean(a.textContent);
        if (text && href && href !== url && !seenRel.has(href) && !isNavLink(href, text)) {
            seenRel.add(href);
            out.related_articles.push({ title: text, url: href });
        }
    }
    out.related_articles = out.related_articles.slice(0, 10);

    return out;
}

// ─── Auth helper ─────────────────────────────────────────────────────

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

    if (token === serviceRoleKey) return null;

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

// ─── Upsert helper ───────────────────────────────────────────────────

async function upsertArticle(
    supabase: any,
    article: ArticleData,
    sourceId?: string,
): Promise<"new" | "updated" | "error"> {
    if (article.error || !article.title) return "error";

    const record: Record<string, any> = {
        url: article.url,
        title: article.title,
        category: article.category,
        status: article.status || null,
        published_date: article.published_date || null,
        summary: article.summary || null,
        important_dates: article.important_dates,
        overview: article.overview,
        download_links: article.download_links,
        tags: article.tags,
        sections: article.sections,
        related_articles: article.related_articles,
        scraped_at: article.scraped_at,
        updated_at: new Date().toISOString(),
    };
    if (sourceId) record.source_id = sourceId;

    // Auto-match to a job listing by title
    try {
        const { data: matchedJobId } = await supabase.rpc("match_exam_update_to_job", {
            update_title: article.title,
        });
        if (matchedJobId) {
            record.job_id = matchedJobId;
        }
    } catch (e) {
        console.warn("Auto-match to job failed:", e);
    }

    // Auto-match to a tracked exam by name
    try {
        const { data: matchedExam } = await supabase
            .from("exams")
            .select("id")
            .ilike("name", `%${article.title.split(/\s+/).slice(0, 4).join("%")}%`)
            .limit(1)
            .maybeSingle();
        if (matchedExam?.id) {
            record.exam_id = matchedExam.id;
        }
    } catch (e) {
        console.warn("Auto-match to exam failed:", e);
    }

    // Check if exists first
    const { data: existing } = await supabase
        .from("exam_updates")
        .select("id")
        .eq("url", article.url)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from("exam_updates")
            .update(record)
            .eq("url", article.url);
        return error ? "error" : "updated";
    } else {
        record.created_at = new Date().toISOString();
        const { error } = await supabase
            .from("exam_updates")
            .insert(record);
        return error ? "error" : "new";
    }
}

// ─── Crawl a single source ──────────────────────────────────────────

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

async function crawlSource(
    supabase: any,
    listingUrl: string,
    category: string,
    limit: number,
    sourceId?: string,
): Promise<CrawlResult> {
    const start = Date.now();
    const result: CrawlResult = {
        sourceUrl: listingUrl,
        category,
        articles_found: 0,
        articles_scraped: 0,
        articles_new: 0,
        articles_updated: 0,
        errors: 0,
        latency_ms: 0,
    };

    const html = await fetchHtml(listingUrl);
    if (!html) {
        result.errors = 1;
        result.latency_ms = Date.now() - start;
        return result;
    }

    const links = collectLinks(html, listingUrl, limit);
    result.articles_found = links.length;

    for (const link of links) {
        try {
            const article = await parseArticle(link.url);
            result.articles_scraped++;

            const status = await upsertArticle(supabase, article, sourceId);
            if (status === "new") result.articles_new++;
            else if (status === "updated") result.articles_updated++;
            else result.errors++;
        } catch (e) {
            console.error(`Error scraping ${link.url}:`, e);
            result.errors++;
        }
    }

    result.latency_ms = Date.now() - start;

    // Update last_scraped_at on the source
    if (sourceId) {
        await supabase
            .from("scraper_sources")
            .update({ last_scraped_at: new Date().toISOString() })
            .eq("id", sourceId);
    }

    return result;
}

// ─── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const body = await req.json().catch(() => ({}));
        const {
            mode,
            sourceId,
            url,
            articleUrl,
            linksOnly,
            category,
            limit = 6,
        } = body;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authError = await authorizeAdminOrService(req, supabase, supabaseServiceKey);
        if (authError) return authError;

        // ── MODE: Links only (discover Step 1) ──
        if (linksOnly && url) {
            const html = await fetchHtml(url);
            if (!html) {
                return new Response(
                    JSON.stringify({ error: "Failed to fetch listing page" }),
                    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
            }
            const links = collectLinks(html, url, limit);
            return new Response(
                JSON.stringify({ links, total: links.length }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── MODE: Single article scrape (discover Step 2) ──
        if (articleUrl) {
            const article = await parseArticle(articleUrl);
            return new Response(
                JSON.stringify({ status: "ok", article }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── MODE: Source crawl (by sourceId) ──
        if (sourceId) {
            const { data: source } = await supabase
                .from("scraper_sources")
                .select("*")
                .eq("id", sourceId)
                .single();

            if (!source) {
                return new Response(
                    JSON.stringify({ error: "Source not found" }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
            }

            const result = await crawlSource(
                supabase,
                source.url,
                source.category,
                limit || source.limit_per_run,
                source.id,
            );

            await supabase.from("scraper_run_logs").insert({
                source_id: source.id,
                category: source.category,
                articles_found: result.articles_found,
                articles_scraped: result.articles_scraped,
                articles_new: result.articles_new,
                articles_updated: result.articles_updated,
                errors: result.errors,
                latency_ms: result.latency_ms,
                is_manual: true,
            });

            return new Response(
                JSON.stringify({ status: "completed", result }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── MODE: Custom URL crawl ──
        if (url && !linksOnly) {
            const cat = category || "custom";
            const result = await crawlSource(supabase, url, cat, limit);

            await supabase.from("scraper_run_logs").insert({
                category: cat,
                articles_found: result.articles_found,
                articles_scraped: result.articles_scraped,
                articles_new: result.articles_new,
                articles_updated: result.articles_updated,
                errors: result.errors,
                latency_ms: result.latency_ms,
                is_manual: true,
            });

            return new Response(
                JSON.stringify({ status: "completed", result }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── MODE: Cron (scrape all active sources) ──
        if (mode === "cron" || Object.keys(body).length === 0) {
            const { data: sources } = await supabase
                .from("scraper_sources")
                .select("*")
                .eq("is_active", true)
                .order("last_scraped_at", { ascending: true, nullsFirst: true });

            if (!sources || sources.length === 0) {
                return new Response(
                    JSON.stringify({ status: "no_active_sources" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
            }

            // Distribute 30 links across active sources
            const totalTarget = 30;
            const perSource = Math.max(1, Math.floor(totalTarget / sources.length));
            const results: CrawlResult[] = [];

            for (const source of sources) {
                // Check if we're approaching the 60s timeout (leave 10s margin)
                if (Date.now() - startTime > 48_000) {
                    console.warn("Approaching timeout, stopping cron crawl early");
                    break;
                }

                const lim = Math.min(perSource, source.limit_per_run || 6);
                console.log(`Cron: crawling ${source.name} (${source.category}), limit=${lim}`);

                const result = await crawlSource(supabase, source.url, source.category, lim, source.id);
                results.push(result);

                await supabase.from("scraper_run_logs").insert({
                    source_id: source.id,
                    category: source.category,
                    articles_found: result.articles_found,
                    articles_scraped: result.articles_scraped,
                    articles_new: result.articles_new,
                    articles_updated: result.articles_updated,
                    errors: result.errors,
                    latency_ms: result.latency_ms,
                    is_cron: true,
                });
            }

            const summary = {
                sources_processed: results.length,
                total_found: results.reduce((a, r) => a + r.articles_found, 0),
                total_scraped: results.reduce((a, r) => a + r.articles_scraped, 0),
                total_new: results.reduce((a, r) => a + r.articles_new, 0),
                total_updated: results.reduce((a, r) => a + r.articles_updated, 0),
                total_errors: results.reduce((a, r) => a + r.errors, 0),
                latency_ms: Date.now() - startTime,
            };

            return new Response(
                JSON.stringify({ status: "completed", mode: "cron", summary, results }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        return new Response(
            JSON.stringify({ error: "Invalid request. Provide mode, sourceId, url, articleUrl, or linksOnly." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("govtjob-scraper error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Scraper failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
