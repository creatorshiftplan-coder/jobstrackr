// Groq API Client with Automated Key Rotation & Error Recovery
// Exposes a call API to make Llama model chat completion calls.

const KEY_COUNT = 8;
const keysOrder = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Helper to fetch a key from various environments (process.env, Deno.env, import.meta.env)
 */
function getGroqKey(index: number): string | undefined {
  // 1. Try process.env variables (Vite statically replaces these in the frontend)
  try {
    let val: string | undefined;
    switch (index) {
      case 1: val = process.env.GROQ_API_KEY; break;
      case 2: val = process.env.GROQ_API_KEY_2; break;
      case 3: val = process.env.GROQ_API_KEY_3; break;
      case 4: val = process.env.GROQ_API_KEY_4; break;
      case 5: val = process.env.GROQ_API_KEY_5; break;
      case 6: val = process.env.GROQ_API_KEY_6; break;
      case 7: val = process.env.GROQ_API_KEY_7; break;
      case 8: val = process.env.GROQ_API_KEY_8; break;
    }
    if (val && !val.startsWith("process.env.")) return val;
  } catch (e) {
    // process is not defined, ignore and proceed to fallbacks
  }

  // 2. Try Deno.env
  try {
    // @ts-ignore
    if (typeof Deno !== "undefined" && Deno.env) {
      const name = index === 1 ? "GROQ_API_KEY" : `GROQ_API_KEY_${index}`;
      // @ts-ignore
      const val = Deno.env.get(name);
      if (val) return val;
    }
  } catch (e) {}

  // 3. Try import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const name = index === 1 ? "GROQ_API_KEY" : `GROQ_API_KEY_${index}`;
      // @ts-ignore
      const val = import.meta.env[name];
      if (val) return val;
    }
  } catch (e) {}

  return undefined;
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
  let lastError = "All Groq API keys failed";

  for (let attempt = 0; attempt < KEY_COUNT; attempt++) {
    // Always fetch the first key from the current queue order
    const keyNum = keysOrder[0];
    const apiKey = getGroqKey(keyNum);

    if (!apiKey) {
      // If the key is not configured, shift it to the end of the queue immediately
      keysOrder.push(keysOrder.shift()!);
      continue;
    }

    console.log(`Trying Groq Key ${keyNum}/${KEY_COUNT} (Attempt ${attempt + 1})`);

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
        // Success: keep the working key at the front of the queue
        return await response.json();
      }

      const statusCode = response.status;
      const errorText = await response.text().catch(() => "");
      console.warn(`[Groq Rotation] Key ${keyNum} failed with status ${statusCode}: ${errorText.slice(0, 100)}`);
      lastError = `Key ${keyNum} failed: ${statusCode} - ${errorText.slice(0, 50)}`;

      // Move the failed key to the end of the queue
      keysOrder.push(keysOrder.shift()!);

      // Cooldown wait before trying the next key
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;

    } catch (err: any) {
      console.error(`[Groq Rotation] Network error on Key ${keyNum}:`, err);
      lastError = `Network error on Key ${keyNum}: ${err.message || err}`;

      // Move the failed key to the end of the queue
      keysOrder.push(keysOrder.shift()!);

      // Cooldown wait before trying the next key
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
  }

  throw new Error(`All Groq API keys failed. Last error: ${lastError}`);
}
