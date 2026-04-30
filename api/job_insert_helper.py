"""
Shared helper for inserting scraped jobs into Supabase from Vercel cron jobs.
Handles duplicate checks, date parsing, and record building.
"""

import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

from supabase import create_client
from api.scraper_v5 import parse_date


def get_supabase_client():
    """Create Supabase client with service role key."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    return create_client(url, key)


def _strip_time_text(value: str) -> str:
    """Strip time-related text from raw date strings."""
    cleaned = re.sub(r"\n", " ", value).strip()
    cleaned = re.sub(
        r"\(?\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*\)?",
        "",
        cleaned,
    )
    cleaned = re.sub(
        r"from\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*onwards?",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip() or value


def parse_date_safe(raw: str | None) -> str:
    """
    Parse a scraped date string into ISO YYYY-MM-DD.
    Falls back to 1 year from today for unparseable/TBD values.
    """
    if not raw or str(raw).lower() in ("n/a", "not mentioned", "-", "na", "nil"):
        return (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")

    tbd = ["tbd", "to be announced", "walk in", "walk-in", "walkin",
           "not available", "not applicable", "various", "multiple", "as per rules"]
    if any(p in str(raw).lower() for p in tbd):
        return (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")

    # Try scraper_v5 parse_date first (handles DD/MM/YYYY, named months, etc.)
    parsed = parse_date(raw)
    if parsed and re.match(r"^\d{4}-\d{2}-\d{2}$", parsed):
        return parsed

    # Manual DD/MM/YYYY fallback
    cleaned = _strip_time_text(str(raw))
    dmy = re.match(r"^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$", cleaned)
    if dmy:
        return f"{dmy.group(3)}-{int(dmy.group(2)):02d}-{int(dmy.group(1)):02d}"

    dmy_space = re.match(r"^(\d{1,2})[\/\-](\d{1,2})\s+(\d{4})$", cleaned)
    if dmy_space:
        return f"{dmy_space.group(3)}-{int(dmy_space.group(2)):02d}-{int(dmy_space.group(1)):02d}"

    # Try native date parse
    try:
        d = datetime.strptime(cleaned, "%d %B %Y")
        return d.strftime("%Y-%m-%d")
    except ValueError:
        pass

    try:
        d = datetime.strptime(cleaned, "%d %b %Y")
        return d.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Unparseable — future date so job stays active
    return (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")


def is_duplicate_by_title(supabase, title: str) -> bool:
    """Check if a job with a similar title already exists."""
    try:
        result = (
            supabase.table("jobs")
            .select("id", count="exact")
            .ilike("title", title)
            .limit(1)
            .execute()
        )
        return result.count is not None and result.count > 0
    except Exception:
        # Fail open: if we can't check, assume not duplicate to avoid data loss
        return False


def build_job_record(scraped: dict) -> dict[str, Any]:
    """Build a jobs table insert record from scraper_v5 output."""
    r = scraped

    # Vacancies
    total_vacancies = None
    vacancies_display = "Not Found"
    if r.get("vacancies") and isinstance(r["vacancies"], list) and len(r["vacancies"]) > 0:
        total_row = next(
            (v for v in r["vacancies"]
             if any(isinstance(val, str) and "total" in val.lower()
                    for val in v.values())),
            None,
        )
        if total_row:
            nums = [
                int(re.sub(r"[^0-9]", "", str(v)))
                for v in total_row.values()
                if str(v) and re.sub(r"[^0-9]", "", str(v)).isdigit()
            ]
            if nums:
                total_vacancies = max(nums)
    if not total_vacancies and r.get("overview", {}).get("total_vacancies"):
        tv = re.sub(r"[^0-9]", "", str(r["overview"]["total_vacancies"]))
        if tv.isdigit():
            total_vacancies = int(tv)
    if total_vacancies:
        vacancies_display = f"{total_vacancies} Posts"

    # Application fee
    app_fee = 0
    if r.get("application_fees") and isinstance(r["application_fees"], list):
        fees = []
        for f in r["application_fees"]:
            if isinstance(f, dict) and "fee" in f:
                num = re.sub(r"[^0-9]", "", str(f["fee"]))
                if num.isdigit():
                    fees.append(int(num))
        if fees:
            app_fee = max(fees)

    # Dates
    last_date_raw = r.get("last_date")
    last_date = parse_date_safe(last_date_raw)
    last_date_display = last_date_raw or None

    apply_start_raw = None
    if r.get("important_dates") and isinstance(r["important_dates"], dict):
        apply_start_raw = r["important_dates"].get("apply_start")
    application_start_date = parse_date_safe(apply_start_raw) if apply_start_raw else None

    # Location cleanup
    def clean_loc(loc: str | None) -> str:
        if not loc:
            return "India"
        s = loc.strip()
        s = re.sub(r"[\d]+[)]*\s*$", "", s)
        s = re.sub(r"^\s*[\d()]+\s*", "", s)
        s = re.sub(r"\(\d+\)", "", s)
        s = re.sub(r"[)(/,;]+$", "", s)
        return s.strip() or loc.strip() or "India"

    # Metadata
    metadata: dict[str, Any] = {}
    if r.get("salary_text"):
        metadata["salary_text"] = r["salary_text"]
    if r.get("age_limit_text"):
        metadata["age_limit_text"] = r["age_limit_text"]
    if r.get("vacancies") and isinstance(r["vacancies"], list):
        metadata["vacancies_detail"] = r["vacancies"]
    if r.get("application_fees") and isinstance(r["application_fees"], list):
        metadata["application_fees"] = r["application_fees"]
    if r.get("selection_process") and isinstance(r["selection_process"], list):
        metadata["selection_process"] = r["selection_process"]
    if r.get("important_dates") and isinstance(r["important_dates"], dict):
        metadata["important_dates"] = r["important_dates"]
    if r.get("overview") and isinstance(r["overview"], dict):
        metadata["overview"] = r["overview"]
    if r.get("notification_pdf"):
        metadata["notification_pdf"] = r["notification_pdf"]
    if r.get("employment_type"):
        metadata["employment_type"] = r["employment_type"]
    if r.get("exam_date"):
        metadata["exam_date"] = r["exam_date"]
    if r.get("official_website"):
        metadata["official_website"] = r["official_website"]

    record = {
        "title": r.get("exam_name") or "Untitled Job",
        "department": r.get("agency") or "Unknown",
        "location": clean_loc(r.get("location")),
        "qualification": r.get("eligibility") or "As per notification",
        "experience": "",
        "eligibility": r.get("eligibility") or None,
        "description": r.get("description") or None,
        "salary_min": r.get("salary_min") or None,
        "salary_max": r.get("salary_max") or None,
        "age_min": r.get("age_min") or None,
        "age_max": r.get("age_max") or None,
        "application_fee": app_fee,
        "vacancies": total_vacancies,
        "vacancies_display": vacancies_display,
        "application_start_date": application_start_date,
        "last_date": last_date,
        "last_date_display": last_date_display,
        "apply_link": r.get("official_apply_link") or None,
        "official_website": r.get("official_website") or None,
        "is_featured": False,
        "auto_discovered": True,
        "job_metadata": metadata if metadata else None,
    }
    return record


def insert_job(supabase, scraped: dict) -> dict:
    """
    Insert a scraped job into the DB if not duplicate.
    Returns dict with status, job_id, and any error.
    """
    record = build_job_record(scraped)
    title = record["title"]

    if is_duplicate_by_title(supabase, title):
        return {"status": "duplicate", "title": title, "error": None}

    try:
        result = supabase.table("jobs").insert(record).select("id").execute()
        job_id = result.data[0]["id"] if result.data else None
        return {"status": "inserted", "title": title, "job_id": job_id, "error": None}
    except Exception as e:
        return {"status": "error", "title": title, "error": str(e)}
