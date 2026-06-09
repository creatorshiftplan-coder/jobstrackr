"""
Vercel Serverless — Article Link Discovery from Listing Page
===============================================================
POST /api/scrape-article-links
Body: { "url": "https://www.freejobalert.com/admit-card/", "limit": 10, "pages": 1 }
Returns: { "links": [...], "total": N }
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from http.server import BaseHTTPRequestHandler
from scraper_v3 import fetch_html, extract_links_from_master, get_pagination_urls
from article_scraper import detect_category, _parse_status, collect_article_links
from auth import is_request_authorized, is_domain_allowed

def _normalize(entry: dict) -> dict:
    """Convert scraper_v3 entry to ArticleLink shape expected by the frontend."""
    title = entry.get("title", "")
    return {
        "title": title,
        "url": entry.get("url", ""),
        "category": detect_category(title),
        "status": _parse_status(title),
        "date": entry.get("update_date", ""),
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Enforce Authentication and Role Checking
            auth_header = self.headers.get("Authorization", "")
            if not is_request_authorized(auth_header):
                self._send_json(401, {"error": "Unauthorized access"})
                return

            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}
            if not isinstance(data, dict):
                data = {}

            url = data.get("url", "").strip()
            limit = int(data.get("limit", 10))
            pages = max(1, int(data.get("pages", 1)))

            if not url:
                self._send_json(400, {"error": "Missing 'url' field"})
                return

            if not url.startswith("http"):
                self._send_json(400, {"error": "URL must start with http:// or https://"})
                return

            # 2. Enforce Domain Allowlist (SSRF Protection)
            if not is_domain_allowed(url):
                self._send_json(403, {"error": "Forbidden: Target URL domain is not allowed"})
                return

            # Discover links across pages — same logic as discover.py
            all_entries: list = []
            visited: set = set()
            to_visit = [url]
            done = 0

            while to_visit and done < pages:
                page_url = to_visit.pop(0)
                if page_url in visited:
                    continue
                visited.add(page_url)
                done += 1

                html = fetch_html(page_url)
                if not html:
                    continue

                all_entries.extend(extract_links_from_master(html, page_url))

                if done < pages:
                    for nxt in get_pagination_urls(html, page_url):
                        if nxt not in visited:
                            to_visit.append(nxt)

            # If structured scraper found nothing, fall back to collect_article_links
            if not all_entries:
                first_html = fetch_html(url)
                if first_html:
                    all_entries = [
                        {"title": e["title"], "url": e["url"], "update_date": e.get("date", "")}
                        for e in collect_article_links(first_html, url, limit)
                    ]

            # Deduplicate by URL
            seen_urls: set = set()
            unique: list = []
            for e in all_entries:
                u = e.get("url", "")
                if u and u not in seen_urls:
                    seen_urls.add(u)
                    unique.append(e)

            links = [_normalize(e) for e in unique[:limit]]
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
