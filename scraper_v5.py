"""
FreeJobAlert Universal Job Scraper
===================================
Scrapes any job notification article from https://www.freejobalert.com/articles/...
and outputs a structured JSON matching the target schema.

Usage:
    # Single URL
    python freejobalert_scraper.py --url "https://www.freejobalert.com/articles/..."

    # Multiple URLs from a text file (one URL per line)
    python freejobalert_scraper.py --file urls.txt

    # Pipe output to a JSON file
    python freejobalert_scraper.py --url "..." --output results.json

Requirements:
    pip install requests beautifulsoup4 lxml
"""

import re
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

# ─────────────────────────── logging ────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ─────────────────────────── helpers ────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def fetch_html(url: str, timeout: int = 20) -> Optional[str]:
    """Download a page and return its HTML, or None on failure."""
    try:
        resp = SESSION.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        log.error("Failed to fetch %s → %s", url, exc)
        return None


def clean(text: str) -> str:
    """Strip whitespace/NBSP and normalise internal spaces."""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


# ─────────────────────────── date parsing ───────────────────────────────────

# Map short month names (and some aliases) to numeric strings
_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    "january": "01", "february": "02", "march": "03", "april": "04",
    "june": "06", "july": "07", "august": "08", "september": "09",
    "october": "10", "november": "11", "december": "12",
}

_DATE_RE = re.compile(
    r"(\d{1,2})[\s\-/](\w+)[\s\-/](\d{4})"       # 14 March 2026
    r"|(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})"       # 2026-03-14
    r"|(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})"       # 14/03/2026
)


def parse_date(raw: str) -> Optional[str]:
    """
    Try to parse a date string into ISO-8601 (YYYY-MM-DD).
    Returns the original string if it looks tentative/unparseable.
    """
    raw = clean(raw)
    if not raw or raw.lower() in ("n/a", "not mentioned", "-", "–", "na"):
        return None

    # Keep tentative/descriptive dates as-is
    if any(w in raw.lower() for w in ("tentative", "expected", "to be")):
        return raw

    m = _DATE_RE.search(raw)
    if m:
        if m.group(1):          # "14 March 2026"
            day, mon_str, year = m.group(1), m.group(2).lower()[:3], m.group(3)
            mon = _MONTH_MAP.get(mon_str)
            if mon:
                return f"{year}-{mon}-{int(day):02d}"
        elif m.group(4):        # "2026-03-14"
            y, mo, d = m.group(4), m.group(5), m.group(6)
            return f"{y}-{int(mo):02d}-{int(d):02d}"
        elif m.group(7):        # "14/03/2026"
            d, mo, y = m.group(7), m.group(8), m.group(9)
            return f"{y}-{int(mo):02d}-{int(d):02d}"

    # Return the cleaned raw text when it cannot be parsed
    return raw if raw else None


# ─────────────────────────── salary parsing ─────────────────────────────────

_NUM_RE = re.compile(r"[\d,]+")
_RANGE_RE = re.compile(r"([\d,]+)\s*[-–to]+\s*([\d,]+)")


