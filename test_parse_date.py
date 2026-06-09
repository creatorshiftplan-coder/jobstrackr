import re

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    "january": "01", "february": "02", "march": "03", "april": "04",
    "june": "06", "july": "07", "august": "08", "september": "09",
    "october": "10", "november": "11", "december": "12",
}

_DATE_RE = re.compile(
    r"(\d{1,2})[\s\-/]+([A-Za-z]+)[\s\-/]+(\d{4})"       # 14 March 2026
    r"|(\d{4})[\s\-/]+(\d{1,2})[\s\-/]+(\d{1,2})"           # 2026-03-14
    r"|(\d{1,2})[\s\-/]+(\d{1,2})[\s\-/]+(\d{4})"           # 14/03/2026
)

def parse_date(raw: str):
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
    return None

print("Test 1:", parse_date("27/04/2026 from 3:00 PM onwards"))
print("Test 2:", parse_date("24/03/2026 (10:00 AM)"))
print("Test 3:", parse_date("29-04 2026"))
print("Test 4:", parse_date("29-04-2026"))
print("Test 5:", parse_date("To be notified later"))
