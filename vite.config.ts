import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFile } from "child_process";

// Local dev plugin: serve /api/scrape by running the Python scraper
function localScraperPlugin() {
  return {
    name: "local-scraper",
    configureServer(server: any) {
      server.middlewares.use("/api/scrape", async (req: any, res: any, next: any) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { url } = JSON.parse(body);
            if (!url) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "error", error: "Missing 'url' field" }));
              return;
            }

            // Run scraper_v5.py with --url flag
            const scriptPath = path.resolve(__dirname, "api/scraper_v5.py");
            const proc = execFile(
              "python3",
              [scriptPath, "--url", url],
              { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
              (err, stdout, stderr) => {
                if (err) {
                  console.error("Scraper error:", stderr || err.message);
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ status: "error", error: stderr || err.message }));
                  return;
                }
                try {
                  const result = JSON.parse(stdout);
                  const job = result.jobs?.[0] || null;
                  res.writeHead(job ? 200 : 500, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify(
                      job
                        ? { status: "ok", job }
                        : { status: "error", error: "Scraper returned no data" }
                    )
                  );
                } catch {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ status: "error", error: "Failed to parse scraper output" }));
                }
              }
            );
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Invalid JSON body" }));
          }
        });
      });
    },
  };
}

// Local dev plugin: serve /api/discover by running scraper_v3.py --master
function localDiscoverPlugin() {
  return {
    name: "local-discover",
    configureServer(server: any) {
      server.middlewares.use("/api/discover", async (req: any, res: any, next: any) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { url, pages = 1, follow_pages = false } = JSON.parse(body);
            if (!url) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing 'url' field" }));
              return;
            }

            const scriptPath = path.resolve(__dirname, "api/discover_links.py");
            const args = [scriptPath, "--url", url, "--pages", String(pages)];
            if (follow_pages) args.push("--follow-pages");

            execFile(
              "python3",
              args,
              { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
              (err, stdout, stderr) => {
                if (err) {
                  console.error("Discover error:", stderr || err.message);
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: stderr || err.message }));
                  return;
                }
                try {
                  const result = JSON.parse(stdout);
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify(result));
                } catch {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "Failed to parse output" }));
                }
              }
            );
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
          }
        });
      });
    },
  };
}

// Local dev plugin: serve /api/scrape-article by running scrape_article.py
function localScrapeArticlePlugin() {
  return {
    name: "local-scrape-article",
    configureServer(server: any) {
      server.middlewares.use("/api/scrape-article", async (req: any, res: any, next: any) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { url, rephrase = false } = JSON.parse(body);
            if (!url) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "error", error: "Missing 'url' field" }));
              return;
            }

            const apiDir = path.resolve(__dirname, "api");
            const args = ["-c", `
import sys, json
sys.path.insert(0, ${JSON.stringify(apiDir)})
from article_scraper import scrape_article
from rephraser import rephrase_article
article = scrape_article(${JSON.stringify(url)})
if article.get("error"):
    print(json.dumps({"status": "error", "error": article["error"]}))
else:
    if ${rephrase ? "True" : "False"}:
        try:
            article = rephrase_article(article)
        except Exception as e:
            print(f"Rephraser error: {e}", file=sys.stderr)
            article["is_rephrased"] = False
    print(json.dumps({"status": "ok", "article": article}))
`];
            execFile("python3", args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
              if (stderr) console.error("scrape-article stderr:", stderr);
              if (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: stderr || err.message }));
                return;
              }
              try {
                // Extract the last non-empty line as JSON (in case of stray output)
                const lines = stdout.trim().split("\n").filter((l: string) => l.trim());
                const jsonLine = lines[lines.length - 1];
                const result = JSON.parse(jsonLine);
                const statusCode = result.status === "error" ? 500 : 200;
                res.writeHead(statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
              } catch {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: "Failed to parse scraper output: " + stdout.slice(0, 200) }));
              }
            });
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Invalid JSON body" }));
          }
        });
      });
    },
  };
}

