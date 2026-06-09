#!/usr/bin/env python3
"""
Standalone auto-discover script for GitHub Actions.
Fetches top 50 links from freejobalert.com/new-updates/,
scrapes each with scraper_v5, inserts non-duplicates into Supabase.
"""

import os
import sys
from datetime import datetime, timezone

# Add repo root to path so api/ modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.scraper_v3 import fetch_html, extract_links_from_master
from api.scraper_v5 import scrape_url
from api.job_insert_helper import get_supabase_client, insert_job, parse_date_safe

TARGET_URL = "https://www.freejobalert.com/new-updates/"
MAX_LINKS = 50


def main():
    supabase = get_supabase_client()
    start_time = datetime.now(timezone.utc)

    print(f"[{start_time.isoformat()}] Starting auto-discover for {TARGET_URL}")

    # 1. Fetch listing page
    html = fetch_html(TARGET_URL, timeout=30)
    if not html:
        print("ERROR: Failed to fetch listing page")
        sys.exit(1)

    # 2. Extract links
    entries = extract_links_from_master(html, TARGET_URL)
    if not entries:
        print("INFO: No links found on listing page")
        sys.exit(0)

    # Deduplicate and take top N
    seen = set()
    unique = []
    for e in entries:
        url = e.get("url", "").strip()
        if url and url not in seen:
            seen.add(url)
            unique.append(e)
        if len(unique) >= MAX_LINKS:
            break

    print(f"INFO: Discovered {len(unique)} unique links (from {len(entries)} total)")

    # 3. Scrape and insert each
    inserted = 0
    duplicates = 0
    failed = 0
    errors = []

    for idx, entry in enumerate(unique, 1):
        url = entry.get("url", "").strip()
        title_hint = entry.get("title", "")
        print(f"[{idx}/{len(unique)}] Scraping: {url} ({title_hint})")

        try:
            scraped = scrape_url(url)
        except Exception as e:
            print(f"  ERROR scrape: {e}")
            failed += 1
            errors.append({"url": url, "stage": "scrape", "error": str(e)})
            continue

        if not scraped:
            print(f"  WARN: Empty scrape result")
            failed += 1
            errors.append({"url": url, "stage": "scrape", "error": "Empty result"})
            continue

        result = insert_job(supabase, scraped)
        status = result["status"]

        if status == "inserted":
            print(f"  OK inserted (job_id={result.get('job_id')})")
            inserted += 1
        elif status == "duplicate":
            print(f"  SKIP duplicate: {result['title']}")
            duplicates += 1
        else:
            print(f"  ERROR insert: {result.get('error')}")
            failed += 1
            errors.append({"url": url, "stage": "insert", "error": result.get("error", "unknown")})

    latency_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

    # 4. Log to auto_discover_logs
    try:
        supabase.table("auto_discover_logs").insert({
            "jobs_found": len(unique),
            "jobs_inserted": inserted,
            "jobs_duplicate": duplicates,
            "jobs_failed": failed,
            "raw_response": {
                "url": TARGET_URL,
                "discovered": len(unique),
                "inserted": inserted,
                "duplicates": duplicates,
                "failed": failed,
                "errors": errors,
            },
            "latency_ms": latency_ms,
            "is_manual": False,
            "source": "freejobalert_github_actions",
        }).execute()
        print("INFO: Log entry created")
    except Exception as e:
        print(f"WARN: Failed to create log entry: {e}")

    print(f"\nSUMMARY: found={len(unique)} inserted={inserted} dup={duplicates} fail={failed} ({latency_ms}ms)")

    if failed == len(unique) and len(unique) > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
