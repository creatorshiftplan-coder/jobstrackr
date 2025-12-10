import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageViewStats {
    page_name: string;
    view_count: number;
}

interface FeatureUsageStats {
    feature_name: string;
    usage_count: number;
}

interface DailyActivityStats {
    date: string;
    count: number;
}

interface AnalyticsLog {
    id: string;
    created_at: string;
    endpoint: string;
    request_data: Record<string, unknown>;
}

interface AnalyticsData {
    totalPageViews: number;
    totalFeatureUsage: number;
    pageViewsByPage: PageViewStats[];
    featureUsage: FeatureUsageStats[];
    dailyActivity: DailyActivityStats[];
    topSearchQueries: { query: string; count: number }[];
    isLoading: boolean;
    error: Error | null;
}

export function useAnalyticsData(): AnalyticsData {
    // Fetch all analytics events
    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-analytics"],
        queryFn: async () => {
            // Using type assertion as api_usage_logs may not be in typed schema
            const { data: logs, error } = await (supabase as any)
                .from("api_usage_logs")
                .select("*")
                .like("endpoint", "analytics/%")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (logs || []) as AnalyticsLog[];
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    // Process page views
    const pageViewLogs = data?.filter(
        (log) => log.endpoint === "analytics/page_view"
    ) || [];

    const pageViewsByPage: PageViewStats[] = [];
    const pageViewsMap = new Map<string, number>();

    pageViewLogs.forEach((log) => {
        const requestData = log.request_data;
        const eventData = requestData?.event_data as Record<string, unknown> | undefined;
        const pageName = (eventData?.page_name as string) || "Unknown";
        pageViewsMap.set(pageName, (pageViewsMap.get(pageName) || 0) + 1);
    });

    pageViewsMap.forEach((count, page_name) => {
        pageViewsByPage.push({ page_name, view_count: count });
    });
    pageViewsByPage.sort((a, b) => b.view_count - a.view_count);

    // Process feature usage
    const featureLogs = data?.filter(
        (log) => log.endpoint === "analytics/feature_used" ||
            log.endpoint === "analytics/button_click"
    ) || [];

    const featureUsageMap = new Map<string, number>();
    featureLogs.forEach((log) => {
        const requestData = log.request_data;
        const eventData = requestData?.event_data as Record<string, unknown> | undefined;
        const featureName = (eventData?.feature_name as string) ||
            (eventData?.button_name as string) || "Unknown";
        featureUsageMap.set(featureName, (featureUsageMap.get(featureName) || 0) + 1);
    });

    const featureUsage: FeatureUsageStats[] = [];
    featureUsageMap.forEach((count, feature_name) => {
        featureUsage.push({ feature_name, usage_count: count });
    });
    featureUsage.sort((a, b) => b.usage_count - a.usage_count);

    // Process daily activity
    const dailyActivityMap = new Map<string, number>();
    data?.forEach((log) => {
        const date = new Date(log.created_at).toISOString().split("T")[0];
        dailyActivityMap.set(date, (dailyActivityMap.get(date) || 0) + 1);
    });

    const dailyActivity: DailyActivityStats[] = [];
    dailyActivityMap.forEach((count, date) => {
        dailyActivity.push({ date, count });
    });
    dailyActivity.sort((a, b) => a.date.localeCompare(b.date));

    // Process AI search queries
    const searchLogs = data?.filter(
        (log) => log.endpoint === "analytics/ai_search_used"
    ) || [];

    const searchQueriesMap = new Map<string, number>();
    searchLogs.forEach((log) => {
        const requestData = log.request_data;
        const eventData = requestData?.event_data as Record<string, unknown> | undefined;
        const query = (eventData?.query as string) || "Unknown";
        searchQueriesMap.set(query, (searchQueriesMap.get(query) || 0) + 1);
    });

    const topSearchQueries: { query: string; count: number }[] = [];
    searchQueriesMap.forEach((count, query) => {
        topSearchQueries.push({ query, count });
    });
    topSearchQueries.sort((a, b) => b.count - a.count);

    return {
        totalPageViews: pageViewLogs.length,
        totalFeatureUsage: featureLogs.length,
        pageViewsByPage: pageViewsByPage.slice(0, 10),
        featureUsage: featureUsage.slice(0, 10),
        dailyActivity: dailyActivity.slice(-14), // Last 14 days
        topSearchQueries: topSearchQueries.slice(0, 10),
        isLoading,
        error: error as Error | null,
    };
}
