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

export type ExamStatusLabel = "Result Released" | "Admit Card Released" | "Application Pending";

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
    if (aiResponse?.result_available === true) {
        return true;
    }
    if (aiResponse?.current_status === "result_declared") {
        return true;
    }

    // Check phase 1 data
    if (aiResponse?.phase_1?.result_available === true) {
        return true;
    }
    if (aiResponse?.phase_1?.status === "result_declared") {
        return true;
    }

    return false;
}

/**
 * Check if the admit card has been released for an exam
 */
export function isAdmitCardReleased(attempt: ExamAttempt): boolean {
    const status = attempt.status;
    const aiResponse = attempt.exams?.ai_cached_response;

    // Check attempt status
    if (status === "admit_card_available" || status === "exam_scheduled") {
        return true;
    }

    // Check AI cached response for admit_card_available
    if (aiResponse?.admit_card_available === true) {
        return true;
    }
    if (aiResponse?.current_status === "admit_card_available" || aiResponse?.current_status === "exam_scheduled") {
        return true;
    }

    // Check phase 1 data
    if (aiResponse?.phase_1?.admit_card_available === true) {
        return true;
    }
    if (aiResponse?.phase_1?.status === "admit_card_available" || aiResponse?.phase_1?.status === "exam_scheduled") {
        return true;
    }

    return false;
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
