// Helper functions for exam status
// Ported from mobile app for consistent badge display

export type ExamStatusType = 'result' | 'admit_card' | 'exam_date_released' | 'exam_scheduled' | 'admit_pending' | 'date_change' | 'notification' | 'upcoming';

export const BADGE_CONFIG: Record<ExamStatusType, { color: string; label: string }> = {
    result: { color: "#22c55e", label: "Result Released" },
    admit_card: { color: "#f59e0b", label: "Admit Card Released" },
    exam_date_released: { color: "#a855f7", label: "Expected Exam Date Released" },
    exam_scheduled: { color: "#8b5cf6", label: "Exam Scheduled" },
    admit_pending: { color: "#ef4444", label: "Admit Card Pending" },
    date_change: { color: "#ef4444", label: "Date Changed" },
    notification: { color: "#3b82f6", label: "Notification" },
    upcoming: { color: "#64748b", label: "Upcoming" },
};

export function parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    try {
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(dateStr);
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        return null;
    } catch {
        return null;
    }
}

export function isDatePassed(dateStr?: string): boolean {
    if (!dateStr) return false;
    const date = parseFlexibleDate(dateStr);
    if (!date) return false;
    date.setHours(23, 59, 59, 999);
    return date < new Date();
}

// Get badge type from exam data by checking AI cache
// Priority: Result > Admit Card > Exam Scheduled > Admit Card Pending > Date Change > Notification > Upcoming
export function getExamStatusType(aiData: any): ExamStatusType {
    if (!aiData) return 'upcoming';

    const statusText = (aiData.current_status || "").toLowerCase();
    const summaryText = (aiData.summary || "").toLowerCase();
    const examDatesText = (aiData.exam_dates || "").toLowerCase();
    const combinedText = `${statusText} ${summaryText} ${examDatesText}`;

    // Check for Result Released
    const resultReleasedKeywords = [
        "result out", "result declared", "result released",
        "results declared", "results released", "result announced",
        "final result", "merit list", "cutoff released",
        "tier 1 result", "tier-1 result", "tier 2 result", "tier-2 result",
    ];

    const hasResultInStatus = statusText.includes("result") &&
        (statusText.includes("out") || statusText.includes("declared") ||
            statusText.includes("released") || statusText.includes("announced"));

    if (resultReleasedKeywords.some(kw => combinedText.includes(kw)) || hasResultInStatus) {
        return 'result';
    }

    // Check for Expected Exam Date Released
    const examDateReleasedKeywords = [
        "expected exam date released", "expected exam date announced",
        "expected exam date declared", "expected exam date out",
        "exam date released", "exam date announced", "exam date declared",
        "exam date out", "exam dates released", "exam dates announced",
        "exam dates declared", "exam dates out",
    ];

    if (examDateReleasedKeywords.some(kw => combinedText.includes(kw))) {
        return 'exam_date_released';
    }

    // Check for Admit Card Released - use precise phrase matching only
    const admitReleasedKeywords = [
        // Admit card phrases
        "admit card released", "admit card out now", "admit card declared",
        "admit card issued", "admit card published", "admit card uploaded",
        "admit card activated", "admit card made available", "admit card available",
        "admit card available online", "admit card download started",
        "admit card link available", "admit card link activated",
        "admit card link live", "admit card link working",
        "admit cards released", "admit cards out",
        "admit card out", "e-admit card",
        // Reversed admit card phrases
        "released admit card", "out admit card", "declared admit card",
        "issued admit card", "published admit card", "uploaded admit card",
        "activated admit card", "available admit card", "live admit card",
        "announced admit card", "notified admit card", "download admit card",
        "started admit card download", "active admit card link",
        "live admit card link", "working admit card link",
        // Hall ticket phrases
        "hall ticket released", "hall ticket out", "hall ticket issued",
        "hall ticket download started", "hall ticket available online",
        "hall ticket link activated", "hall ticket available",
        // Reversed hall ticket phrases
        "released hall ticket", "out hall ticket", "issued hall ticket",
        "available hall ticket", "activated hall ticket link",
        "announced hall ticket",
        // Call letter phrases
        "call letter released", "call letter issued", "call letter available",
        "call letter download link", "call letter out now",
        // Reversed call letter phrases
        "released call letter", "issued call letter", "available call letter",
        "download call letter", "published call letter",
        // Tier-specific
        "tier 1 admit card", "tier-1 admit card", "tier 2 admit card", "tier-2 admit card",
    ];

    if (admitReleasedKeywords.some(kw => combinedText.includes(kw))) {
        return 'admit_card';
    }

    // Check for Exam Scheduled
    const examScheduledKeywords = [
        "exam scheduled", "exam on", "examination on", "exam date",
        "exam will be held", "exam to be conducted", "examination scheduled",
        "scheduled for", "exam dates announced",
    ];

    const hasExamInStatus = (statusText.includes("exam") || statusText.includes("test")) &&
        (statusText.includes("scheduled") || statusText.includes("date") ||
            statusText.includes("held") || statusText.includes("conducted"));

    const examDate = parseFlexibleDate(aiData.exam_dates || "");
    if (examDate && examDate > new Date()) {
        return 'exam_scheduled';
    }
    if (examScheduledKeywords.some(kw => combinedText.includes(kw)) || hasExamInStatus) {
        return 'exam_scheduled';
    }

    // Check for Admit Card Pending
    const applyDatePassed = isDatePassed(aiData.last_date_to_apply);
    const admitNotReleased = !admitReleasedKeywords.some(kw => combinedText.includes(kw));
    const resultNotReleased = !resultReleasedKeywords.some(kw => combinedText.includes(kw));

    if (applyDatePassed && admitNotReleased && resultNotReleased) {
        return 'admit_pending';
    }

    // Check for Date Changes
    const dateChangeKeywords = ["postponed", "rescheduled", "date changed", "revised date", "exam cancelled"];
    if (dateChangeKeywords.some(kw => combinedText.includes(kw))) {
        return 'date_change';
    }

    // Check if applications are OPEN (Notification)
    const appsOpenKeywords = [
        "apply now", "apply online", "registration started", "registration open",
        "applications open", "last date to apply", "online application",
        "notification released", "notification out", "recruitment notification"
    ];
    const appsStillOpen = aiData.last_date_to_apply && !isDatePassed(aiData.last_date_to_apply);

    if (appsOpenKeywords.some(kw => combinedText.includes(kw)) || appsStillOpen) {
        return 'notification';
    }

    // Check if it's UPCOMING
    const upcomingKeywords = [
        "expected", "coming soon", "tentative", "likely to be announced",
        "will be released", "awaited", "upcoming", "soon"
    ];
    if (upcomingKeywords.some(kw => combinedText.includes(kw))) {
        return 'upcoming';
    }

    // Default: If we have any AI data, show as Notification
    if (aiData.summary || aiData.current_status || aiData.exam_dates) {
        return 'notification';
    }

    return 'upcoming';
}

export function getBadgeConfig(status: ExamStatusType): { color: string; label: string } {
    return BADGE_CONFIG[status] || BADGE_CONFIG.upcoming;
}