// Local dev plugin: serve /api/scrape-article-links by running article_scraper.py
function localScrapeLinksPlugin() {
  return {
    name: "local-scrape-article-links",
    configureServer(server: any) {
      server.middlewares.use("/api/scrape-article-links", async (req: any, res: any, next: any) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { url, limit = 10, pages = 1 } = JSON.parse(body);
            if (!url) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "error", error: "Missing 'url' field" }));
              return;
            }

            const apiDir = path.resolve(__dirname, "api");
            const args = ["-c", `
import sys, json, logging
logging.disable(logging.CRITICAL)
sys.path.insert(0, ${JSON.stringify(apiDir)})
from scraper_v3 import fetch_html, extract_links_from_master, get_pagination_urls
from article_scraper import detect_category, _parse_status, collect_article_links

def normalize(e):
    t = e.get("title", "")
    return {"title": t, "url": e.get("url", ""), "category": detect_category(t), "status": _parse_status(t), "date": e.get("update_date", "")}

target_url = ${JSON.stringify(url)}
limit_n = ${Number(limit) || 10}

all_entries = []
visited = set()
to_visit = [target_url]
done = 0
pages_limit = 1

while to_visit and done < pages_limit:
    page_url = to_visit.pop(0)
    if page_url in visited:
        continue
    visited.add(page_url)
    done += 1
    html = fetch_html(page_url)
    if not html:
        continue
    all_entries.extend(extract_links_from_master(html, page_url))

if not all_entries:
    first_html = fetch_html(target_url)
    if first_html:
        all_entries = [{"title": e["title"], "url": e["url"], "update_date": e.get("date", "")} for e in collect_article_links(first_html, target_url, limit_n)]

seen = set()
unique = []
for e in all_entries:
    u = e.get("url", "")
    if u and u not in seen:
        seen.add(u)
        unique.append(e)

links = [normalize(e) for e in unique[:limit_n]]
print(json.dumps({"links": links, "total": len(links)}))
`];
            execFile("python3", args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
              if (stderr) console.error("scrape-article-links stderr:", stderr);
              if (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: stderr || err.message }));
                return;
              }
              try {
                // Extract the last non-empty line as JSON (in case of stray output)
                const lines = stdout.trim().split("\n").filter((l: string) => l.trim());
                const jsonLine = lines[lines.length - 1];
                const result = JSON.parse(jsonLine);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
              } catch {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: "Failed to parse output: " + stdout.slice(0, 200) }));
              }
            });
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Invalid JSON body" }));
          }
        });
      });
    },
  };
}

