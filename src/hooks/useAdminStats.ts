import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserStats {
  totalUsers: number;
  todayRegistrations: number;
  weekRegistrations: number;
  recentUsers: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    created_at: string;
  }>;
}

interface APIStats {
  totalSearches: number;
  todaySearches: number;
  avgLatency: number;
  successRate: number;
  recentSearches: Array<{
    id: string;
    query: string;
    latency_ms: number | null;
    parse_ok: boolean | null;
    created_at: string;
  }>;
}

export function useAdminStats() {
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    todayRegistrations: 0,
    weekRegistrations: 0,
    recentUsers: [],
  });
  const [apiStats, setAPIStats] = useState<APIStats>({
    totalSearches: 0,
    todaySearches: 0,
    avgLatency: 0,
    successRate: 0,
    recentSearches: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Fetch user stats from profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (!profilesError && profiles) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const todayRegistrations = profiles.filter(
          (p) => new Date(p.created_at) >= todayStart
        ).length;
        const weekRegistrations = profiles.filter(
          (p) => new Date(p.created_at) >= weekStart
        ).length;

        setUserStats({
          totalUsers: profiles.length,
          todayRegistrations,
          weekRegistrations,
          recentUsers: profiles.slice(0, 10),
        });
      }

      // Fetch AI job search logs
      const { data: jobLogs, error: jobLogsError } = await supabase
        .from("ai_job_discover_logs")
        .select("id, query, latency_ms, parse_ok, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch AI exam search logs
      const { data: examLogs, error: examLogsError } = await supabase
        .from("ai_exam_discover_logs")
        .select("id, query, latency_ms, parse_ok, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // Combine logs
      const allLogs = [...(jobLogs || []), ...(examLogs || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (allLogs.length > 0) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const todaySearches = allLogs.filter(
          (l) => new Date(l.created_at) >= todayStart
        ).length;

        const validLatencies = allLogs.filter((l) => l.latency_ms != null);
        const avgLatency =
          validLatencies.length > 0
            ? Math.round(
                validLatencies.reduce((sum, l) => sum + (l.latency_ms || 0), 0) /
                  validLatencies.length
              )
            : 0;

        const successCount = allLogs.filter((l) => l.parse_ok === true).length;
        const successRate =
          allLogs.length > 0 ? Math.round((successCount / allLogs.length) * 100) : 0;

        setAPIStats({
          totalSearches: allLogs.length,
          todaySearches,
          avgLatency,
          successRate,
          recentSearches: allLogs.slice(0, 20),
        });
      }
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { userStats, apiStats, isLoading, refetch: fetchStats };
}
