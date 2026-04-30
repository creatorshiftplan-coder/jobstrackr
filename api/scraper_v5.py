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


def clean_location(raw: str) -> str:
    """
    Sanitise a location string scraped from HTML.
    Handles garbage like "Hyderabad2812)", "New Delhi 400)", "Mumbai(23", etc.
    """
    if not raw:
        return raw
    s = clean(raw)
    # Remove trailing digits + optional closing paren, e.g. "Hyderabad2812)"
    s = re.sub(r"[\d]+[)]*\s*$", "", s)
    # Remove leading/trailing stray parentheses and digits
    s = re.sub(r"^[\d()]+\s*", "", s)
    # Remove any remaining unmatched parentheses with only numbers inside
    s = re.sub(r"\(\d+\)", "", s)
    # Remove trailing punctuation junk
    s = re.sub(r"[)(/,;]+$", "", s)
    return s.strip() or raw  # fallback to original if everything was stripped


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


_TIME_STRIP_RE = re.compile(
    r"\(?\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*\)?"  # (10:00 AM) or 3:00 PM
    r"|from\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*onwards?"  # from 3:00 PM onwards
    r"|\bfrom\s+\d{1,2}\s*(?:AM|PM|am|pm)\s*onwards?"  # from 3 PM onwards
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

    # Strip time-related text before matching (e.g. "from 3:00 PM onwards", "(10:00 AM)")
    date_text = _TIME_STRIP_RE.sub("", raw).strip()
    if not date_text:
        date_text = raw

    m = _DATE_RE.search(date_text)
    if m:
        if m.group(1):          # "14 March 2026" or "29-04 2026"
            day, mon_str, year = m.group(1), m.group(2).lower()[:3], m.group(3)
            mon = _MONTH_MAP.get(mon_str)
            if mon:
                return f"{year}-{mon}-{int(day):02d}"
            # Handle numeric month (e.g. "29-04 2026" where group(2) is "04")
            try:
                mon_num = int(m.group(2))
                if 1 <= mon_num <= 12:
                    return f"{year}-{mon_num:02d}-{int(day):02d}"
            except (ValueError, TypeError):
                pass
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
_RANGE_RE = re.compile(r"([\d,.]+)\s*[-–to]+\s*([\d,.]+)")
# Matches a number (with optional decimals) followed by a multiplier word
_MULTIPLIER_RE = re.compile(
    r"([\d,.]+)\s*(lakh|lac|lakhs|lacs|l|thousand|k|crore|cr)\b",
    re.I,
)


def _to_int(s: str) -> Optional[int]:
    try:
        return int(s.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def _apply_multiplier(num_str: str, text: str) -> Optional[int]:
    """Parse a number string and apply lakh/thousand/crore multiplier if found near it."""
    try:
        val = float(num_str.replace(",", ""))
    except (ValueError, AttributeError):
        return None
    if val <= 0:
        return None
    # Check if the text following the number contains a multiplier
    t = text.lower()
    m = _MULTIPLIER_RE.search(t)
    if m:
        mult_word = m.group(2).lower()
        mult_val = float(m.group(1).replace(",", ""))
        if mult_word in ("lakh", "lac", "lakhs", "lacs", "l"):
            return int(mult_val * 100_000)
        elif mult_word in ("thousand", "k"):
            return int(mult_val * 1_000)
        elif mult_word in ("crore", "cr"):
            return int(mult_val * 10_000_000)
    return int(val) if val < 10_000_000 else None


def parse_salary(raw: str):
    """
    Returns (salary_min, salary_max, salary_text).
    Tries to extract numeric min/max; salary_text keeps the full original.
    Handles multiplier words: lakh/lac, thousand/K, crore/Cr.
    """
    text = clean(raw)
    if not text or text.lower() in ("n/a", "-", "–", "na"):
        return None, None, None

    lower = text.lower()

    # Check if text contains multiplier words — use multiplier-aware parsing
    has_multiplier = any(w in lower for w in ("lakh", "lac", "lakhs", "lacs", "thousand", "crore"))

    if has_multiplier:
        # Find all number+multiplier pairs
        matches = _MULTIPLIER_RE.findall(text)
        if len(matches) >= 2:
            vals = []
            for num_s, mult_w in matches:
                n = float(num_s.replace(",", ""))
                mw = mult_w.lower()
                if mw in ("lakh", "lac", "lakhs", "lacs", "l"):
                    vals.append(int(n * 100_000))
                elif mw in ("thousand", "k"):
                    vals.append(int(n * 1_000))
                elif mw in ("crore", "cr"):
                    vals.append(int(n * 10_000_000))
            if len(vals) >= 2:
                return min(vals), max(vals), text
            elif vals:
                return vals[0], vals[0], text
        elif len(matches) == 1:
            num_s, mult_w = matches[0]
            n = float(num_s.replace(",", ""))
            mw = mult_w.lower()
            if mw in ("lakh", "lac", "lakhs", "lacs", "l"):
                val = int(n * 100_000)
            elif mw in ("thousand", "k"):
                val = int(n * 1_000)
            elif mw in ("crore", "cr"):
                val = int(n * 10_000_000)
            else:
                val = int(n)
            return val, val, text

    # Try "X - Y" range (no multiplier words)
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
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

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
        vac_raw = ov_get("No of Posts", "Total Posts", "Total Post", "total_post", "total_posts", "Number of Posts", "Total Number of Posts", "Total Number of Post", "Vacancies", "Total Vacancies", "Posts")
        if vac_raw:
            vacancies = [{"total_posts": vac_raw}]

    # ── location ─────────────────────────────────────────────────────────────
    # Source 1: Overview table explicit location fields
    location_raw = ov_get(
        "Location", "Place of Posting", "Job Location", "Work Location",
        "Place of Work", "Posting Location", "State", "City",
    ) or ""

    # Source 2: scan the article body <p> / <li> / <td> for "Location:" label
    if not location_raw:
        LOC_LABEL = re.compile(r"location\s*[:–-]\s*(.+)", re.I)
        for tag in article.find_all(["p", "li", "td"]):
            m = LOC_LABEL.search(clean(tag.get_text()))
            if m:
                candidate = m.group(1).strip().split("|")[0].strip()
                # Reject if it looks like a URL or a long sentence
                if candidate and len(candidate) < 80 and "http" not in candidate:
                    location_raw = candidate
                    break

    # Do NOT use soup.find("a", href=re.compile(r"jobs-in-")) — that always
    # picks up the site-wide sidebar which lists Hyderabad first on every page,
    # causing every article to incorrectly show location = "Hyderabad".

    # Source 3: extract location from the article title (h1 / exam_name)
    # Matches patterns like "AIIMS Jodhpur ...", "IIT Delhi ...", "ESIC Noida ..."
    # Also matches suffix patterns like "... Recruitment Chennai 2026"
    if not location_raw:
        # Known Indian cities and states commonly embedded in job titles
        TITLE_LOCATIONS = [
            "Delhi", "New Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru",
            "Bangalore", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Lucknow",
            "Patna", "Bhopal", "Bhubaneswar", "Chandigarh", "Dehradun",
            "Guwahati", "Jodhpur", "Raipur", "Ranchi", "Shimla", "Srinagar",
            "Thiruvananthapuram", "Trivandrum", "Vijayawada", "Visakhapatnam",
            "Nagpur", "Indore", "Coimbatore", "Surat", "Vadodara", "Agra",
            "Varanasi", "Kanpur", "Noida", "Gurugram", "Gurgaon", "Faridabad",
            "Allahabad", "Prayagraj", "Meerut", "Nashik", "Aurangabad",
            "Amritsar", "Ludhiana", "Jalandhar", "Kochi", "Kozhikode",
            "Madurai", "Tiruchirappalli", "Mysuru", "Mysore", "Hubli",
            "Mangaluru", "Mangalore", "Rajkot", "Jammu", "Leh", "Imphal",
            "Shillong", "Aizawl", "Kohima", "Itanagar", "Agartala", "Gangtok",
            "Panaji", "Goa", "Port Blair",
            # States
            "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
            "Chhattisgarh", "Gujarat", "Haryana", "Himachal Pradesh",
            "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
            "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
            "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
            "Uttar Pradesh", "Uttarakhand", "West Bengal",
        ]
        title_lower = exam_name.lower()
        for loc in TITLE_LOCATIONS:
            # Match as a whole word so "Goa" doesn't match "Bhopal"
            if re.search(r'\b' + re.escape(loc.lower()) + r'\b', title_lower):
                location_raw = loc
                break

    # Source 4: infer location from official website domain for state govt sites
    # e.g. "kerala.gov.in" → "Kerala", "rajasthan.gov.in" → "Rajasthan"
    if not location_raw:
        _ov_website = ov_get(
            "Application Website", "Official Website", "Website", "Apply Online"
        ) or ""
        if _ov_website:
            _domain = _ov_website.lower()
            STATE_DOMAINS = {
                "kerala":        "Kerala",
                "rajasthan":     "Rajasthan",
                "gujarat":       "Gujarat",
                "maharashtra":   "Maharashtra",
                "karnataka":     "Karnataka",
                "tamilnadu":     "Tamil Nadu",
                "tnpsc":         "Tamil Nadu",
                "telangana":     "Telangana",
                "andhra":        "Andhra Pradesh",
                "odisha":        "Odisha",
                "bihar":         "Bihar",
                "bpsc":          "Bihar",
                "punjab":        "Punjab",
                "psssb":         "Punjab",
                "haryana":       "Haryana",
                "hpsc":          "Himachal Pradesh",
                "mpsc":          "Maharashtra",
                "rpsc":          "Rajasthan",
                "uppsc":         "Uttar Pradesh",
                "wbpsc":         "West Bengal",
                "assam":         "Assam",
                "jkpsc":         "Jammu & Kashmir",
                "cgpsc":         "Chhattisgarh",
                "jpsc":          "Jharkhand",
                "gpsc":          "Gujarat",
            }
            for key, state in STATE_DOMAINS.items():
                if key in _domain:
                    location_raw = state
                    break

    location = clean_location(location_raw) or None

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
    sal_raw = ov_get("Salary", "Pay Scale", "Stipend", "Remuneration", "Pay", "CTC", "salary") or ""
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

    # Walk-in interview date → treated as last_date when no apply_end exists.
    # Walk-in jobs have no online form — the walk-in date IS the deadline.
    walkin_date = find_date(
        "walk-in", "walk in", "walkin", "interview date",
        "walk-in date", "walk in date", "date of walk",
    )
    if walkin_date and not apply_end:
        apply_end = walkin_date

    # ── selection process ─────────────────────────────────────────────────────
    sel_elems = get_section_content(article, ["selection", "process"])
    sel_bullets = bullet_list(sel_elems)
    selection_process = sel_bullets if sel_bullets else None

    # ── important links ───────────────────────────────────────────────────────
    links_elems = get_section_content(article, ["important", "link"])
    links_dict  = table_to_links(links_elems)   # {description: href}

    # ── helper: reject any URL that belongs to freejobalert ──────────────────
    def is_external(href: str) -> bool:
        """Return True only if href is an absolute URL with no freejobalert domain."""
        if not href:
            return False
        if not href.startswith("http"):
            return False
        return "freejobalert" not in href.lower()

    # ── helper: find first external link whose description matches hint(s) ───
    def find_external_link(*hints) -> Optional[str]:
        """
        Search the Important Links table dict for a description that contains
        any of the hint strings, and whose href is external (no freejobalert).
        """
        for hint in hints:
            for desc, href in links_dict.items():
                if hint.lower() in desc.lower() and is_external(href):
                    return href
        return None

    # ── STEP 1: Important Links table ────────────────────────────────────────
    notification_pdf = find_external_link(
        "official notification", "notification pdf", "notification", "pdf",
        "advertisement", "advt",
    )
    apply_link = find_external_link(
        "apply online", "apply here", "application form",
        "online application", "register online", "apply now",
    )
    official_website = find_external_link(
        "official website", "official web", "website",
    )

    # ── STEP 2: PDF fallback — scan every <a href="*.pdf"> in article body ───
    if not notification_pdf:
        for a in article.find_all("a", href=re.compile(r"\.pdf", re.I)):
            href = a.get("href", "")
            if not href.startswith("http"):
                href = urljoin(url, href)
            if is_external(href):
                notification_pdf = href
                break

    # ── STEP 3: apply_link fallback — Overview table "Application Website" ───
    if not apply_link:
        ov_site = ov_get(
            "Application Website", "Apply Online", "Official Website",
            "Apply Link", "Application Link", "Online Apply",
        )
        if ov_site and ov_site.startswith("http") and is_external(ov_site):
            apply_link = ov_site

    # ── STEP 4: apply_link fallback — scan all article anchors ───────────────
    #   Look for anchor text that signals an application/registration link
    #   and whose href points outside freejobalert.
    if not apply_link:
        APPLY_KEYWORDS = re.compile(
            r"apply\s*online|apply\s*here|register\s*online|apply\s*now"
            r"|submit\s*application|fill\s*form|online\s*application",
            re.I,
        )
        for a in article.find_all("a", href=True):
            href = a.get("href", "")
            if not href.startswith("http"):
                href = urljoin(url, href)
            anchor_text = clean(a.get_text())
            if APPLY_KEYWORDS.search(anchor_text) and is_external(href):
                apply_link = href
                break

    # ── STEP 5: official_website fallback — Overview table ───────────────────
    if not official_website:
        ov_site = ov_get(
            "Official Website", "Application Website", "Website",
            "Official Web", "Apply Online",
        )
        if ov_site and ov_site.startswith("http") and is_external(ov_site):
            official_website = ov_site

    # ── STEP 6: official_website fallback — derive from apply_link domain ────
    if not official_website and apply_link:
        from urllib.parse import urlparse
        parsed   = urlparse(apply_link)
        official_website = f"{parsed.scheme}://{parsed.netloc}/"

    # ── Make relative URLs absolute ───────────────────────────────────────────
    if notification_pdf and not notification_pdf.startswith("http"):
        notification_pdf = urljoin(url, notification_pdf)
    if apply_link and not apply_link.startswith("http"):
        apply_link = urljoin(url, apply_link)
    if official_website and not official_website.startswith("http"):
        official_website = urljoin(url, official_website)

    # ── Hard freejobalert guard — applied explicitly on every variable ────────
    # This is the final safety net. Each variable is checked independently
    # so there is zero chance of a freejobalert URL slipping through.
    if notification_pdf and "freejobalert" in notification_pdf.lower():
        notification_pdf = None
    if apply_link and "freejobalert" in apply_link.lower():
        apply_link = None
    if official_website and "freejobalert" in official_website.lower():
        official_website = None

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
        "official_website": official_website,
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