// Local dev plugin: proxy /api/cache/* to Supabase directly (no Redis in dev)
function localCachePlugin(env: Record<string, string>) {
  return {
    name: "local-cache",
    configureServer(server: any) {
      // Helper: fetch from Supabase REST API
      const supabaseFetch = async (path: string) => {
        const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) {
          throw new Error("Supabase URL or Key is missing from environment variables");
        }
        const response = await fetch(`${url}/rest/v1/${path}`, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Supabase API error: ${response.status} ${response.statusText} - ${errText}`);
        }
        return response.json();
      };

      // /api/cache/jobs
      server.middlewares.use("/api/cache/jobs", async (_req: any, res: any) => {
        try {
          const columns = [
            "id", "slug", "title", "department", "location",
            "last_date", "last_date_display", "vacancies", "vacancies_display",
            "qualification", "eligibility", "experience",
            "salary_min", "salary_max", "age_min", "age_max",
            "application_fee", "job_metadata", "is_featured",
            "admin_refreshed_at", "created_at", "tags",
            "eligibility_summary", "required_skills",
          ].join(",");
          let data;
          try {
            data = await supabaseFetch(`jobs?select=${columns}&order=created_at.desc&limit=10000`);
          } catch (err) {
            console.warn("[localCachePlugin] Failed fetching with eligibility fields, retrying without them:", err);
            const fallbackColumns = [
              "id", "slug", "title", "department", "location",
              "last_date", "last_date_display", "vacancies", "vacancies_display",
              "qualification", "eligibility", "experience",
              "salary_min", "salary_max", "age_min", "age_max",
              "application_fee", "job_metadata", "is_featured",
              "admin_refreshed_at", "created_at", "tags",
            ].join(",");
            data = await supabaseFetch(`jobs?select=${fallbackColumns}&order=created_at.desc&limit=10000`);
          }
          res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // /api/cache/trending-exams
      server.middlewares.use("/api/cache/trending-exams", async (_req: any, res: any) => {
        try {
          const exams = await supabaseFetch(
            "exams?is_active=eq.true&ai_cached_response=not.is.null&select=*&order=ai_last_updated_at.desc"
          );
          const examsWithData = (exams || []).filter((exam: any) => {
            const ai = exam.ai_cached_response;
            if (!ai || ai.raw_response) return false;
            return ai.summary || ai.current_status;
          });
          const examIds = examsWithData.map((e: any) => e.id);
          const attempts = examIds.length > 0
            ? await supabaseFetch(`exam_attempts?exam_id=in.(${examIds.join(",")})&select=exam_id`)
            : [];
          const counts: Record<string, number> = {};
          (attempts || []).forEach((a: any) => { counts[a.exam_id] = (counts[a.exam_id] || 0) + 1; });
          const result = examsWithData.map((exam: any) => ({
            id: exam.id,
            name: exam.name,
            conducting_body: exam.conducting_body,
            category: exam.category,
            description: exam.description,
            official_website: exam.official_website,
            ai_cached_response: exam.ai_cached_response,
            ai_last_updated_at: exam.ai_last_updated_at,
            tracking_count: counts[exam.id] || 0,
            logo_url: null,
            update_slug: exam.update_slug || null,
          }));
          result.sort((a: any, b: any) => {
            if (b.tracking_count !== a.tracking_count) return b.tracking_count - a.tracking_count;
            return new Date(b.ai_last_updated_at || 0).getTime() - new Date(a.ai_last_updated_at || 0).getTime();
          });
          res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // /api/cache/exam-updates
      server.middlewares.use("/api/cache/exam-updates", async (req: any, res: any) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const category = url.searchParams.get("category") || "";
          let path = "exam_updates?select=*&order=scraped_at.desc&limit=100";
          if (category && category !== "all") {
            path += `&category=eq.${encodeURIComponent(category)}`;
          }
          const data = await supabaseFetch(path);
          res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
          res.end(JSON.stringify(data || []));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // /api/cache/homepage
      server.middlewares.use("/api/cache/homepage", async (_req: any, res: any) => {
        try {
          const columns = [
            "id", "slug", "title", "department", "location",
            "last_date", "last_date_display", "vacancies", "vacancies_display",
            "qualification", "eligibility", "experience",
            "salary_min", "salary_max", "age_min", "age_max",
            "application_fee", "job_metadata", "is_featured",
            "admin_refreshed_at", "created_at", "tags",
            "eligibility_summary", "required_skills",
          ].join(",");
          let allJobs;
          try {
            allJobs = await supabaseFetch(`jobs?select=${columns}&order=created_at.desc&limit=10000`);
          } catch (err) {
            console.warn("[localCachePlugin] Failed fetching with eligibility fields, retrying without them:", err);
            const fallbackColumns = [
              "id", "slug", "title", "department", "location",
              "last_date", "last_date_display", "vacancies", "vacancies_display",
              "qualification", "eligibility", "experience",
              "salary_min", "salary_max", "age_min", "age_max",
              "application_fee", "job_metadata", "is_featured",
              "admin_refreshed_at", "created_at", "tags",
            ].join(",");
            allJobs = await supabaseFetch(`jobs?select=${fallbackColumns}&order=created_at.desc&limit=10000`);
          }
          const [exams] = await Promise.all([
            supabaseFetch("exams?select=*&is_active=eq.true&order=name"),
          ]);
          const recentJobs = (allJobs || []).slice(0, 50);
          res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
          res.end(JSON.stringify({
            recentJobs,
            allJobs: allJobs || [],
            exams: exams || [],
          }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // /api/cache/logos
      server.middlewares.use("/api/cache/logos", async (_req: any, res: any) => {
        try {
          const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          const listUrl = `${url}/storage/v1/object/list/logos`;
          const response = await fetch(listUrl, {
            method: "POST",
            headers: {
              apikey: key!,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prefix: "conducting-bodies/",
              limit: 1000,
              sortBy: { column: "name", order: "asc" },
            }),
          });

          if (!response.ok) {
            res.writeHead(response.status, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Storage list failed" }));
          }

          const files: any[] = await response.json();
          if (!files || files.length === 0) {
            res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
            return res.end(JSON.stringify([]));
          }

          const imageRegex = /\.(png|jpg|jpeg|webp|svg)$/i;
          const logos = files
            .filter((file) => file.name !== ".emptyFolderPlaceholder" && imageRegex.test(file.name))
            .map((file) => {
              const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
              const publicUrl = `${url}/storage/v1/object/public/logos/conducting-bodies/${file.name}`;

              return {
                id: file.id || file.name,
                name: nameWithoutExt.replace(/-/g, " ").replace(/_/g, " "),
                slug: nameWithoutExt.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                logo_url: publicUrl,
                category: null,
                created_at: file.created_at || new Date().toISOString(),
              };
            });

          res.writeHead(200, { "Content-Type": "application/json", "X-Cache-Hit": "0" });
          res.end(JSON.stringify(logos));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// Dev-only: serve the standalone quiz page at the pretty /quiz URL,
// mirroring the production rewrite in vercel.json (/quiz -> /quiz.html).
function quizRouteAlias() {
  return {
    name: "quiz-route-alias",
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const url = (req.url || "").split("?")[0];
        if (url === "/quiz" || url === "/quiz/") req.url = "/quiz.html";
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [quizRouteAlias(), localCachePlugin(env), localScraperPlugin(), localDiscoverPlugin(), localScrapeArticlePlugin(), localScrapeLinksPlugin(), react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Multi-page build: the main app + a standalone, serverless quiz page
      // (quiz.html) that ships its own minimal bundle — no app shell required.
      input: {
        main: path.resolve(__dirname, "index.html"),
        quiz: path.resolve(__dirname, "quiz.html"),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['framer-motion', 'recharts'],
          'vendor-lottie': ['lottie-react'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
