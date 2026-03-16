"""
Vercel Python Serverless Function — Single URL Scraper
======================================================
POST /api/scrape  { "url": "https://www.freejobalert.com/articles/..." }
Returns: { "status": "ok", "job": { ... } } or { "status": "error", "error": "..." }
"""

import json
from http.server import BaseHTTPRequestHandler
from api.scraper_v5 import scrape_url


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            url = data.get("url", "").strip()
            if not url:
                self._send_json(400, {"status": "error", "error": "Missing 'url' field"})
                return

            if not url.startswith("http"):
                self._send_json(400, {"status": "error", "error": "URL must start with http:// or https://"})
                return

            result = scrape_url(url)
            if result is None:
                self._send_json(500, {"status": "error", "error": "Failed to scrape the URL. The page may be unreachable or in an unexpected format."})
                return

            self._send_json(200, {"status": "ok", "job": result})

        except json.JSONDecodeError:
            self._send_json(400, {"status": "error", "error": "Invalid JSON body"})
        except Exception as e:
            # Catch-all: always return valid JSON no matter what
            try:
                self._send_json(500, {"status": "error", "error": f"Internal error: {str(e)}"})
            except Exception:
                pass  # last-resort: response may already be partially sent

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
