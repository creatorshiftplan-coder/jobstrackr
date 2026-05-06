"""
Vercel Python Serverless Function — Discover Links from Listing Page
=====================================================================
POST /api/discover  { "url": "https://www.freejobalert.com/new-updates/", "pages": 1, "follow_pages": false }
Returns: { "entries": [{update_date, title, url}, ...], "total": 25 }
"""

import json
from http.server import BaseHTTPRequestHandler
from api.scraper_v3 import fetch_html, extract_links_from_master, get_pagination_urls


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            url = data.get("url", "").strip()
            if not url:
                self._send_json(400, {"error": "Missing 'url' field"})
                return

            if not url.startswith("http"):
                self._send_json(400, {"error": "URL must start with http:// or https://"})
                return

            max_pages = max(1, int(data.get("pages", 1)))
            follow_pages = bool(data.get("follow_pages", False))

            # Fetch first page
            html = fetch_html(url)
            if not html:
                self._send_json(502, {"error": f"Could not fetch: {url}"})
                return

            all_entries = []
            pages_visited = set()
            pages_to_visit = [url]
            pages_done = 0

            while pages_to_visit and pages_done < max_pages:
                page_url = pages_to_visit.pop(0)
                if page_url in pages_visited:
                    continue
                pages_visited.add(page_url)
                pages_done += 1

                page_html = fetch_html(page_url) if page_url != url else html
                if not page_html:
                    continue

                entries = extract_links_from_master(page_html, page_url)
                all_entries.extend(entries)

                if follow_pages and pages_done < max_pages:
                    for nxt in get_pagination_urls(page_html, page_url):
                        if nxt not in pages_visited:
                            pages_to_visit.append(nxt)

            # Deduplicate
            seen = set()
            unique = []
            for e in all_entries:
                if e["url"] not in seen:
                    seen.add(e["url"])
                    unique.append(e)

            self._send_json(200, {"entries": unique, "total": len(unique)})

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
