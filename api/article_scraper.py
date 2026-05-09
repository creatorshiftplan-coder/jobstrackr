"""
Article Scraper for FreeJobAlert Updates Tab
=============================================
Scrapes individual FreeJobAlert article URLs and returns structured data.
Based on BeautifulSoup for robust real-world HTML parsing.
"""

import re
import requests
from bs4 import BeautifulSoup
from typing import Optional, List, Dict, Any
from datetime import datetime

BASE_URL = "https://www.freejobalert.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": BASE_URL,
}

# ─── Junk CSS classes to strip ───
JUNK_CLASSES = [
    "ad_div", "adsbygoogle", "fja-follow-bar", "fja-alert-widget",
    "yarpp", "mobile-app", "social-bar", "share-bar", "related-posts",
    "post-navigation", "author-box", "comment-respond", "sidebar",
    "jp-relatedposts", "code-block", "widget",
]

# ─── Navigation / ad link patterns ───
NAV_PATTERNS = re.compile(
    r"(government-jobs|state-government-jobs|bank-jobs|teaching-faculty-jobs|"
    r"engineering-jobs|railway-jobs|police-defence-jobs|latest-notifications|"
    r"employment-news|search-jobs|sarkarijob|sarkari-naukri|admit-card|"
    r"exam-results|answer-key|cutoff-marks|written-marks|interview-results|"
    r"last-date-reminder|eligibility|syllabus|exam-pattern|selection-process|"
    r"previous-papers|education|contact-us|policy|author|/author/|/category/|/tag/)",
    re.I,
)

JUNK_TEXTS = [
    "view all", "join whatsapp", "join telegram", "join instagram",
    "join youtube", "download mobile app", "free mock test",
    "google news", "follow us", "add as a preferred source",
    "play fun games", "image resizer", "pdf to word",
    "image to pdf", "word to pdf", "free ai interview",
]

GENERIC_LINK_TEXTS = ["download pdf", "click here", "view", "visit", "link", "download", "here"]

DOWNLOAD_KW = [
    "download", "admit card", "hall ticket", "result", "apply",
    "login", "official", "click here", "direct link", "answer key", "scorecard",
]


def _clean(text: str) -> str:
    return " ".join((text or "").split())


def _abs_url(href: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return href
    try:
        from urllib.parse import urljoin
        return urljoin(BASE_URL, href)
    except Exception:
        return BASE_URL + (href if href.startswith("/") else "/" + href)


def _is_junk_link(href: str, text: str) -> bool:
    if NAV_PATTERNS.search(href):
        return True
    lo = text.lower()
    return any(j in lo for j in JUNK_TEXTS)


def detect_category(title: str) -> str:
    t = title.lower()
    if re.search(r"admit card|hall ticket|call letter|admit\b", t):
        return "admit_card"
    if re.search(r"cut.?off|cutoff marks|minimum qualifying marks", t):
        return "cutoff"
    if re.search(r"answer key|objection|provisional key", t):
        return "answer_key"
    if re.search(r"syllabus|exam pattern|new pattern", t):
        return "syllabus"
    if re.search(r"result|scorecard|merit list|marks", t):
        return "result"
    if re.search(r"recruitment|apply online|vacancy|vacancies|notification", t):
        return "recruitment"
    return "news"


def _parse_date(text: str) -> str:
    m = re.search(
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})",
        text,
    )
    return m.group(1) if m else ""


def _parse_status(text: str) -> str:
    m = re.search(r"\b(Out|Released|Active|Available|Declared|Upcoming|Soon|Live Now)\b", text, re.I)
    return m.group(1) if m else ""


def fetch_html(url: str, retries: int = 2) -> Optional[str]:
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            print(f"fetch_html attempt {attempt + 1} failed for {url}: {e}")
            if attempt < retries:
                import time
                time.sleep(1.5 * (attempt + 1))
    print(f"All retries exhausted for {url}")
    return None


# ─── Table parsers ───

def _parse_dates_table(table: BeautifulSoup) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        texts = [_clean(c.get_text()) for c in cells]
        link = ""
        for c in cells:
            a = c.find("a", href=True)
            if a:
                h = a.get("href", "")
                if h and not h.startswith("javascript") and not h.startswith("#") and not h.startswith("mailto"):
                    link = _abs_url(h)
                    break
        event = texts[0]
        date_str = _parse_date(texts[1]) or texts[1]
        status = _parse_status(" ".join(texts[2:])) if len(texts) > 2 else ""
        if event:
            if link and "freejobalert" in link.lower():
                link = ""
            rows.append({"event": event, "date": date_str, "status": status, "link": link})
    return rows


def _parse_overview_table(table: BeautifulSoup) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        field = _clean(cells[0].get_text())
        value = _clean(cells[1].get_text())
        if field and value:
            rows.append({"field": field, "value": value})
    return rows


