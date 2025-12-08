import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserWithStats {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  api_call_count: number;
  highest_qualification: string | null;
}

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
  allUsers: UserWithStats[];
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
    allUsers: [],
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
        .select("id, user_id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      // Fetch education qualifications for all users
      const { data: educations, error: educationsError } = await supabase
        .from("education_qualifications")
        .select("user_id, qualification_type");

      // Fetch AI job search logs for counting
      const { data: jobLogs, error: jobLogsError } = await supabase
        .from("ai_job_discover_logs")
        .select("id, query, latency_ms, parse_ok, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(500);

      // Fetch AI exam search logs
      const { data: examLogs, error: examLogsError } = await supabase
        .from("ai_exam_discover_logs")
        .select("id, query, latency_ms, parse_ok, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(500);

      // Fetch update_logs for OCR API calls
      const { data: updateLogs, error: updateLogsError } = await supabase
        .from("update_logs")
        .select("user_id, action")
        .eq("source", "ocr");

      // Calculate API call counts per user
      const apiCallCountMap = new Map<string, number>();
      
      [...(jobLogs || []), ...(examLogs || [])].forEach((log) => {
        if (log.user_id) {
          apiCallCountMap.set(log.user_id, (apiCallCountMap.get(log.user_id) || 0) + 1);
        }
      });

      (updateLogs || []).forEach((log) => {
        if (log.user_id) {
          apiCallCountMap.set(log.user_id, (apiCallCountMap.get(log.user_id) || 0) + 1);
        }
      });

      // Create map of highest qualification per user
      const qualificationPriority: Record<string, number> = {
        "postgraduate": 8,
        "post-graduation": 8,
        "engineering graduate (btech/be)": 7,
        "medical/nursing/pharmacy": 7,
        "teaching qualified (bed/tet)": 6,
        "graduate": 5,
        "graduation": 5,
        "diploma / iti": 4,
        "diploma": 4,
        "iti": 4,
        "12th": 3,
        "12th pass": 3,
        "10th": 2,
        "10th pass": 2,
        "8th pass": 1,
        "8th": 1,
      };

      const userQualificationMap = new Map<string, string>();
      (educations || []).forEach((edu) => {
        const existingQual = userQualificationMap.get(edu.user_id);
        const existingPriority = existingQual ? (qualificationPriority[existingQual.toLowerCase()] || 0) : 0;
        const newPriority = qualificationPriority[edu.qualification_type.toLowerCase()] || 0;
        
        if (newPriority > existingPriority) {
          userQualificationMap.set(edu.user_id, edu.qualification_type);
        }
      });

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

        // Build allUsers with API call count and qualification
        const allUsers: UserWithStats[] = profiles.map((profile) => ({
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          created_at: profile.created_at,
          api_call_count: apiCallCountMap.get(profile.user_id) || 0,
          highest_qualification: userQualificationMap.get(profile.user_id) || null,
        }));

        setUserStats({
          totalUsers: profiles.length,
          todayRegistrations,
          weekRegistrations,
          recentUsers: profiles.slice(0, 10),
          allUsers,
        });
      }

      // Combine logs for API stats
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
