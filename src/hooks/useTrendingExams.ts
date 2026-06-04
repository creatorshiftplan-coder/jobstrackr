import { useQuery } from "@tanstack/react-query";

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
    update_slug?: string | null;
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
            const res = await fetch("/api/cache/trending-exams");
            if (!res.ok) {
                // Fallback to direct Supabase if cache endpoint fails
                return fallbackFetchTrendingExams();
            }
            const allExams: TrendingExam[] = await res.json();

            // Client-side category filtering (server returns all exams pre-processed)
            if (!category || category === "All") {
                return allExams;
            }

            const keywords = categoryKeywords[category] || [];
            return allExams.filter(exam => {
                if (exam.category?.toLowerCase() === category.toLowerCase()) return true;
                const searchText = `${exam.name} ${exam.conducting_body || ""}`.toLowerCase();
                return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
            });
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// Category keyword mapping for client-side filtering
const categoryKeywords: Record<string, string[]> = {
    "Banking": ["bank", "ibps", "sbi", "rbi", "nabard", "rrb clerk", "rrb po"],
    "SSC": ["ssc", "staff selection"],
    "Railways": ["railway", "rrb", "rpf", "ntpc", "technician", "group d"],
    "Defence": ["defence", "defense", "army", "navy", "airforce", "nda", "cds", "capf", "afcat"],
    "UPSC": ["upsc", "civil service", "ias", "ips", "ifs"],
    "Teaching": ["teacher", "tet", "ctet", "teaching", "kvs", "nvs", "dsssb"],
    "State": ["state", "psc", "bpsc", "uppsc", "mppsc", "rpsc", "gpsc", "appsc"],
};

/** Fallback: direct Supabase fetch if cache endpoint is unavailable */
async function fallbackFetchTrendingExams(): Promise<TrendingExam[]> {
    const { supabase } = await import("@/integrations/supabase/client");

    const { data: exams, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .not("ai_cached_response", "is", null)
        .eq("is_active", true)
        .order("ai_last_updated_at", { ascending: false });

    if (examsError) throw examsError;
    if (!exams || exams.length === 0) return [];

    const examsWithData = exams.filter(exam => {
        const aiData = exam.ai_cached_response as any;
        if (!aiData || aiData.raw_response) return false;
        return aiData.summary || aiData.current_status;
    });

    if (examsWithData.length === 0) return [];

    const examIds = examsWithData.map(e => e.id);
    const { data: attempts } = await supabase
        .from("exam_attempts")
        .select("exam_id")
        .in("exam_id", examIds);

    const trackingCounts: Record<string, number> = {};
    attempts?.forEach(a => {
        trackingCounts[a.exam_id] = (trackingCounts[a.exam_id] || 0) + 1;
    });

    const specificCategories = ["Banking", "SSC", "Railways", "Defence", "UPSC", "Teaching", "State"];

    const inferCat = (name: string, cb: string | null): string | null => {
        const searchText = `${name} ${cb || ""}`.toLowerCase();
        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(kw => searchText.includes(kw.toLowerCase()))) return cat;
        }
        return null;
    };

    const trendingExams: TrendingExam[] = examsWithData.map(exam => {
        const useCategory = specificCategories.includes(exam.category || "")
            ? exam.category
            : (inferCat(exam.name, exam.conducting_body) || exam.category);
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
            logo_url: null,
            update_slug: (exam as any).update_slug || null,
        };
    });

    return trendingExams.sort((a, b) => {
        if (b.tracking_count !== a.tracking_count) return b.tracking_count - a.tracking_count;
        return new Date(b.ai_last_updated_at || 0).getTime() - new Date(a.ai_last_updated_at || 0).getTime();
    });
}
