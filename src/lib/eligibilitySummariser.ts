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
 * Summarise several eligibility texts in a single `groq-summarize`
 * invocation (auth + admin-role check + API-key loading happen once for
 * the whole batch instead of once per item).
 *
 * Resilience: the batch response shape (`{ results: [...] }`) is only
 * understood by the *new* deployed edge function. The frontend (Vercel)
 * and the edge function (manual `supabase functions deploy`) ship on
 * separate tracks, so they can be out of sync — an old deployed function
 * ignores `rawEligibilityTexts` and returns `{ summary: null }`, with no
 * `results` array. Rather than fail every item in that case, we detect the
 * missing/short `results` array (or a transport error) and transparently
 * fall back to per-item `summariseEligibility` calls — the proven path
 * that every deployed version understands. So the batch is a fast path
 * when available and a graceful degrade, never an all-or-nothing bet.
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

  // Transport error, or a response that doesn't carry a usable per-item
  // results array (old function / unexpected shape) → fall back to the
  // per-item path instead of reporting the whole batch as failed.
  const results = Array.isArray(data?.results) ? data.results : null;
  if (error || !results || results.length < texts.length) {
    if (error) {
      console.warn(
        "[Summariser] Batch call failed, falling back to per-item:",
        error.message || error
      );
    } else {
      console.warn(
        "[Summariser] Batch response not understood (likely an older " +
          "deployed groq-summarize), falling back to per-item summarisation."
      );
    }
    return summariseSequentially(texts);
  }

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

/**
 * Fallback: summarise each text with its own `summariseEligibility` call,
 * one after another (kept sequential to avoid hammering Groq rate limits).
 * Empty texts short-circuit to null without a network round trip.
 */
async function summariseSequentially(
  texts: string[]
): Promise<SummariserResult[]> {
  const out: SummariserResult[] = [];
  for (const text of texts) {
    if (!text || text.trim().length === 0) {
      out.push({ summary: null, required_skills: [] });
      continue;
    }
    out.push(await summariseEligibility(text));
  }
  return out;
}
