"""
FreeJobAlert Universal Job Scraper
===================================
Scrapes job notification articles from https://www.freejobalert.com/
and outputs structured JSON matching the target schema.

THREE MODES
───────────

1. MASTER PAGE  (recommended — auto-discovers all article links)
   Provide any listing/index page URL. The scraper will:
     a) Parse every <tr class="edthr"> row (the "Get Details" links)
     b) Scrape each article and output numbered JSON results

   python freejobalert_scraper.py \\
       --master "https://www.freejobalert.com/new-updates/" \\
       --limit  10          # scrape first 10 articles only (0 = all)
       --pages  3           # walk up to 3 listing pages
       --follow-pages       # auto-follow pagination
       --delay  1.5         # seconds between requests
       --format numbered    # numbered | array | ndjson
       --output results.json

2. DIRECT URL(S)  (one or more specific articles)
   python freejobalert_scraper.py \\
       --url "https://www.freejobalert.com/articles/..." \\
       --url "https://www.freejobalert.com/articles/..."

3. URL FILE  (plain text, one URL per line)
   python freejobalert_scraper.py --file urls.txt --output out.json

OUTPUT FORMATS
──────────────
  numbered  (default)  Labelled blocks:  // ── JSON Result 1 ──
  array                {"jobs": [...]}  standard JSON array
  ndjson               One JSON object per line

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

    location = location_raw or None

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


# ─────────────────────────── master-page link extractor ─────────────────────

def extract_links_from_master(html: str, base_url: str) -> list[dict]:
    """
    Parse a FreeJobAlert listing/master page and return all article links
    found inside  <tr class="edthr"> rows.

    Each entry is:
        {
            "update_date":   "16/03/2026",          # raw text from col-1
            "title":         "India Optel 77 ...",  # raw text from col-2
            "url":           "https://www.freejobalert.com/articles/..."
        }

    The function also handles multi-page listings: if the page contains
    pagination links (class="disp_inblock") it collects them so the caller
    can decide whether to follow them.
    """
    soup = BeautifulSoup(html, "lxml")
    entries = []
    seen_urls: set[str] = set()

    for tr in soup.find_all("tr", class_="edthr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue

        update_date = clean(tds[0].get_text())
        title       = clean(tds[1].get_text())

        # The 3rd cell always holds the "Get Details" anchor
        a_tag = tds[2].find("a", href=True)
        if not a_tag:
            continue

        href = a_tag["href"].strip()
        if not href.startswith("http"):
            href = urljoin(base_url, href)

        if href in seen_urls:
            continue
        seen_urls.add(href)

        entries.append({
            "update_date": update_date,
            "title":       title,
            "url":         href,
        })

    return entries


def get_pagination_urls(html: str, base_url: str) -> list[str]:
    """
    Return all paginated page URLs found in the listing page
    (li.disp_inblock > a href) — excluding the active/current page.
    """
    soup = BeautifulSoup(html, "lxml")
    urls = []
    for li in soup.find_all("li", class_="disp_inblock"):
        if "active" in li.get("class", []):
            continue
        a = li.find("a", href=True)
        if a:
            href = a["href"].strip()
            if href.startswith("http") and href not in urls:
                urls.append(href)
    return urls


# ─────────────────────────── public API ─────────────────────────────────────

def scrape_url(url: str) -> Optional[dict]:
    """Scrape a single FreeJobAlert article URL and return the job dict."""
    log.info("  Fetching article → %s", url)
    html = fetch_html(url)
    if not html:
        return None
    try:
        return parse_page(url, html)
    except Exception as exc:
        log.error("  Parse error for %s: %s", url, exc, exc_info=True)
        return None


def scrape_urls(urls: list[str], delay: float = 1.0) -> list[dict]:
    """
    Scrape a list of article URLs with an optional per-request delay.
    Returns a flat list of job dicts (failed pages are skipped).
    """
    import time
    jobs = []
    for url in urls:
        url = url.strip()
        if not url or not url.startswith("http"):
            continue
        result = scrape_url(url)
        if result:
            jobs.append(result)
        if delay > 0:
            time.sleep(delay)
    return jobs


def scrape_master(
    master_url:  str,
    delay:       float = 1.5,
    max_pages:   int   = 1,
    max_articles: int  = 0,          # 0 = no limit
    follow_pages: bool = False,
) -> list[dict]:
    """
    1. Fetch the master/listing page (e.g. /new-updates/).
    2. Parse every <tr class="edthr"> row to get article URLs.
    3. Optionally follow paginated pages (page/2/, page/3/ …).
    4. Scrape each article URL and return a list of job dicts.

    Args:
        master_url:   The listing/index page URL.
        delay:        Seconds to wait between each article request.
        max_pages:    Maximum number of listing pages to walk (default 1).
        max_articles: Cap on total articles to scrape (0 = unlimited).
        follow_pages: If True, automatically follow pagination up to max_pages.
    """
    import time

    log.info("═" * 60)
    log.info("MASTER URL  : %s", master_url)
    log.info("Max pages   : %s", max_pages)
    log.info("Max articles: %s", max_articles or "unlimited")
    log.info("Delay (s)   : %s", delay)
    log.info("═" * 60)

    all_entries: list[dict] = []
    pages_visited: set[str] = set()
    pages_to_visit: list[str] = [master_url]

    pages_done = 0
    while pages_to_visit and pages_done < max_pages:
        page_url = pages_to_visit.pop(0)
        if page_url in pages_visited:
            continue
        pages_visited.add(page_url)
        pages_done += 1

        log.info("── Listing page %d: %s", pages_done, page_url)
        html = fetch_html(page_url)
        if not html:
            log.warning("   Could not fetch listing page, skipping.")
            continue

        entries = extract_links_from_master(html, page_url)
        log.info("   Found %d article link(s) on this page.", len(entries))
        all_entries.extend(entries)

        # Follow pagination if requested
        if follow_pages and pages_done < max_pages:
            for next_url in get_pagination_urls(html, page_url):
                if next_url not in pages_visited:
                    pages_to_visit.append(next_url)

    # Deduplicate across pages (same article can appear on multiple pages)
    seen: set[str] = set()
    unique_entries: list[dict] = []
    for e in all_entries:
        if e["url"] not in seen:
            seen.add(e["url"])
            unique_entries.append(e)

    if max_articles:
        unique_entries = unique_entries[:max_articles]

    total = len(unique_entries)
    log.info("── Total unique articles to scrape: %d", total)

    jobs: list[dict] = []
    for idx, entry in enumerate(unique_entries, start=1):
        log.info("── [%d/%d] %s", idx, total, entry["title"])
        job = scrape_url(entry["url"])
        if job:
            # Attach listing metadata so the consumer can use them
            job["_listing"] = {
                "update_date": entry["update_date"],
                "listed_title": entry["title"],
            }
            jobs.append(job)
            log.info("   ✓  Scraped: %s", job.get("exam_name", "—"))
        else:
            log.warning("   ✗  Failed: %s", entry["url"])

        if delay > 0 and idx < total:
            time.sleep(delay)

    log.info("═" * 60)
    log.info("Done. Scraped %d / %d article(s).", len(jobs), total)
    log.info("═" * 60)
    return jobs


# ─────────────────────────── output formatter ────────────────────────────────

def format_output(jobs: list[dict], fmt: str = "numbered") -> str:
    """
    Format a list of job dicts for output.

    fmt options:
        "numbered"  – separate JSON objects labelled "JSON Result 1", "Result 2" …
        "array"     – standard {"jobs": [...]} array
        "ndjson"    – one JSON object per line (newline-delimited JSON)
    """
    if fmt == "array":
        return json.dumps({"jobs": jobs}, ensure_ascii=False, indent=2)

    if fmt == "ndjson":
        lines = [json.dumps(job, ensure_ascii=False) for job in jobs]
        return "\n".join(lines)

    # Default: "numbered"
    parts = []
    for idx, job in enumerate(jobs, start=1):
        header = f"// {'─' * 20} JSON Result {idx} {'─' * 20}"
        parts.append(header)
        parts.append(json.dumps(job, ensure_ascii=False, indent=2))
    return "\n".join(parts)


# ─────────────────────────── CLI ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=(
            "FreeJobAlert Universal Scraper\n"
            "──────────────────────────────\n"
            "Three modes:\n"
            "  --master   Listing/index page → auto-extract all article links\n"
            "  --url      One or more direct article URLs\n"
            "  --file     Plain-text file with one article URL per line\n"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )

    # ── input sources ──────────────────────────────────────────────────────
    parser.add_argument(
        "--master",
        metavar="URL",
        help=(
            "Master / listing page URL\n"
            "(e.g. https://www.freejobalert.com/new-updates/)\n"
            "All <tr class='edthr'> article links will be extracted\n"
            "and scraped automatically."
        ),
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=1,
        metavar="N",
        help="Number of listing pages to walk when using --master (default: 1).",
    )
    parser.add_argument(
        "--follow-pages",
        action="store_true",
        help="Automatically follow pagination links up to --pages limit.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        metavar="N",
        help="Max articles to scrape from master page (0 = unlimited).",
    )
    parser.add_argument(
        "--url",
        action="append",
        default=[],
        metavar="URL",
        help="Direct article URL (can be repeated for multiple articles).",
    )
    parser.add_argument(
        "--file",
        metavar="FILE",
        help="Plain-text file with one article URL per line.",
    )

    # ── output options ─────────────────────────────────────────────────────
    parser.add_argument(
        "--output",
        metavar="FILE",
        help="Write results to this file (default: print to stdout).",
    )
    parser.add_argument(
        "--format",
        choices=["numbered", "array", "ndjson"],
        default="numbered",
        help=(
            "Output format (default: numbered):\n"
            "  numbered  Separate labelled JSON blocks — JSON Result 1, 2, …\n"
            "  array     Single {\"jobs\": [...]} JSON array\n"
            "  ndjson    One JSON object per line (newline-delimited JSON)"
        ),
    )

    # ── behaviour options ──────────────────────────────────────────────────
    parser.add_argument(
        "--delay",
        type=float,
        default=1.5,
        metavar="SECONDS",
        help="Seconds to wait between article requests (default: 1.5).",
    )

    args = parser.parse_args()

    # ── collect jobs ───────────────────────────────────────────────────────
    jobs: list[dict] = []

    if args.master:
        jobs = scrape_master(
            master_url   = args.master,
            delay        = args.delay,
            max_pages    = args.pages,
            max_articles = args.limit,
            follow_pages = args.follow_pages,
        )

    elif args.url or args.file:
        urls: list[str] = list(args.url)
        if args.file:
            with open(args.file, "r", encoding="utf-8") as f:
                urls.extend(line.strip() for line in f if line.strip())
        jobs = scrape_urls(urls, delay=args.delay)

    else:
        parser.print_help()
        sys.exit(1)

    if not jobs:
        log.warning("No jobs were scraped.")
        sys.exit(0)

    # ── format & write output ──────────────────────────────────────────────
    output_text = format_output(jobs, fmt=args.format)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_text)
        log.info("Saved %d result(s) → %s", len(jobs), args.output)
    else:
        print(output_text)


if __name__ == "__main__":
    main()
