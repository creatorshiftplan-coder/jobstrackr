// Shared utility functions for job display

// Check if last_date_display contains TBD-like values
export const isTBDDateDisplay = (displayValue: string | null): boolean => {
    if (!displayValue) return false;
    const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'not available'];
    const lowerValue = displayValue.toLowerCase().trim();
    return tbdPatterns.some(pattern => lowerValue.includes(pattern));
};

// Infer category from department/title using keyword matching
export const inferCategory = (department: string, title: string): string => {
    const text = `${department} ${title}`.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
        "SSC": ["ssc", "staff selection commission"],
        "UPSC": ["upsc", "union public service", "ias", "ips", "ifs", "civil services"],
        "Banking": ["bank", "ibps", "rbi", "sbi", "nabard"],
        "Railways": ["railway", "rrb", "indian railways", "irctc"],
        "State PSC": ["psc", "state public service", "bpsc", "uppsc", "mpsc", "jpsc", "rpsc", "kpsc", "tnpsc", "appsc", "wbpsc"],
        "Defence": ["defence", "defense", "army", "navy", "air force", "nda", "cds", "afcat", "capf", "bsf", "crpf", "cisf", "itbp", "ssb"],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return category;
        }
    }

    return "Govt";
};

// Shorten qualification for display
export const shortenQualification = (qualification: string): string => {
    if (!qualification) return "Any";

    const text = qualification.toLowerCase();

    // Order matters - check more specific patterns first
    if (text.includes("phd") || text.includes("doctorate")) {
        return "PhD";
    }
    if (text.includes("post") || text.includes("master") || text.includes("m.tech") || text.includes("mba") || text.includes("m.sc")) {
        return "Post Graduate";
    }
    if (text.includes("b.tech") || text.includes("b.e") || text.includes("engineering")) {
        return "B.Tech/B.E";
    }
    if (text.includes("graduate") || text.includes("graduation") || text.includes("bachelor") || text.includes("degree") || text.includes("b.sc") || text.includes("b.a") || text.includes("b.com")) {
        return "Graduate";
    }
    if (text.includes("diploma")) {
        return "Diploma";
    }
    if (text.includes("iti")) {
        return "ITI";
    }
    // Check 12th before 10th to avoid false matches
    if (text.includes("12th") || text.includes("class xii") || text.includes("intermediate") || text.includes("higher secondary") || text.includes("+2")) {
        return "12th Pass";
    }
    if (text.includes("10th") || text.includes("class x ") || text.includes("class x,") || text.includes("matriculation") || text.includes("ssc pass") || text.includes("10 pass")) {
        return "10th Pass";
    }
    if (text.includes("8th") || text.includes("class viii") || text.includes("middle")) {
        return "8th Pass";
    }

    // Return first 15 chars if no match
    return qualification.length > 15 ? qualification.slice(0, 15) + "..." : qualification;
};

// Format age limit for consistent display across cards and details
export const formatAgeLimit = (
    ageMin?: number | null,
    ageMax?: number | null,
    unit: string = "years"
): string => {
    const min = typeof ageMin === "number" && Number.isFinite(ageMin) ? ageMin : null;
    const max = typeof ageMax === "number" && Number.isFinite(ageMax) ? ageMax : null;

    // Treat very small ages as invalid placeholders (e.g., 1) and hide them.
    let normalizedMin = min !== null && min >= 10 ? min : null;
    let normalizedMax = max !== null && max >= 10 ? max : null;

    if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
        const tmp = normalizedMin;
        normalizedMin = normalizedMax;
        normalizedMax = tmp;
    }

    if (normalizedMin !== null && normalizedMax !== null) return `${normalizedMin} - ${normalizedMax} ${unit}`;
    if (normalizedMin !== null) return `From ${normalizedMin} ${unit}`;
    if (normalizedMax !== null) return `Upto ${normalizedMax} ${unit}`;
    return "Not Available";
};
