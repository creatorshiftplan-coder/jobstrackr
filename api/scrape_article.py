"""
Vercel Serverless — Single Article Scraper + Optional Rephraser
==================================================================
POST /api/scrape-article
Body: { "url": "https://...", "rephrase": true }
Returns: { "status": "ok", "article": { ... } }
"""

import json
import sys
import os

# Ensure api/ is on path for local imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from http.server import BaseHTTPRequestHandler
from article_scraper import scrape_article
from rephraser import rephrase_article


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}
            if not isinstance(data, dict):
                data = {}

            url = data.get("url", "").strip()
            do_rephrase = data.get("rephrase", False)

            if not url:
                self._send_json(400, {"status": "error", "error": "Missing 'url' field"})
                return

            if not url.startswith("http"):
                self._send_json(400, {"status": "error", "error": "URL must start with http:// or https://"})
                return

            try:
                article = scrape_article(url)
            except Exception as scrape_err:
                self._send_json(500, {"status": "error", "error": f"Scraper crash: {str(scrape_err)}"})
                return

            if not isinstance(article, dict):
                self._send_json(500, {"status": "error", "error": "Scraper returned invalid data"})
                return

            if article.get("error"):
                self._send_json(500, {"status": "error", "error": article["error"]})
                return

            if do_rephrase:
                try:
                    article = rephrase_article(article)
                except Exception as e:
                    # Graceful fallback: keep original if rephraser fails
                    print(f"Rephraser error (fallback to original): {e}")
                    article["is_rephrased"] = False

            self._send_json(200, {"status": "ok", "article": article})

        except json.JSONDecodeError:
            self._send_json(400, {"status": "error", "error": "Invalid JSON body"})
        except Exception as e:
            try:
                self._send_json(500, {"status": "error", "error": f"Internal error: {str(e)}"})
            except Exception:
                pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
