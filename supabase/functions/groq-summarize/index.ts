/**
 * Edge Function: groq-summarize
 *
 * Server-side replacement for src/lib/groqClient.ts + eligibility summariser
 * Groq calls. Keeps Groq API keys off the browser.
 *
 * Request body: { rawEligibilityText: string }
 * Response:     { summary: string | null, required_skills: SkillObject[] }
 *
 * Auth: requires a valid Supabase JWT with the "admin" role.
 *
 * Rotation: uses _shared/apiKeyRotation.ts. Tries llama-3.3-70b-versatile
 * across all healthy Groq keys, then falls back to llama-3.1-8b-instant.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadApiKeys,
  callWithRotation,
  ApiKeyConfig,
} from "../_shared/apiKeyRotation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert at parsing and summarising Indian government job eligibility criteria.
You MUST respond with a JSON object containing two fields:
1. "summary": A dense 100-120 word text containing ONLY:
   - Age range with category relaxations (OBC, SC/ST, PH, ExSM)
   - Education: level + stream + specialisation if specified
   - Extra skills required: typing speed and language, stenography speed, computer certificate level, ITI trade, driving license type, law degree, NCC certificate, experience years and domain
   - Physical standards if mentioned
   - Domicile / state restriction if any
   Use plain dense language. No sentences. No intro. No explanation. No markdown.
   Format EXACTLY like: "Age 18-27 years. OBC+3, SC/ST+5. Graduate any stream. Typing 35 WPM English. CCC computer certificate. ITI Electrician or Fitter."

2. "required_skills": An array of skill objects matching this schema:
   Each object in the array MUST have a "type" (string) and "required" (boolean) field.
   Allowed types and additional fields:
   - typing: { type: "typing", language: "English" | "Hindi" | string, min_wpm: number | null, required: boolean }
   - stenography: { type: "stenography", language: "English" | "Hindi" | string, min_wpm: number | null, required: boolean }
   - computer: { type: "computer", min_level: number | null, accepted: string[], required: boolean }
   - iti: { type: "iti", trades: string[], any_trade: boolean, required: boolean }
   - driving: { type: "driving", license_types: string[], required: boolean }
   - law: { type: "law", accepted: string[], required: boolean }
   - ncc: { type: "ncc", min_certificate: "A" | "B" | "C", required: boolean }
   - experience: { type: "experience", domain: string, min_years: number, required: boolean }
   - physical: { type: "physical", height_cm: { male: number, female: number } | null, required: boolean }
   - custom: { type: "custom", label: string, required: boolean }

Return ONLY the JSON object. Do not include markdown wraps or backticks outside the JSON itself.`;

const MODEL_FALLBACK_CHAIN = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

function validateSummary(summary: string, rawText: string): boolean {
  if (!summary) return false;

  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5 || words.length > 250) return false;

  const rawHasTwoDigit = /\b\d{2}\b/.test(rawText);
  if (rawHasTwoDigit && !/\b\d{2}\b/.test(summary)) return false;

  const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, "");
  if (firstWord === "i" || firstWord === "here" || firstWord === "this") {
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Auth: must be admin ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) {
      return jsonResponse({ error: "Admin role required" }, 403);
    }

    // ── Input ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({} as any));
    const rawEligibilityText: string | undefined = body?.rawEligibilityText;
    if (!rawEligibilityText || rawEligibilityText.trim().length === 0) {
      return jsonResponse({ summary: null, required_skills: [] });
    }

    // ── Keys: groq only ────────────────────────────────────────────────
    const allKeys = await loadApiKeys(supabase);
    const groqKeys = allKeys.filter((k) => k.provider === "groq");
    if (groqKeys.length === 0) {
      return jsonResponse({ error: "No Groq API keys configured" }, 500);
    }

    const userPrompt = `Summarise this eligibility section:\n${rawEligibilityText}`;

    // ── Model fallback loop ────────────────────────────────────────────
    let lastError = "All Groq models / keys failed";
    for (const model of MODEL_FALLBACK_CHAIN) {
      // Re-tag every key with this model so callWithRotation hits the right model.
      const keysForModel: ApiKeyConfig[] = groqKeys.map((k) => ({
        ...k,
        model_name: model,
      }));

      for (let retry = 0; retry < 2; retry++) {
        try {
          const result = await callWithRotation(supabase, keysForModel, {
            systemPrompt: SYSTEM_PROMPT,
            userPrompt,
            temperature: retry === 0 ? 0.1 : 0.3,
            maxTokens: 1024,
          });

          const content = result.content?.trim() || "";
          if (!content) {
            lastError = `Empty content from ${model}`;
            continue;
          }

          let parsed: { summary?: string; required_skills?: any[] };
          try {
            parsed = JSON.parse(content);
          } catch {
            // Some models wrap in ```json fences despite instructions.
            const fenced = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
            if (!fenced) {
              lastError = `Non-JSON response from ${model}`;
              continue;
            }
            try {
              parsed = JSON.parse(fenced[1]);
            } catch {
              lastError = `Failed to parse JSON from ${model}`;
              continue;
            }
          }

          const summary = parsed.summary || "";
          const skills = Array.isArray(parsed.required_skills)
            ? parsed.required_skills
            : [];

          if (validateSummary(summary, rawEligibilityText)) {
            return jsonResponse({
              summary,
              required_skills: skills,
              model_used: model,
              key_used: result.keyUsed.label || result.keyUsed.id,
            });
          }

          lastError = `Validation failed for ${model} (retry ${retry + 1})`;
          console.warn(`[groq-summarize] ${lastError}`);
        } catch (err) {
          lastError = (err as Error).message || String(err);
          console.error(
            `[groq-summarize] ${model} retry ${retry + 1} failed:`,
            lastError,
          );
          // If callWithRotation threw, all keys were exhausted for this model.
          // No point retrying the same model — break to fall back.
          break;
        }
      }
    }

    return jsonResponse(
      { summary: null, required_skills: [], error: lastError },
      502,
    );
  } catch (err) {
    console.error("[groq-summarize] Unhandled error:", err);
    return jsonResponse(
      { error: (err as Error).message || "Internal error" },
      500,
    );
  }
});
