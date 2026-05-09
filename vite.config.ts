import { defineConfig } from "vite";
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [localScraperPlugin(), localDiscoverPlugin(), localScrapeArticlePlugin(), localScrapeLinksPlugin(), react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
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
}));
