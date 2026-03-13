/**
 * Shared utility functions for exam status detection
 * Single source of truth for determining admission card and result status
 */

// TypeScript interface for AI exam response
export interface AIExamResponse {
    result_available?: boolean;
    admit_card_available?: boolean;
    current_status?: string;
    result_link?: string;
    admit_card_link?: string;
    expected_result_date?: string;
    phase_1?: {
        result_available?: boolean;
        admit_card_available?: boolean;
        status?: string;
        result_date?: string;
    };
    phase_2?: {
        result_available?: boolean;
        admit_card_available?: boolean;
        status?: string;
        result_date?: string;
    };
    predicted_events?: Array<{
        event_type: string;
        predicted_date?: string;
        phase?: number;
    }>;
    phases?: {
        phase1?: {
            name?: string;
            status?: string;
            admit_card_available?: boolean;
            admit_card_link?: string;
            exam_date?: string;
            exam_details?: string;
            result_available?: boolean;
            result_link?: string;
            result_date?: string;
        };
        phase2?: {
            name?: string;
            status?: string;
            admit_card_available?: boolean;
            admit_card_link?: string;
            exam_date?: string;
            exam_details?: string;
            result_available?: boolean;
            result_link?: string;
            result_date?: string;
        };
    };
}

export interface ExamAttempt {
    id: string;
    year: number;
    status?: string | null;
    exams?: {
        name: string;
        conducting_body?: string | null;
        ai_cached_response?: AIExamResponse | null;
    } | null;
}

export type ExamStatusLabel = "Result Released" | "Admit Card Released" | "Exam Date Announced" | "Application Pending";

export interface ExamStatus {
    label: ExamStatusLabel;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
}

/**
 * Check if the result has been released for an exam
 */
export function isResultReleased(attempt: ExamAttempt): boolean {
    const status = attempt.status;
    const aiResponse = attempt.exams?.ai_cached_response;

    // Check attempt status
    if (status === "result_declared" || status === "result") {
        return true;
    }

    // Check AI cached response for result_available
    // CRITICAL: Use strict boolean check to avoid truthy string values
    if (aiResponse?.result_available === true) {
        return true;
    }
    if (aiResponse?.current_status === "result_declared") {
        return true;
    }

    // Check phase 1 data (also check phases.phase1 for new format)
    if (aiResponse?.phase_1?.result_available === true) {
        return true;
    }
    if (aiResponse?.phase_1?.status === "result_declared") {
        return true;
    }
    // New phases format
    if (aiResponse?.phases?.phase1?.result_available === true) {
        return true;
    }
    if (aiResponse?.phases?.phase1?.status === "result_declared") {
        return true;
    }

    return false;
}

/**
 * Check if the admit card has been released for an exam
 */
// Helper function to check if admit card is released
export function isAdmitCardReleased(attempt: ExamAttempt): boolean {
    const status = attempt.status;
    const aiResponse = attempt.exams?.ai_cached_response;

    // CRITICAL: If explicit flag is FALSE, trust it over everything else and return false immediately
    if (aiResponse?.admit_card_available === false) {
        return false;
    }
    // Check new phases format for explicit false
    if (aiResponse?.phases?.phase1?.admit_card_available === false) {
        return false;
    }

    // Check attempt status
    // Note: Removed "exam_scheduled" - being scheduled doesn't mean admit card is released
    if (status === "admit_card_available") {
        return true;
    }

    // Check AI cached response for verifiable true flag
    if (aiResponse?.admit_card_available === true) {
        return true;
    }

    // Note: Removed "exam_scheduled" from status check
    if (aiResponse?.current_status === "admit_card_available") {
        return true;
    }

    // Check phase 1 data (old format)
    if (aiResponse?.phase_1?.admit_card_available === true) {
        return true;
    }
    if (aiResponse?.phase_1?.status === "admit_card_available") {
        return true;
    }

    // Check phases.phase1 (new format from AI)
    if (aiResponse?.phases?.phase1?.admit_card_available === true) {
        return true;
    }
    if (aiResponse?.phases?.phase1?.status === "admit_card_available") {
        return true;
    }

    // Text-based keyword matching (matches examStatus.ts logic used by TrendingExamCard)
    // This ensures consistency between Trending page and TrackedJobCard
    // Use precise phrase matching only — avoid broad "admit" + "released" combos
    const statusText = (aiResponse?.current_status || "").toLowerCase();
    const summaryText = ((aiResponse as any)?.summary || "").toLowerCase();
    const combinedText = `${statusText} ${summaryText}`;

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
    ];

    // Check for exact keyword matches only
    if (admitReleasedKeywords.some(kw => combinedText.includes(kw))) {
        return true;
    }

    return false;
}

/**
 * Check if expected exam date has been released for an exam
 */
export function isExamDateReleased(attempt: ExamAttempt): boolean {
    const aiResponse = attempt.exams?.ai_cached_response;
    if (!aiResponse) return false;

    const statusText = (aiResponse.current_status || "").toLowerCase();
    const summaryText = ((aiResponse as any)?.summary || "").toLowerCase();
    const combinedText = `${statusText} ${summaryText}`;

    const examDateReleasedKeywords = [
        "expected exam date released", "expected exam date announced",
        "expected exam date declared", "expected exam date out",
        "exam date released", "exam date announced", "exam date declared",
        "exam date out", "exam dates released", "exam dates announced",
        "exam dates declared", "exam dates out",
    ];

    return examDateReleasedKeywords.some(kw => combinedText.includes(kw));
}

/**
 * Get the status label for an exam with styling information
 */
export function getExamStatus(attempt: ExamAttempt): ExamStatus {
    // Check for Result Released first (highest priority)
    if (isResultReleased(attempt)) {
        return {
            label: "Result Released",
            variant: "default",
            color: "bg-green-500 text-white"
        };
    }

    // Check for Expected Exam Date Released
    if (isExamDateReleased(attempt)) {
        return {
            label: "Exam Date Announced",
            variant: "default",
            color: "bg-purple-500 text-white"
        };
    }

    // Check for Admit Card Released
    if (isAdmitCardReleased(attempt)) {
        return {
            label: "Admit Card Released",
            variant: "default",
            color: "bg-blue-500 text-white"
        };
    }

    // Default: Application Pending
    return {
        label: "Application Pending",
        variant: "secondary",
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    };
}
