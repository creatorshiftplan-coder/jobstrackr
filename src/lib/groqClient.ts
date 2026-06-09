// Groq API Client with 8-Key Round-Robin Rotation & Quota/Rate-Limit Tracking
// Exposes a call API to make Llama model chat completion calls.

export type KeyStatus = "ACTIVE" | "RATE_LIMITED" | "EXHAUSTED";

interface KeyState {
  index: number;
  status: KeyStatus;
  rateLimitedAt: number;
  exhaustedDate: string;
  failures: number;
  lastFailureReset: number;
}

// Module-level persistent state for keys
const KEY_COUNT = 8;
let currentKeyIndex = 0;

const keyStates: KeyState[] = Array.from({ length: KEY_COUNT }, (_, i) => ({
  index: i + 1,
  status: "ACTIVE",
  rateLimitedAt: 0,
  exhaustedDate: "",
  failures: 0,
  lastFailureReset: Date.now(),
}));

/**
 * Helper to fetch a key from various environments (process.env, Deno.env, import.meta.env)
 */
function getGroqKey(index: number): string | undefined {
  const keyName = `GROQ_KEY_${index}`;
  const viteKeyName = `VITE_GROQ_KEY_${index}`;

  // 1. Try process.env (Node.js & Vercel serverless)
  if (typeof process !== "undefined" && process.env) {
    if (process.env[keyName]) return process.env[keyName];
    if (process.env[viteKeyName]) return process.env[viteKeyName];
  }

  // 2. Try Deno.env (Deno Edge Functions)
  // @ts-ignore
  if (typeof Deno !== "undefined" && Deno.env) {
    // @ts-ignore
    const k = Deno.env.get(keyName) || Deno.env.get(viteKeyName);
    if (k) return k;
  }

  // 3. Try import.meta.env (Vite frontend client)
  // @ts-ignore
  if (typeof import.meta !== "undefined" && import.meta.env) {
    // @ts-ignore
    const k = import.meta.env[viteKeyName] || import.meta.env[keyName];
    if (k) return k;
  }

  return undefined;
}

/**
 * Gets the current date string in Indian Standard Time (IST / UTC + 5:30)
 */
function getTodayISTString(): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const date = new Date(Date.now() + istOffset);
  return date.toISOString().split("T")[0];
}

/**
 * Updates a key state, resetting rate-limits, failure counts, and daily quotas if their timers expired.
 */
function refreshKeyState(state: KeyState) {
  const now = Date.now();

  // Reset rate limits after 60 seconds (free tier usually resets per minute)
  if (state.status === "RATE_LIMITED" && now - state.rateLimitedAt >= 60000) {
    state.status = "ACTIVE";
  }

  // Reset daily exhaust at midnight IST
  if (state.status === "EXHAUSTED" && state.exhaustedDate !== getTodayISTString()) {
    state.status = "ACTIVE";
    state.exhaustedDate = "";
  }

  // Reset failure counts every hour
  if (now - state.lastFailureReset >= 3600000) {
    state.failures = 0;
    state.lastFailureReset = now;
  }
}

/**
 * Returns the next available active key, or null if all keys are exhausted/limited.
 */
function getNextAvailableKeyIndex(): number | null {
  const todayIST = getTodayISTString();

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

export interface GroqCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call Groq completions endpoint with automated API key rotation and error recovery.
 */
export async function groqChatCompletion(
  request: GroqCompletionRequest
): Promise<any> {
  const maxAttempts = KEY_COUNT;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIdx = getNextAvailableKeyIndex();
    if (keyIdx === null) {
      console.warn("[Groq Rotation] All available Groq keys are exhausted or rate-limited.");
      return null;
    }

    const state = keyStates[keyIdx];
    const apiKey = getGroqKey(state.index)!;

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
        // Success: reset key failures
        state.failures = 0;
        return await response.json();
      }

      // Handle specific API error codes
      if (response.status === 429) {
        // Rate limit exceeded
        console.warn(`[Groq Rotation] Key ${state.index} rate-limited (429). Rotating key.`);
        state.status = "RATE_LIMITED";
        state.rateLimitedAt = Date.now();
      } else if (response.status === 413 || response.status === 402) {
        // Payload too large, or payment/quota exhaustion
        console.warn(`[Groq Rotation] Key ${state.index} exhausted/quota hit (${response.status}). Rotating key.`);
        state.status = "EXHAUSTED";
        state.exhaustedDate = getTodayISTString();
      } else {
        // General error (like 500 or other bad request)
        state.failures++;
        console.error(`[Groq Rotation] Key ${state.index} failed with status ${response.status}. Consecutive failures: ${state.failures}`);
      }

    } catch (err: any) {
      state.failures++;
      console.error(`[Groq Rotation] Network error on Key ${state.index}. Consecutive failures: ${state.failures}`, err);
    }

    // Advance to next key pointer for subsequent retry/call
    currentKeyIndex = (currentKeyIndex + 1) % KEY_COUNT;
  }

  throw new Error("All Groq API keys failed or were exhausted.");
}
