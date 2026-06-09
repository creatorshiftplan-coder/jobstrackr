#!/usr/bin/env python3
"""Lightweight link-discovery script for local dev (no article scraping)."""
import sys
import os
import json
import argparse

# Add api/ to path so we can import scraper_v3
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from scraper_v3 import fetch_html, extract_links_from_master, get_pagination_urls

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--follow-pages", action="store_true")
    args = parser.parse_args()

    html = fetch_html(args.url)
    if not html:
        print(json.dumps({"error": f"Could not fetch: {args.url}"}))
        sys.exit(1)

    all_entries = []
    visited = set()
    to_visit = [args.url]
    done = 0

    while to_visit and done < args.pages:
        page_url = to_visit.pop(0)
        if page_url in visited:
            continue
        visited.add(page_url)
        done += 1

        page_html = fetch_html(page_url) if page_url != args.url else html
        if not page_html:
            continue

        all_entries.extend(extract_links_from_master(page_html, page_url))

        if args.follow_pages and done < args.pages:
            for nxt in get_pagination_urls(page_html, page_url):
                if nxt not in visited:
                    to_visit.append(nxt)

    # Deduplicate
    seen = set()
    unique = []
    for e in all_entries:
        if e["url"] not in seen:
            seen.add(e["url"])
            unique.append(e)

    print(json.dumps({"entries": unique, "total": len(unique)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
