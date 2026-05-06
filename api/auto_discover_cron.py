"""
Vercel Cron — Discover Phase
============================
Runs at 01:00 UTC daily.
Fetches https://www.freejobalert.com/new-updates/, extracts top 50 job links,
stores them in scrape_queue for the process phase to consume.

POST /api/auto-discover-cron
(Triggered by Vercel cron; also callable manually for testing.)
"""

import json
import os
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

from api.scraper_v3 import fetch_html, extract_links_from_master
from api.job_insert_helper import get_supabase_client

TARGET_URL = "https://www.freejobalert.com/new-updates/"
MAX_LINKS = 50


def _json_response(handler, status_code: int, data: dict):
    body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        start_time = datetime.now(timezone.utc)
        try:
            supabase = get_supabase_client()

            # 1. Fetch the listing page
            html = fetch_html(TARGET_URL, timeout=30)
            if not html:
                _json_response(self, 502, {
                    "status": "error",
                    "error": f"Could not fetch listing page: {TARGET_URL}"
                })
                return

            # 2. Extract links (newest first on freejobalert)
            entries = extract_links_from_master(html, TARGET_URL)
            if not entries:
                _json_response(self, 200, {
                    "status": "ok",
                    "discovered": 0,
                    "queued": 0,
                    "message": "No links found on listing page"
                })
                return

            # Deduplicate by URL and take top N
            seen = set()
            unique = []
            for e in entries:
                url = e.get("url", "").strip()
                if url and url not in seen:
                    seen.add(url)
                    unique.append(e)
                if len(unique) >= MAX_LINKS:
                    break

            # 3. Clear stale queue entries (> 24 h old pending/processing)
            cutoff = (start_time - timedelta(hours=24)).isoformat()
            try:
                supabase.table("scrape_queue").delete().lt("discovered_at", cutoff).execute()
            except Exception as e:
                # Non-fatal: stale cleanup failure shouldn't block new discovery
                print(f"[auto-discover-cron] Stale cleanup warning: {e}")

            # 4. Insert into queue
            queued = 0
            skipped = 0
            for e in unique:
                url = e.get("url", "").strip()
                if not url:
                    continue
                # Skip if already pending/completed for this exact URL today
                try:
                    existing = (
                        supabase.table("scrape_queue")
                        .select("id", count="exact")
                        .eq("url", url)
                        .gte("discovered_at", (start_time - timedelta(hours=24)).isoformat())
                        .execute()
                    )
                    if existing.count and existing.count > 0:
                        skipped += 1
                        continue
                except Exception:
                    pass

                try:
                    supabase.table("scrape_queue").insert({
                        "url": url,
                        "source": "freejobalert",
                        "status": "pending",
                        "discovered_at": start_time.isoformat(),
                    }).execute()
                    queued += 1
                except Exception as err:
                    print(f"[auto-discover-cron] Queue insert error for {url}: {err}")

            latency_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

            # 5. Log discovery
            try:
                supabase.table("auto_discover_logs").insert({
                    "jobs_found": len(unique),
                    "jobs_inserted": 0,
                    "jobs_duplicate": 0,
                    "jobs_failed": 0,
                    "raw_response": {
                        "url": TARGET_URL,
                        "discovered": len(unique),
                        "queued": queued,
                        "skipped": skipped,
                    },
                    "latency_ms": latency_ms,
                    "is_manual": False,
                    "source": "freejobalert_cron",
                }).execute()
            except Exception as e:
                print(f"[auto-discover-cron] Log insert warning: {e}")

            _json_response(self, 200, {
                "status": "ok",
                "discovered": len(unique),
                "queued": queued,
                "skipped": skipped,
                "latency_ms": latency_ms,
            })

        except Exception as e:
            print(f"[auto-discover-cron] Fatal error: {e}")
            _json_response(self, 500, {
                "status": "error",
                "error": str(e),
            })

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
