import { groqChatCompletion } from "./groqClient";
import { SkillObject } from "../types/job";

export interface SummariserResult {
  summary: string | null;
  required_skills: SkillObject[];
}

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

/**
 * Validates the generated eligibility summary according to quality check rules:
 * - Length: 80-150 words.
 * - Contains at least one age number.
 * - Does not start with preamble words like 'I' or 'Here'.
 */
function validateSummary(summary: string): boolean {
  if (!summary) return false;
  
  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (words.length < 80 || words.length > 150) {
    console.warn(`[Summariser Validation] Failed word count: ${words.length}`);
    return false;
  }

  // Check if it contains an age number (e.g. "18", "27", "35", "45", "Age 21")
  const hasAgeNumber = /\b(age\s+)?\d{2}\b/i.test(summary);
  if (!hasAgeNumber) {
    console.warn(`[Summariser Validation] Failed age number check: no two-digit age found.`);
    return false;
  }

  // Check for preambles
  const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, "");
  if (firstWord === "i" || firstWord === "here" || firstWord === "this") {
    console.warn(`[Summariser Validation] Failed preamble check: starts with '${words[0]}'`);
    return false;
  }

  return true;
}

/**
 * Call Groq Llama 3.3 70B to summarize eligibility text and extract skills.
 * Falls back to Llama 3.1 8B on failure.
 * Retries up to 2 times on validation failures.
 */
export async function summariseEligibility(
  rawEligibilityText: string | null | undefined
): Promise<SummariserResult> {
  if (!rawEligibilityText || rawEligibilityText.trim().length === 0) {
    return { summary: null, required_skills: [] };
  }

  const userPrompt = `Summarise this eligibility section:\n${rawEligibilityText}`;
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  
  for (const model of models) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await groqChatCompletion({
          model,
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        } as any);

        if (!response) {
          // Fallback or retry
          continue;
        }

        const choice = response.choices?.[0]?.message?.content;
        if (!choice) continue;

        const parsed = JSON.parse(choice) as { summary?: string; required_skills?: any[] };
        const summaryText = parsed.summary || "";
        const skillsList = parsed.required_skills || [];

        // Validate summary text quality
        if (validateSummary(summaryText)) {
          return {
            summary: summaryText,
            required_skills: skillsList as SkillObject[]
          };
        } else {
          console.warn(`[Summariser] Validation failed for model ${model} (attempt ${retry + 1}). Retrying...`);
        }
      } catch (err) {
        console.error(`[Summariser] Failed to generate summary with model ${model}:`, err);
      }
    }
  }

  console.warn("[Summariser] Failed both models and retries. Falling back to null summary.");
  return { summary: null, required_skills: [] };
}
