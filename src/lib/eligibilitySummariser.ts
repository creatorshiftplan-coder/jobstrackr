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

/**
 * Summarise many eligibility texts in one `groq-summarize` invocation.
 *
 * Calling `summariseEligibility` once per job re-runs auth + admin-role
 * check + API-key loading against Supabase for every single job, which
 * multiplies Supabase round trips for a batch and can trip rate limits /
 * timeouts. This does auth, the role check, and key loading once for the
 * whole batch — the edge function only loops over the actual Groq calls.
 */
export async function summariseEligibilityBatch(
  rawEligibilityTexts: (string | null | undefined)[]
): Promise<SummariserResult[]> {
  const texts = rawEligibilityTexts.map((t) => t ?? "");
  if (texts.every((t) => t.trim().length === 0)) {
    return texts.map(() => ({ summary: null, required_skills: [] }));
  }

  const { data, error } = await supabase.functions.invoke("groq-summarize", {
    body: { rawEligibilityTexts: texts },
  });

  if (error) {
    console.error("[Summariser] Edge function batch error:", error.message || error);
    return texts.map(() => ({ summary: null, required_skills: [] }));
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  return texts.map((_, i) => {
    const r = results[i];
    if (!r || typeof r !== "object") {
      return { summary: null, required_skills: [] };
    }
    return {
      summary: r.summary ?? null,
      required_skills: Array.isArray(r.required_skills) ? r.required_skills : [],
    };
  });
}
