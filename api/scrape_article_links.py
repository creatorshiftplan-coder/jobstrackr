"""
Vercel Serverless — Article Link Discovery from Listing Page
===============================================================
POST /api/scrape-article-links
Body: { "url": "https://www.freejobalert.com/admit-card/", "limit": 10 }
Returns: { "links": [...], "total": N }
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from http.server import BaseHTTPRequestHandler
from article_scraper import fetch_html, collect_article_links


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            url = data.get("url", "").strip()
            limit = int(data.get("limit", 10))

            if not url:
                self._send_json(400, {"error": "Missing 'url' field"})
                return

            if not url.startswith("http"):
                self._send_json(400, {"error": "URL must start with http:// or https://"})
                return

            html = fetch_html(url)
            if not html:
                self._send_json(502, {"error": "Failed to fetch listing page"})
                return

            links = collect_article_links(html, url, limit)
            self._send_json(200, {"links": links, "total": len(links)})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            try:
                self._send_json(500, {"error": f"Internal error: {str(e)}"})
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