def _to_int(s: str) -> Optional[int]:
    try:
        return int(s.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def parse_salary(raw: str):
    """
    Returns (salary_min, salary_max, salary_text).
    Tries to extract numeric min/max; salary_text keeps the full original.
    """
    text = clean(raw)
    if not text or text.lower() in ("n/a", "-", "–", "na"):
        return None, None, None

    # Try "X - Y" range
    m = _RANGE_RE.search(text)
    if m:
        lo = _to_int(m.group(1))
        hi = _to_int(m.group(2))
        # Sanity: ignore ranges that look like "48480-2000/7-..." bank scale notation
        if lo and hi and hi > lo and hi < 10_000_000:
            return lo, hi, text

    # Single value: e.g. "₹30,000 per month"
    nums = _NUM_RE.findall(text)
    if nums:
        val = _to_int(nums[0])
        if val and val < 10_000_000:
            return val, val, text

    return None, None, text


# ─────────────────────────── fee parsing ────────────────────────────────────

def parse_fees(elements) -> Optional[list]:
    """
    Scrape the Application Fee table exactly as it appears on the page.
    Returns a list of {"category": <exact text>, "fee": <exact text>} dicts,
    one entry per data row.  Header rows are automatically skipped.
    Returns None if no fee table is found or the section is absent.
    """
    entries = []
    for el in elements:
        table = el if el.name == "table" else el.find("table")
        if not table:
            continue
        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            col0 = clean(cells[0].get_text())
            col1 = clean(cells[1].get_text())
            # Skip pure-header rows (both <th>) or empty rows
            if cells[0].name == "th" and cells[1].name == "th":
                continue
            if not col0 or not col1:
                continue
            # Skip rows that are themselves column-name headers
            if col0.lower() in ("category", "sl no", "s.no", "sr no", "sno") and \
               col1.lower() in ("fee", "amount", "application fee", "charges"):
                continue
            entries.append({"category": col0, "fee": col1})
        if entries:
            break  # only parse the first matching fee table
    return entries if entries else None



# ─────────────────────────── age parsing ────────────────────────────────────

def parse_age(text: str):
    """Return (age_min, age_max, age_limit_text) from a block of age-limit text."""
    if not text:
        return None, None, None

    ct = clean(text)

    # Strategy 1: "Max X years" / "Minimum X years" / "X to Y years" / "between X and Y"
    explicit = re.findall(
        r"(?:max(?:imum)?|min(?:imum)?|upto|up\s*to|between|age[:\s]*)\s*(\d{1,2})\s*(?:years?|yrs?)?",
        ct, re.I,
    )
    range_match = re.search(r"\b(\d{1,2})\s*(?:to|[-–])\s*(\d{1,2})\s*(?:years?|yrs?)", ct, re.I)

    ages = []
    if range_match:
        ages = [int(range_match.group(1)), int(range_match.group(2))]
    elif explicit:
        ages = [int(n) for n in explicit if 15 <= int(n) <= 70]

    # Strategy 2: Any standalone age-looking number NOT adjacent to a month name
    # (avoids extracting "31" from "31-Oct-2009")
    if not ages:
    # Remove date-like patterns: "01-Dec-2004", "31 Oct 2009", "01/May/2009"
        cleaned_dates = re.sub(
            r"\b\d{1,2}[\s\-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s\-/]\s*\d{4}\b",
            "", ct, flags=re.I,
        )
        cleaned_dates = re.sub(r"\b\d{4}\b", "", cleaned_dates)  # remove years
        ages = [int(n) for n in re.findall(r"\b(\d{2})\b", cleaned_dates)
                if 15 <= int(n) <= 70]

    if not ages:
        return None, None, ct

    return min(ages), max(ages), ct


# ─────────────────────────── HTML section parser ─────────────────────────────

def get_section_content(soup: BeautifulSoup, heading_keywords: list[str]):
    """
    Find the first <h2> whose text contains all given keywords (case-insensitive)
    and return all sibling elements until the next <h2> or article end.
    """
    for h2 in soup.find_all("h2"):
        h2_text = clean(h2.get_text()).lower()
        if all(kw.lower() in h2_text for kw in heading_keywords):
            siblings = []
            for sib in h2.find_next_siblings():
                if sib.name == "h2":
                    break
                siblings.append(sib)
            return siblings
    return []


def table_to_rows(elements) -> list[tuple[str, str]]:
    """Extract (col1, col2) rows from the first <table> in a list of elements."""
    rows = []
    for el in elements:
        table = el if el.name == "table" else el.find("table")
        if not table:
            continue
        for tr in table.find_all("tr"):
            tds = tr.find_all(["td", "th"])
            if len(tds) >= 2:
                rows.append((clean(tds[0].get_text()), clean(tds[1].get_text())))
        break  # only first table
    return rows


def table_to_kv(elements) -> dict:
    """Return a dict from a 2-column key/value table."""
    return {k: v for k, v in table_to_rows(elements) if k and v}


def elements_text(elements) -> str:
    """Concatenate text from a list of BeautifulSoup elements."""
    parts = []
    for el in elements:
        t = clean(el.get_text())
        if t:
            parts.append(t)
    return " | ".join(parts)


def bullet_list(elements) -> list[str]:
    """Extract bullet-point text from <ul><li> elements."""
    items = []
    for el in elements:
        for li in el.find_all("li"):
            t = clean(li.get_text())
            if t:
                items.append(t)
    return items


def table_to_links(elements) -> dict:
    """Extract {description: url} from the Important Links table by reading <a href> per row."""
    result = {}
    for el in elements:
        table = el if el.name == "table" else el.find("table")
        if not table:
            continue
        for tr in table.find_all("tr"):
            tds = tr.find_all(["td", "th"])
            if len(tds) >= 2:
                desc = clean(tds[0].get_text())
                a_tag = tds[1].find("a", href=True)
                if a_tag and a_tag.get("href"):
                    href = a_tag["href"].strip()
                    if href and not href.startswith("#"):
                        result[desc] = href
        if result:
            break
    return result
    """Return the first <a href> whose visible text contains the hint."""
    hint = link_text_hint.lower()
    for el in elements:
        for a in el.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith("#"):
                continue
            label = clean(a.get_text()).lower()
            if hint in label or not hint:
                return href
    return None


# ─────────────────────────── main parser ────────────────────────────────────

def parse_page(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    # ── article body ────────────────────────────────────────────────────────
    # FreeJobAlert wraps the main article in a <div class="...entry-content...">
    # Fallback to full body if not found.
    article = (
        soup.find("div", class_=re.compile(r"entry.content|post.content|article.content", re.I))
        or soup.find("article")
        or soup.body
    )

    # ── exam_name (H1) ──────────────────────────────────────────────────────
    h1 = article.find("h1") or soup.find("h1")
    exam_name = clean(h1.get_text()) if h1 else clean(soup.title.get_text()) if soup.title else ""

    # ── description (first non-empty paragraph after h1) ───────────────────
    description = ""
    if h1:
        for sib in h1.find_next_siblings():
            if sib.name == "p":
                t = clean(sib.get_text())
                if t and len(t) > 30:
                    description = t
                    break
            if sib.name in ("h2", "table"):
                break

    # ── Overview table ───────────────────────────────────────────────────────
    ov_elems = get_section_content(article, ["overview"])
    ov_kv = table_to_kv(ov_elems)

    # Normalise overview keys (lowercase, no spaces)
    ov_norm = {re.sub(r"\s+", "_", k.lower().strip("* ")): v for k, v in ov_kv.items()}

    def ov_get(*keys) -> Optional[str]:
        for k in keys:
            k_norm = re.sub(r"\s+", "_", k.lower())
            val = ov_norm.get(k_norm)
            if val:
                return val
        return None

    # ── agency ───────────────────────────────────────────────────────────────
    agency = ov_get(
        "Company Name", "Conducting Authority", "Recruitment Board",
        "Organization", "Organisation", "Department", "Board",
    ) or ""
    # Fallback: infer from exam name
    if not agency:
        m = re.match(r"^([\w\s]+?)(?:Recruitment|Jobs|Vacancy|Notification)", exam_name)
        if m:
            agency = clean(m.group(1))

    # ── vacancies — raw table exactly as on the page ─────────────────────────
    vac_elems = get_section_content(article, ["vacancy", "detail"])
    if not vac_elems:
        vac_elems = get_section_content(article, ["vacancies"])
    if not vac_elems:
        vac_elems = get_section_content(article, ["post", "detail"])

    vacancies = None
    if vac_elems:
        vac_entries = []
        for el in vac_elems:
            table = el if el.name == "table" else el.find("table")
            if not table:
                continue
            # Collect header from first <th> row if present
            headers = []
            all_rows = table.find_all("tr")
            for tr in all_rows:
                ths = tr.find_all("th")
                if ths:
                    headers = [clean(th.get_text()) for th in ths]
                    break

            for tr in all_rows:
                tds = tr.find_all("td")
                if not tds:
                    continue  # skip header rows
                row_vals = [clean(td.get_text()) for td in tds]
                # Skip empty or divider rows
                if not any(row_vals):
                    continue
                if headers and len(headers) == len(row_vals):
                    vac_entries.append(dict(zip(headers, row_vals)))
                elif len(row_vals) >= 2:
                    # No headers — use first cell as post_name, second as total
                    vac_entries.append({
                        "post_name": row_vals[0],
                        "total_posts": row_vals[1],
                        **({f"col_{i+2}": v for i, v in enumerate(row_vals[2:])} if len(row_vals) > 2 else {})
                    })
                elif len(row_vals) == 1:
                    vac_entries.append({"post_name": row_vals[0]})
            if vac_entries:
                break  # first matching table only

        vacancies = vac_entries if vac_entries else None

    # Fallback: if no vacancy section found, check overview "No of Posts"
    if not vacancies:
        vac_raw = ov_get("No of Posts", "Total Posts", "Number of Posts", "Vacancies", "Total Vacancies", "Posts")
        if vac_raw:
            vacancies = [{"total_posts": vac_raw}]

    # ── location ─────────────────────────────────────────────────────────────
    location_raw = ov_get("Location", "Place of Posting", "Job Location", "Work Location") or ""
    if not location_raw:
        # Try to infer from URL or tags in the page
        loc_tag = soup.find("a", href=re.compile(r"jobs-in-", re.I))
        if loc_tag:
            location_raw = clean(loc_tag.get_text()).replace(" Jobs", "").replace(" (", "").strip()
    location = location_raw or "India"

    # ── job/employment type ──────────────────────────────────────────────────
    job_type_raw = ov_get("Job Type", "Employment Type", "Type") or ""
    if "full" in job_type_raw.lower():
        employment_type = "FULL_TIME"
    elif "part" in job_type_raw.lower():
        employment_type = "PART_TIME"
    elif "contract" in job_type_raw.lower():
        employment_type = "CONTRACT"
    elif "intern" in job_type_raw.lower():
        employment_type = "INTERNSHIP"
    else:
        employment_type = "FULL_TIME"  # default for govt jobs

    job_type = ov_get("Job Type") or None

    # ── qualification / eligibility ──────────────────────────────────────────
    elig_raw = ov_get("Qualification", "Educational Qualification", "Education Qualification",
                      "Education", "Eligibility")
    if not elig_raw:
        elig_elems = get_section_content(article, ["eligibility"])
        bullets = bullet_list(elig_elems)
        elig_raw = " | ".join(bullets) if bullets else elements_text(elig_elems)
    eligibility = elig_raw or None

    # ── salary ───────────────────────────────────────────────────────────────
    sal_raw = ov_get("Salary", "Pay Scale", "Stipend", "Remuneration", "Pay", "CTC") or ""
    if not sal_raw:
        sal_elems = get_section_content(article, ["salary"])
        sal_raw = elements_text(sal_elems)
    salary_min, salary_max, salary_text = parse_salary(sal_raw)

    # ── age limit ─────────────────────────────────────────────────────────────
    age_raw_ov = ov_get("Age Limit", "Age Criteria", "Age", "Age Criteria (INET 2026)") or ""
    age_elems = get_section_content(article, ["age", "limit"])
    age_block = elements_text(age_elems) if age_elems else ""
    combined_age = (age_raw_ov + " " + age_block).strip()
    age_min, age_max, age_limit_text = parse_age(combined_age)

    # ── application fee ───────────────────────────────────────────────────────
    fee_elems = get_section_content(article, ["application", "fee"])
    application_fees = parse_fees(fee_elems)

    # ── important dates ───────────────────────────────────────────────────────
    dates_elems = get_section_content(article, ["important", "date"])
    dates_rows = table_to_rows(dates_elems)
    dates_dict: dict = {}
    for event, date_str in dates_rows:
        dates_dict[event] = parse_date(date_str)

    # Map to schema keys
    def find_date(*hints) -> Optional[str]:
        for hint in hints:
            for event, val in dates_dict.items():
                if hint.lower() in event.lower():
                    return val
        return None

    apply_start = find_date("application start", "opening date", "start date", "apply start", "online registration", "application open")
    apply_end = find_date("application last", "closing date", "last date", "apply end", "last date to apply", "end date", "closing")
    exam_date_str = find_date("exam date", "examination", "test date", "inet", "written exam")
    advertised_on = find_date("advertised", "notification date", "published", "notification out")

    # Fallback last_date from overview
    last_date_ov = ov_get("Last Date", "Application Last Date", "Apply Last Date")
    if not apply_end and last_date_ov:
        apply_end = parse_date(last_date_ov)

    # ── selection process ─────────────────────────────────────────────────────
    sel_elems = get_section_content(article, ["selection", "process"])
    sel_bullets = bullet_list(sel_elems)
    selection_process = sel_bullets if sel_bullets else None

    # ── important links ───────────────────────────────────────────────────────
    links_elems = get_section_content(article, ["important", "link"])
    links_dict = table_to_links(links_elems)

    def find_link(*hints) -> Optional[str]:
        for hint in hints:
            for desc_text, href in links_dict.items():
                if hint.lower() in desc_text.lower() and href:
                    return href
        return None

    notification_pdf = find_link("notification", "official notification", "pdf")
    apply_link = find_link("apply online", "apply here", "application form", "online application")

    # If not found via table, scan raw HTML for .pdf links
    if not notification_pdf:
        for a in article.find_all("a", href=re.compile(r"\.pdf", re.I)):
            href = a["href"]
            if "notification" in href.lower() or "advt" in href.lower() or "advertisement" in href.lower():
                notification_pdf = href
                break
        if not notification_pdf:
            pdfs = article.find_all("a", href=re.compile(r"\.pdf", re.I))
            if pdfs:
                notification_pdf = pdfs[0]["href"]

    # Make absolute URLs
    if notification_pdf and not notification_pdf.startswith("http"):
        notification_pdf = urljoin(url, notification_pdf)
    if apply_link and not apply_link.startswith("http"):
        apply_link = urljoin(url, apply_link)

    # ── overview dict ──────────────────────────────────────────────────────────
    overview_obj: dict = {}
    for k, v in ov_kv.items():
        if k and v and k.lower() not in ("link", "apply mode"):
            key_snake = re.sub(r"[^\w]+", "_", k.lower()).strip("_")
            overview_obj[key_snake] = v
    if not overview_obj:
        overview_obj = None

    # ── last_date (top-level) – best available ─────────────────────────────────
    last_date = apply_end or last_date_ov or None

    # ── build final job dict ──────────────────────────────────────────────────
    job = {
        "exam_name": exam_name,
        "agency": agency,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_text": salary_text if salary_text != salary_min else None,
        "location": location,
        "last_date": last_date,
        "exam_date": exam_date_str,
        "age_min": age_min,
        "age_max": age_max,
        "age_limit_text": age_limit_text,
        "vacancies": vacancies,
        "eligibility": eligibility,
        "application_fees": application_fees,
        "job_type": job_type,
        "employment_type": employment_type,
        "description": description or None,
        "requirements": None,           # not consistently present
        "highlights": None,             # not consistently present
        "selection_process": selection_process,
        "important_dates": {
            "advertised_on": advertised_on,
            "apply_start": apply_start,
            "apply_end": apply_end,
            "exam_date": exam_date_str,
        },
        "overview": overview_obj,
        "official_apply_link": apply_link,
        "notification_pdf": notification_pdf,
    }

    return job


# ─────────────────────────── public API ─────────────────────────────────────

def scrape_url(url: str) -> Optional[dict]:
    """Scrape a single FreeJobAlert article URL and return the job dict."""
    log.info("Scraping → %s", url)
    html = fetch_html(url)
    if not html:
        return None
    try:
        return parse_page(url, html)
    except Exception as exc:
        log.error("Parse error for %s: %s", url, exc, exc_info=True)
        return None


def scrape_urls(urls: list[str]) -> dict:
    """Scrape multiple URLs and return {"jobs": [...]}."""
    jobs = []
    for url in urls:
        url = url.strip()
        if url and url.startswith("http"):
            result = scrape_url(url)
            if result:
                jobs.append(result)
    return {"jobs": jobs}


# ─────────────────────────── CLI ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Universal FreeJobAlert scraper – outputs structured JSON."
    )
    parser.add_argument("--url", action="append", default=[], help="Article URL to scrape (can be repeated)")
    parser.add_argument("--file", help="Text file with one URL per line")
    parser.add_argument("--output", help="Write JSON output to this file")
    args = parser.parse_args()

    urls = list(args.url)  # already a list from action="append"
    if args.file:
        with open(args.file, "r") as f:
            urls.extend(f.readlines())

    if not urls:
        parser.print_help()
        sys.exit(1)

    result = scrape_urls(urls)
    output_json = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        log.info("Saved %d job(s) → %s", len(result["jobs"]), args.output)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
