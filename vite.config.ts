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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [localScraperPlugin(), localDiscoverPlugin(), react()],
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