def _parse_vacancy_table(table: BeautifulSoup) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        post_name = _clean(cells[0].get_text())
        vacancies = _clean(cells[1].get_text())
        if post_name and vacancies and post_name.lower() not in ("post name", "post"):
            rows.append({"post_name": post_name, "vacancies": vacancies})
    return rows


def _parse_fee_table(table: BeautifulSoup) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        category = _clean(cells[0].get_text())
        fee = _clean(cells[1].get_text())
        if category and fee and category.lower() not in ("category", "fee"):
            rows.append({"category": category, "fee": fee})
    return rows


def _parse_cutoff_table(table: BeautifulSoup) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        category = _clean(cells[0].get_text())
        marks = _clean(cells[1].get_text())
        if category and marks and category.lower() not in ("category", "marks"):
            rows.append({"category": category, "marks": marks})
    return rows


# ─── Main scraper ───

def scrape_article(url: str) -> Dict[str, Any]:
    """Scrape a single FreeJobAlert article and return structured data."""
    html = fetch_html(url)
    if not html:
        return {"error": "Failed to fetch page", "url": url}

    soup = BeautifulSoup(html, "html.parser")

    out: Dict[str, Any] = {
        "url": url,
        "scraped_at": datetime.utcnow().isoformat() + "Z",
        "title": "",
        "category": "",
        "published_date": "",
        "summary": "",
        "status": "",
        "full_text": "",
        "important_dates": [],
        "overview": [],
        "vacancy_table": [],
        "fee_table": [],
        "eligibility_table": [],
        "cutoff_table": [],
        "download_links": [],
        "official_links": [],
        "related_links": [],
        "images": [],
        "tags": [],
        "sections": [],
        "related_articles": [],
    }

    # Title
    h1 = soup.find("h1", class_="entry-title") or soup.find("h1")
    if h1:
        out["title"] = _clean(h1.get_text())
        out["category"] = detect_category(out["title"])
        out["status"] = _parse_status(out["title"])

    # Published date (meta tags)
    pub_meta = soup.find("meta", property="article:published_time") or soup.find("meta", property="og:updated_time")
    if pub_meta:
        out["published_date"] = pub_meta.get("content", "")
    if not out["published_date"]:
        for tag in soup.find_all(["time", "span", "p"]):
            txt = _clean(tag.get_text())
            d = _parse_date(txt)
            if d and re.search(r"\d{4}", d):
                out["published_date"] = d
                break

    # Summary (meta description)
    desc_meta = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    if desc_meta:
        out["summary"] = desc_meta.get("content", "")

    # Tags
    for p in soup.find_all("p"):
        if re.search(r"Tags\s*:", p.get_text() or "", re.I):
            raw = re.sub(r"Tags\s*:", "", p.get_text(), flags=re.I)
            out["tags"] = [t.strip() for t in raw.split(",") if t.strip()]
            break

    # Article body
    body = (
        soup.find("div", class_=re.compile(r"entry-content|article-content|post-content|article__body"))
        or soup.find("article")
        or soup.find("main")
    )

    if body:
        # Remove junk elements
        for el in body.find_all(["script", "style", "ins", "iframe"]):
            el.decompose()
        for el in body.find_all(class_=True):
            classes = " ".join(el.get("class", [])).lower()
            if any(j in classes for j in JUNK_CLASSES):
                el.decompose()

        # Full text extraction
        full_text = body.get_text(separator="\n", strip=True)
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)
        out["full_text"] = full_text[:3000]  # cap for DB safety

        # Summary fallback from body text
        if not out["summary"] or len(out["summary"]) < 50:
            paragraphs = [p.strip() for p in full_text.split("\n") if len(p.strip()) > 30]
            paragraphs = [p for p in paragraphs if not re.match(r"^Tags?:", p, re.I)]
            if paragraphs:
                out["summary"] = paragraphs[0][:500]

        # Images
        for img in body.find_all("img", src=True):
            src = img.get("src", "")
            if "wp-content/uploads" in src:
                out["images"].append(_abs_url(src))
        out["images"] = out["images"][:5]

        # Tables
        for table in body.find_all("table"):
            ttext = table.get_text(separator=" ", strip=True).lower()

            is_dates = any(k in ttext for k in ["exam date", "result date", "admit card", "last date", "release date", "notification", "tier", "phase", "answer key", "hall ticket", "city intimation"])
            is_overview = any(k in ttext for k in ["conducting body", "exam name", "official website", "vacancies", "total posts", "total vacancy", "post name"])
            is_vacancy = any(k in ttext for k in ["post name", "vacancy", "total posts"]) and not is_overview
            is_fee = any(k in ttext for k in ["application fee", "fee", "category"]) and "fee" in ttext
            is_cutoff = any(k in ttext for k in ["cutoff", "category", "marks", "score", "qualifying"])

            if is_overview and not out["overview"]:
                out["overview"] = _parse_overview_table(table)
            elif is_dates and not out["important_dates"]:
                out["important_dates"] = _parse_dates_table(table)
            elif is_vacancy and not out["vacancy_table"]:
                out["vacancy_table"] = _parse_vacancy_table(table)
            elif is_fee and not out["fee_table"]:
                out["fee_table"] = _parse_fee_table(table)
            elif is_cutoff and not out["cutoff_table"]:
                out["cutoff_table"] = _parse_cutoff_table(table)

        # Links — classify into download, official, related
        seen_urls: set = set()
        for a in body.find_all("a", href=True):
            href = _abs_url(a.get("href", "").strip())
            text = _clean(a.get_text())
            if not text or not href:
                continue
            if not href.startswith("http"):
                continue
            if href.startswith("javascript") or href.startswith("mailto"):
                continue
            if _is_junk_link(href, text):
                continue
            if href in seen_urls:
                continue
            seen_urls.add(href)
            if "freejobalert" in href.lower():
                continue

            # Context-aware naming for generic link text
            lo_t = text.lower()
            if not text or any(g in lo_t for g in GENERIC_LINK_TEXTS):
                parent_tr = a.find_parent("tr")
                if parent_tr:
                    cells = parent_tr.find_all(["td", "th"])
                    if cells and len(cells) > 0:
                        first_cell = cells[0]
                        if first_cell != a.find_parent(["td", "th"]):
                            row_context = _clean(first_cell.get_text())
                            if row_context and row_context != text:
                                text = f"{row_context} - {text or 'Link'}"
                if not text:
                    text = "Direct Link"

            lo_h = href.lower()
            lo_t2 = text.lower()

            is_official = any(d in lo_h for d in ["gov.in", "nic.in", "org.in", "ac.in", "edu.in", "res.in"])
            is_download = any(k in lo_t2 or k in lo_h for k in DOWNLOAD_KW)

            if is_official:
                out["official_links"].append({"text": text, "url": href})
            elif is_download:
                out["download_links"].append({"text": text, "url": href})
            else:
                out["related_links"].append({"text": text, "url": href})

        # Sections (headings + content + lists)
        current: Optional[Dict[str, Any]] = None
        for tag in body.find_all(["h2", "h3", "h4", "p", "ul", "ol"]):
            tag_name = tag.name
            if tag_name in ("h2", "h3", "h4"):
                heading = _clean(tag.get_text())
                if re.search(r"follow us|join|advertisement|share|about the author|other posts|job notifications|jobs by|state job|other active|other ssc", heading, re.I):
                    current = None
                    continue
                if current:
                    out["sections"].append(current)
                current = {"heading": heading, "level": tag_name, "content": [], "type": "paragraph"}
            elif current:
                if tag_name in ("ul", "ol"):
                    items = [_clean(li.get_text()) for li in tag.find_all("li") if _clean(li.get_text())]
                    if items:
                        current["content"].extend(items)
                        current["type"] = "list"
                else:
                    txt = _clean(tag.get_text())
                    if txt:
                        current["content"].append(txt)
        if current:
            out["sections"].append(current)

    # Related articles (whole page)
    seen_rel: set = set()
    for a in soup.find_all("a", href=re.compile(r"/articles/")):
        href = _abs_url(a.get("href", ""))
        text = _clean(a.get_text())
        if text and href and href != url and href not in seen_rel and not _is_junk_link(href, text):
            if "freejobalert" in href.lower():
                continue
            seen_rel.add(href)
            out["related_articles"].append({"title": text, "url": href})
    out["related_articles"] = out["related_articles"][:10]

    return out


def collect_article_links(html: str, listing_url: str, limit: int = 10) -> List[Dict[str, str]]:
    """Collect article links from a listing page HTML."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set = set()
    items: List[Dict[str, str]] = []

    for a in soup.find_all("a", href=re.compile(r"/articles/")):
        href = _abs_url(a.get("href", ""))
        text = _clean(a.get_text())
        if not text or not href or href in seen:
            continue
        if _is_junk_link(href, text):
            continue

        seen.add(href)

        date_str = ""
        status_str = ""
        parent = a.find_parent(["li", "tr", "div", "p"])
        if parent:
            full = _clean(parent.get_text())
            date_str = _parse_date(full)
            status_str = _parse_status(full)

        items.append({
            "title": text,
            "url": href,
            "category": detect_category(text),
            "status": status_str,
            "date": date_str,
        })

        if len(items) >= limit:
            break

    return items
