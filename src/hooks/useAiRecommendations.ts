import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/job";

export interface AiRecommendation {
  job: Job;
  match_score: number;
  reasons: string[];
  is_eligible: boolean;
}

/**
 * Hook to retrieve LLM-based job recommendations for the user.
 */
export function useAiRecommendations(skills: string[], enabled: boolean = true) {
  return useQuery({
    queryKey: ["ai-recommendations", skills],
    queryFn: async (): Promise<AiRecommendation[]> => {
      const { data, error } = await supabase.functions.invoke("jobs-recommendations", {
        body: { skills },
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch AI recommendations");
      }

      return (data?.recommendations || []) as AiRecommendation[];
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1, // Fail fast to trigger fallback immediately
  });
}

/**
 * Triggers the process-embeddings Edge Function in profile mode
 * to calculate and store the user's vector embedding.
 */
export async function triggerProfileEmbeddingUpdate(userId: string, userText: string): Promise<boolean> {
  try {
    console.log("[Profile Embedding] Triggering update request for user:", userId);
    const { data, error } = await supabase.functions.invoke("process-embeddings", {
      body: {
        action: "profile",
        user_id: userId,
        user_text: userText,
      },
    });

    if (error) {
      console.warn("[Profile Embedding] Update trigger returned error:", error.message);
      return false;
    }

    console.log("[Profile Embedding] Update triggered successfully:", data?.message);
    return true;
  } catch (err) {
    console.error("[Profile Embedding] Update trigger failed:", err);
    return false;
  }
}
