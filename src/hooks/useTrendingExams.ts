import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingExam {
    id: string;
    name: string;
    conducting_body: string | null;
    category: string | null;
    description: string | null;
    official_website: string | null;
    ai_cached_response: {
        summary?: string;
        recommendations?: string[];
        current_status?: string;
        exam_dates?: string;
        predicted_events?: Array<{
            event_type: string;
            predicted_date: string;
        }>;
        last_date_to_apply?: string;
        latest_updates?: Array<string | { title?: string; description?: string }>;
        eligibility?: string;
    } | null;
    ai_last_updated_at: string | null;
    tracking_count: number;
    logo_url?: string | null;
}

// Category to gradient mapping with hex colors for inline styles
export const CATEGORY_GRADIENTS: Record<string, { fromColor: string; toColor: string; icon: string }> = {
    "Banking": { fromColor: "#0ea5e9", toColor: "#2563eb", icon: "🏦" },      // sky-500 to blue-600
    "SSC": { fromColor: "#8b5cf6", toColor: "#9333ea", icon: "🏛️" },         // violet-500 to purple-600
    "Railways": { fromColor: "#10b981", toColor: "#16a34a", icon: "🚂" },     // emerald-500 to green-600
    "Defence": { fromColor: "#f97316", toColor: "#dc2626", icon: "🎖️" },     // orange-500 to red-600
    "UPSC": { fromColor: "#f59e0b", toColor: "#ca8a04", icon: "⭐" },         // amber-500 to yellow-600
    "Teaching": { fromColor: "#ec4899", toColor: "#e11d48", icon: "📚" },     // pink-500 to rose-600
    "State": { fromColor: "#14b8a6", toColor: "#06b6d4", icon: "🏢" },        // teal-500 to cyan-600
    "default": { fromColor: "#64748b", toColor: "#4b5563", icon: "📋" },      // slate-500 to gray-600
};

export function useTrendingExams(category?: string) {
    return useQuery({
        queryKey: ["trending_exams", category],
        queryFn: async (): Promise<TrendingExam[]> => {
            // Fetch all exams with AI cached response (filter on client side for better matching)
            const query = supabase
                .from("exams")
                .select("*")
                .not("ai_cached_response", "is", null)
                .eq("is_active", true)
                .order("ai_last_updated_at", { ascending: false });

            const { data: exams, error: examsError } = await query;

            if (examsError) throw examsError;
            if (!exams || exams.length === 0) {
                return [];
            }

            // Filter out exams with empty or incomplete AI data
            const examsWithData = exams.filter(exam => {
                const aiData = exam.ai_cached_response as any;
                // Must have at least a summary or current_status to be meaningful
                // raw_response indicates an AI parsing failure
                if (!aiData || aiData.raw_response) return false;
                return aiData.summary || aiData.current_status;
            });

            if (examsWithData.length === 0) {
                return [];
            }

            // Smart category matching using exam name and conducting body
            const categoryKeywords: Record<string, string[]> = {
                "Banking": ["bank", "ibps", "sbi", "rbi", "nabard", "rrb clerk", "rrb po"],
                "SSC": ["ssc", "staff selection"],
                "Railways": ["railway", "rrb", "rpf", "ntpc", "technician", "group d"],
                "Defence": ["defence", "defense", "army", "navy", "airforce", "nda", "cds", "capf", "afcat"],
                "UPSC": ["upsc", "civil service", "ias", "ips", "ifs"],
                "Teaching": ["teacher", "tet", "ctet", "teaching", "kvs", "nvs", "dsssb"],
                "State": ["state", "psc", "bpsc", "uppsc", "mppsc", "rpsc", "gpsc", "appsc"],
            };

            // Filter exams by category using smart matching
            let filteredExams = examsWithData;
            if (category && category !== "All") {
                const keywords = categoryKeywords[category] || [];
                filteredExams = examsWithData.filter(exam => {
                    // First check if exam has a matching category field
                    if (exam.category?.toLowerCase() === category.toLowerCase()) return true;

                    // Then check keywords in name and conducting body
                    const searchText = `${exam.name} ${exam.conducting_body || ""}`.toLowerCase();
                    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
                });
            }

            // Get tracking counts for filtered exams
            if (filteredExams.length === 0) return [];

            const examIds = filteredExams.map(e => e.id);
            const { data: attempts, error: attemptsError } = await supabase
                .from("exam_attempts")
                .select("exam_id")
                .in("exam_id", examIds);

            if (attemptsError) throw attemptsError;

            // Count tracking per exam
            const trackingCounts: Record<string, number> = {};
            attempts?.forEach(a => {
                trackingCounts[a.exam_id] = (trackingCounts[a.exam_id] || 0) + 1;
            });

            // Helper to infer category from exam name/conducting body
            const inferCategory = (name: string, conductingBody: string | null): string | null => {
                const searchText = `${name} ${conductingBody || ""}`.toLowerCase();
                for (const [cat, keywords] of Object.entries(categoryKeywords)) {
                    if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
                        return cat;
                    }
                }
                return null;
            };

            // Categories that should use specific gradients (not generic "Government")
            const specificCategories = ["Banking", "SSC", "Railways", "Defence", "UPSC", "Teaching", "State"];

            // Combine data from filtered exams
            const trendingExams: TrendingExam[] = filteredExams.map(exam => {
                // If category is a specific known category, use it; otherwise try to infer
                const useCategory = specificCategories.includes(exam.category || "")
                    ? exam.category
                    : (inferCategory(exam.name, exam.conducting_body) || exam.category);

                return {
                    id: exam.id,
                    name: exam.name,
                    conducting_body: exam.conducting_body,
                    category: useCategory,
                    description: exam.description,
                    official_website: exam.official_website,
                    ai_cached_response: exam.ai_cached_response as TrendingExam["ai_cached_response"],
                    ai_last_updated_at: exam.ai_last_updated_at,
                    tracking_count: trackingCounts[exam.id] || 0,
                    logo_url: null, // Will be populated when logo management is added
                };
            });

            // Sort by tracking count DESC, then by last updated DESC
            return trendingExams.sort((a, b) => {
                if (b.tracking_count !== a.tracking_count) {
                    return b.tracking_count - a.tracking_count;
                }
                return new Date(b.ai_last_updated_at || 0).getTime() - new Date(a.ai_last_updated_at || 0).getTime();
            });
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
