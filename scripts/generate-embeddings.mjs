/**
 * Generate embeddings for all jobs that don't have one yet.
 * Uses Xenova/all-MiniLM-L6-v2 (384-dim) running locally via WASM.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/generate-embeddings.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('Loading embedding model (first run downloads ~80MB)...');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
console.log('Model loaded.');

// ═════════════════════════════════════════════════════════════════════════
// GROQ KEY ROTATION & SUMMARISATION CLIENT (Node.js version)
// ═════════════════════════════════════════════════════════════════════════

const KEY_COUNT = 8;
let currentKeyIndex = 0;

function getGroqKey(index) {
  return process.env[`GROQ_KEY_${index}`] || process.env[`VITE_GROQ_KEY_${index}`];
}

const keyStates = Array.from({ length: KEY_COUNT }, (_, i) => ({
  index: i + 1,
  status: "ACTIVE", // ACTIVE | RATE_LIMITED | EXHAUSTED
  rateLimitedAt: 0,
  failures: 0,
}));

function refreshKeyState(state) {
  const now = Date.now();
  if (state.status === "RATE_LIMITED" && now - state.rateLimitedAt >= 60000) {
    state.status = "ACTIVE";
  }
}

function getNextAvailableKeyIndex() {
  for (let i = 0; i < KEY_COUNT; i++) {
    const checkIndex = (currentKeyIndex + i) % KEY_COUNT;
    const state = keyStates[checkIndex];
    refreshKeyState(state);
    const hasKeyVal = !!getGroqKey(state.index);
    if (hasKeyVal && state.status === "ACTIVE" && state.failures < 3) {
      currentKeyIndex = checkIndex;
      return currentKeyIndex;
    }
  }
  return null;
}

async function groqChatCompletion(request) {
  const maxAttempts = KEY_COUNT;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIdx = getNextAvailableKeyIndex();
    if (keyIdx === null) {
      console.warn("[Groq Rotation] All available keys are exhausted or rate-limited.");
      return null;
    }
    const state = keyStates[keyIdx];
    const apiKey = getGroqKey(state.index);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        state.failures = 0;
        return await response.json();
      }

      if (response.status === 429) {
        console.warn(`[Groq Rotation] Key ${state.index} rate-limited (429). Rotating.`);
        state.status = "RATE_LIMITED";
        state.rateLimitedAt = Date.now();
      } else if (response.status === 413 || response.status === 402) {
        console.warn(`[Groq Rotation] Key ${state.index} exhausted/quota hit (${response.status}). Rotating.`);
        state.status = "EXHAUSTED";
      } else {
        state.failures++;
        console.error(`[Groq Rotation] Key ${state.index} failed with status ${response.status}. failures: ${state.failures}`);
      }
    } catch (err) {
      state.failures++;
      console.error(`[Groq Rotation] Network error on Key ${state.index}. failures: ${state.failures}`, err.message);
    }
    currentKeyIndex = (currentKeyIndex + 1) % KEY_COUNT;
  }
  return null;
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

function validateSummary(summary) {
  if (!summary) return false;
  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (words.length < 80 || words.length > 150) return false;
  const hasAgeNumber = /\b(age\s+)?\d{2}\b/i.test(summary);
  if (!hasAgeNumber) return false;
  const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, "");
  if (firstWord === "i" || firstWord === "here" || firstWord === "this") return false;
  return true;
}

async function summariseEligibility(rawEligibilityText) {
  if (!rawEligibilityText || rawEligibilityText.trim().length === 0) {
    return null;
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
        });

        if (!response) continue;
        const choice = response.choices?.[0]?.message?.content;
        if (!choice) continue;

        const parsed = JSON.parse(choice);
        const summaryText = parsed.summary || "";
        const skillsList = parsed.required_skills || [];

        if (validateSummary(summaryText)) {
          return {
            summary: summaryText,
            required_skills: skillsList
          };
        }
      } catch (err) {
        // Silent fallback retry
      }
    }
  }
  return null;
}

async function buildEmbeddingText(job) {
  // Use pre-generated summary if available
  if (job.eligibility_summary) {
    return [job.eligibility_summary, job.tags ? job.tags.join(' ') : ''].filter(Boolean).join(' ');
  }

  // Generate summary now if missing
  const ageDetails = [];
  if (job.job_metadata?.age_limit_text) {
    ageDetails.push(`Age Limit: ${job.job_metadata.age_limit_text}`);
  } else if (job.age_min || job.age_max) {
    const minText = job.age_min ? `Minimum ${job.age_min} years` : "";
    const maxText = job.age_max ? `Maximum ${job.age_max} years` : "";
    ageDetails.push(`Age Limit: ${minText} ${maxText}`.trim());
  } else if (job.description) {
    const descSnippet = job.description.split(/\s+/).slice(0, 250).join(" ");
    ageDetails.push(`Job Details: ${descSnippet}`);
  }

  const textToSummarise = [
    job.eligibility,
    job.qualification,
    ...ageDetails
  ].filter(Boolean).join("\n");

  const result = await summariseEligibility(textToSummarise);

  if (result && result.summary) {
    console.log(`  ✓ Generated summary for: ${job.title}`);
    await supabase.from('jobs').update({
      eligibility_summary: result.summary,
      required_skills: result.required_skills
    }).eq('id', job.id);

    return [result.summary, job.tags ? job.tags.join(' ') : ''].filter(Boolean).join(' ');
  }

  // Final fallback: truncated raw text
  console.log(`  ⚠ Fallback raw embedding text for: ${job.title}`);
  return (job.eligibility || job.qualification || job.title || '').slice(0, 512);
}

async function run() {
  const BATCH_SIZE = 50;
  let totalProcessed = 0;
  let totalErrors = 0;

  console.log('Starting embedding generation for jobs without embeddings...\n');

  while (true) {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, department, description, qualification, eligibility, tags, eligibility_summary, job_metadata, age_min, age_max')
      .is('embedding', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Fetch error:', error.message);
      break;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No more jobs without embeddings.');
      break;
    }

    for (const job of jobs) {
      try {
        const text = await buildEmbeddingText(job);
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        const { error: updateError } = await supabase
          .from('jobs')
          .update({ embedding })
          .eq('id', job.id);

        if (updateError) {
          console.error(`  ✗ ${job.title}: ${updateError.message}`);
          totalErrors++;
        } else {
          totalProcessed++;
        }
      } catch (err) {
        console.error(`  ✗ ${job.title}: ${err.message}`);
        totalErrors++;
      }
    }

    console.log(`Processed batch: ${totalProcessed} done, ${totalErrors} errors`);
  }

  console.log(`\nDone! ${totalProcessed} embeddings generated, ${totalErrors} errors.`);
}

run().catch(console.error);
