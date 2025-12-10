import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Event types for analytics
export type AnalyticsEventType =
    | "page_view"
    | "feature_used"
    | "button_click"
    | "job_viewed"
    | "job_saved"
    | "exam_tracked"
    | "ai_search_used"
    | "profile_updated"
    | "document_uploaded";

interface AnalyticsEvent {
    event_type: AnalyticsEventType;
    event_data?: Record<string, unknown>;
    page_path?: string;
}

export function useAnalytics() {
    const { user } = useAuth();

    const trackEvent = useCallback(
        async ({ event_type, event_data = {}, page_path }: AnalyticsEvent) => {
            try {
                // Log to console in development
                if (process.env.NODE_ENV === "development") {
                    console.log(`[Analytics] ${event_type}`, { event_data, page_path });
                }

                // Only track for logged-in users (can be changed to track all users)
                if (!user) return;

                // Store in api_usage_logs table (reusing existing infrastructure)
                // Using type assertion as api_usage_logs may not be in typed schema
                await (supabase as any).from("api_usage_logs").insert({
                    user_id: user.id,
                    endpoint: `analytics/${event_type}`,
                    request_data: {
                        event_type,
                        event_data,
                        page_path: page_path || window.location.pathname,
                        user_agent: navigator.userAgent,
                        screen_size: `${window.innerWidth}x${window.innerHeight}`,
                        timestamp: new Date().toISOString(),
                    },
                    response_status: 200,
                });
            } catch (error) {
                // Silently fail - analytics should never break the app
                console.warn("[Analytics] Failed to track event:", error);
            }
        },
        [user]
    );

    // Convenience methods
    const trackPageView = useCallback(
        (pageName: string) => {
            trackEvent({
                event_type: "page_view",
                event_data: { page_name: pageName },
                page_path: window.location.pathname,
            });
        },
        [trackEvent]
    );

    const trackFeatureUsed = useCallback(
        (featureName: string, details?: Record<string, unknown>) => {
            trackEvent({
                event_type: "feature_used",
                event_data: { feature_name: featureName, ...details },
            });
        },
        [trackEvent]
    );

    const trackButtonClick = useCallback(
        (buttonName: string, context?: string) => {
            trackEvent({
                event_type: "button_click",
                event_data: { button_name: buttonName, context },
            });
        },
        [trackEvent]
    );

    const trackJobViewed = useCallback(
        (jobId: string, jobTitle: string) => {
            trackEvent({
                event_type: "job_viewed",
                event_data: { job_id: jobId, job_title: jobTitle },
            });
        },
        [trackEvent]
    );

    const trackJobSaved = useCallback(
        (jobId: string, jobTitle: string) => {
            trackEvent({
                event_type: "job_saved",
                event_data: { job_id: jobId, job_title: jobTitle },
            });
        },
        [trackEvent]
    );

    const trackExamTracked = useCallback(
        (examId: string, examTitle: string) => {
            trackEvent({
                event_type: "exam_tracked",
                event_data: { exam_id: examId, exam_title: examTitle },
            });
        },
        [trackEvent]
    );

    const trackAISearchUsed = useCallback(
        (query: string, resultsCount: number) => {
            trackEvent({
                event_type: "ai_search_used",
                event_data: { query, results_count: resultsCount },
            });
        },
        [trackEvent]
    );

    return {
        trackEvent,
        trackPageView,
        trackFeatureUsed,
        trackButtonClick,
        trackJobViewed,
        trackJobSaved,
        trackExamTracked,
        trackAISearchUsed,
    };
}
