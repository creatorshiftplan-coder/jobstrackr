import { supabase } from "@/integrations/supabase/client";
import { SkillObject } from "../types/job";

export interface SummariserResult {
  summary: string | null;
  required_skills: SkillObject[];
}

/**
 * Summarise eligibility text by invoking the `groq-summarize` edge function.
 *
 * All Groq API keys and rotation logic live server-side. This client only
 * forwards raw text and surfaces the result.
 */
export async function summariseEligibility(
  rawEligibilityText: string | null | undefined
): Promise<SummariserResult> {
  if (!rawEligibilityText || rawEligibilityText.trim().length === 0) {
    return { summary: null, required_skills: [] };
  }

  const { data, error } = await supabase.functions.invoke("groq-summarize", {
    body: { rawEligibilityText },
  });

  if (error) {
    console.error("[Summariser] Edge function error:", error.message || error);
    return { summary: null, required_skills: [] };
  }

  if (!data || typeof data !== "object") {
    return { summary: null, required_skills: [] };
  }

  if (data.error) {
    console.warn("[Summariser] Edge function returned error:", data.error);
  }

  const summary: string | null = data.summary ?? null;
  const skills: SkillObject[] = Array.isArray(data.required_skills)
    ? (data.required_skills as SkillObject[])
    : [];

  return { summary, required_skills: skills };
}
