import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingExam } from "@/hooks/useTrendingExams";

/**
 * Fetch a single exam by its update_slug, with UUID fallback.
 * Used by the /updates/:slug page.
 */
export function useUpdateBySlug(slugOrId: string) {
    return useQuery({
        queryKey: ["update", "slug", slugOrId],
        queryFn: async (): Promise<TrendingExam | null> => {
            // Try by update_slug first
            const { data: bySlug } = await supabase
                .from("exams")
                .select("*")
                .eq("update_slug" as any, slugOrId)
                .maybeSingle();

            if (bySlug) {
                return mapExamToTrending(bySlug);
            }

            // UUID fallback
            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (UUID_REGEX.test(slugOrId)) {
                const { data: byId, error } = await supabase
                    .from("exams")
                    .select("*")
                    .eq("id", slugOrId)
                    .single();
                if (error) throw error;
                if (byId) return mapExamToTrending(byId);
            }

            return null;
        },
        enabled: !!slugOrId,
    });
}

/**
 * Fetch related updates by same category or conducting body.
 */
export function useRelatedUpdates(examId: string, category: string | null, conductingBody: string | null) {
    return useQuery({
        queryKey: ["related-updates", examId, category, conductingBody],
        queryFn: async (): Promise<TrendingExam[]> => {
            let query = supabase
                .from("exams")
                .select("*")
                .neq("id", examId)
                .not("ai_cached_response", "is", null)
                .eq("is_active", true)
                .order("ai_last_updated_at", { ascending: false })
                .limit(5);

            if (category) {
                query = query.eq("category", category);
            } else if (conductingBody) {
                query = query.eq("conducting_body", conductingBody);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(mapExamToTrending);
        },
        enabled: !!examId,
    });
}

function mapExamToTrending(exam: any): TrendingExam {
    return {
        id: exam.id,
        name: exam.name,
        conducting_body: exam.conducting_body,
        category: exam.category,
        description: exam.description,
        official_website: exam.official_website,
        ai_cached_response: exam.ai_cached_response,
        ai_last_updated_at: exam.ai_last_updated_at,
        tracking_count: 0,
        logo_url: null,
        update_slug: exam.update_slug || null,
    };
}
