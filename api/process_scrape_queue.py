"""
Vercel Cron — Process Phase
============================
Runs every 10 minutes.
Picks up to BATCH_SIZE pending URLs from scrape_queue,
scrapes each with scraper_v5, inserts non-duplicates into jobs,
updates queue status, logs results.

POST /api/process-scrape-queue
(Triggered by Vercel cron.)
"""

import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

from api.scraper_v5 import scrape_url
from api.job_insert_helper import get_supabase_client, insert_job

BATCH_SIZE = 10  # Max jobs to process per invocation
MAX_RETRIES = 3


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

            # 1. Fetch pending URLs
            result = (
                supabase.table("scrape_queue")
                .select("id, url, retry_count")
                .eq("status", "pending")
                .order("discovered_at", desc=False)
                .limit(BATCH_SIZE)
                .execute()
            )
            items = result.data or []
            if not items:
                _json_response(self, 200, {
                    "status": "ok",
                    "processed": 0,
                    "message": "No pending items in queue",
                })
                return

            processed = 0
            inserted = 0
            duplicates = 0
            failed = 0
            errors = []

            for item in items:
                qid = item["id"]
                url = item["url"]
                retries = item.get("retry_count", 0)

                # Mark as processing
                try:
                    supabase.table("scrape_queue").update({
                        "status": "processing",
                    }).eq("id", qid).execute()
                except Exception as e:
                    print(f"[process-queue] Failed to mark processing {qid}: {e}")
                    failed += 1
                    errors.append({"url": url, "stage": "mark_processing", "error": str(e)})
                    continue

                # Scrape
                try:
                    scraped = scrape_url(url)
                except Exception as e:
                    print(f"[process-queue] Scrape error for {url}: {e}")
                    failed += 1
                    new_status = "failed" if retries + 1 >= MAX_RETRIES else "pending"
                    try:
                        supabase.table("scrape_queue").update({
                            "status": new_status,
                            "retry_count": retries + 1,
                            "error": str(e)[:500],
                        }).eq("id", qid).execute()
                    except Exception:
                        pass
                    errors.append({"url": url, "stage": "scrape", "error": str(e)})
                    continue

                if not scraped:
                    # Scrape returned None (unreachable or unexpected format)
                    failed += 1
                    new_status = "failed" if retries + 1 >= MAX_RETRIES else "pending"
                    try:
                        supabase.table("scrape_queue").update({
                            "status": new_status,
                            "retry_count": retries + 1,
                            "error": "scrape returned None",
                        }).eq("id", qid).execute()
                    except Exception:
                        pass
                    errors.append({"url": url, "stage": "scrape", "error": "Empty result"})
                    continue

                # Insert into DB
                insert_result = insert_job(supabase, scraped)

                if insert_result["status"] == "duplicate":
                    duplicates += 1
                    try:
                        supabase.table("scrape_queue").update({
                            "status": "completed",
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "error": "duplicate",
                        }).eq("id", qid).execute()
                    except Exception:
                        pass
                elif insert_result["status"] == "error":
                    failed += 1
                    new_status = "failed" if retries + 1 >= MAX_RETRIES else "pending"
                    try:
                        supabase.table("scrape_queue").update({
                            "status": new_status,
                            "retry_count": retries + 1,
                            "error": insert_result["error"][:500],
                        }).eq("id", qid).execute()
                    except Exception:
                        pass
                    errors.append({"url": url, "stage": "insert", "error": insert_result["error"]})
                else:
                    inserted += 1
                    job_id = insert_result.get("job_id")
                    try:
                        supabase.table("scrape_queue").update({
                            "status": "completed",
                            "processed_at": datetime.now(timezone.utc).isoformat(),
                            "job_id": job_id,
                        }).eq("id", qid).execute()
                    except Exception:
                        pass

                processed += 1

            latency_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

            # Log batch results
            try:
                supabase.table("auto_discover_logs").insert({
                    "jobs_found": processed,
                    "jobs_inserted": inserted,
                    "jobs_duplicate": duplicates,
                    "jobs_failed": failed,
                    "raw_response": {
                        "batch_size": len(items),
                        "processed": processed,
                        "inserted": inserted,
                        "duplicates": duplicates,
                        "failed": failed,
                        "errors": errors,
                    },
                    "latency_ms": latency_ms,
                    "is_manual": False,
                    "source": "freejobalert_process",
                }).execute()
            except Exception as e:
                print(f"[process-queue] Log insert warning: {e}")

            _json_response(self, 200, {
                "status": "ok",
                "batch_size": len(items),
                "processed": processed,
                "inserted": inserted,
                "duplicates": duplicates,
                "failed": failed,
                "latency_ms": latency_ms,
            })

        except Exception as e:
            print(f"[process-queue] Fatal error: {e}")
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
