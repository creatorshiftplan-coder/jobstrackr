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

interface QueuedEvent {
    user_id: string;
    endpoint: string;
    request_data: Record<string, unknown>;
    response_status: number;
}

// Singleton class to batch analytics events
class AnalyticsBatcher {
    private static instance: AnalyticsBatcher;
    private queue: QueuedEvent[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly FLUSH_INTERVAL = 5000; // 5 seconds
    private readonly MAX_QUEUE_SIZE = 20;

    private constructor() {
        // Flush on page unload
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", () => {
                this.flush();
            });

            // Also flush on visibility change (when user switches tabs)
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden") {
                    this.flush();
                }
            });
        }
    }

    static getInstance(): AnalyticsBatcher {
        if (!AnalyticsBatcher.instance) {
            AnalyticsBatcher.instance = new AnalyticsBatcher();
        }
        return AnalyticsBatcher.instance;
    }

    queueEvent(event: QueuedEvent): void {
        this.queue.push(event);

        if (process.env.NODE_ENV === "development") {
            console.log(`[Analytics] Queued event (${this.queue.length}/${this.MAX_QUEUE_SIZE})`);
        }

        // Flush if queue is full
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            this.flush();
            return;
        }

        // Start timer if not already running
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flush();
            }, this.FLUSH_INTERVAL);
        }
    }

    private async flush(): Promise<void> {
        // Clear timer
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Nothing to flush
        if (this.queue.length === 0) return;

        // Take all queued events
        const eventsToFlush = [...this.queue];
        this.queue = [];

        try {
            if (process.env.NODE_ENV === "development") {
                console.log(`[Analytics] Flushing ${eventsToFlush.length} events to DB`);
            }

            // Batch insert all events
            await (supabase as any).from("api_usage_logs").insert(eventsToFlush);

            if (process.env.NODE_ENV === "development") {
                console.log(`[Analytics] Successfully flushed ${eventsToFlush.length} events`);
            }
        } catch (error) {
            // Silently fail - analytics should never break the app
            console.warn("[Analytics] Failed to flush events:", error);
            // Don't re-queue failed events to avoid infinite loops
        }
    }
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

                // Queue event for batched insert
                const queuedEvent: QueuedEvent = {
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
                };

                AnalyticsBatcher.getInstance().queueEvent(queuedEvent);
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
