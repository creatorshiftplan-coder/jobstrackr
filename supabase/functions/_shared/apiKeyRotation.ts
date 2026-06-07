import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ApiKeyConfig {
  id: string;
  provider: string;
  model_name: string;
  api_key: string;
  is_active: boolean;
  priority: number;
  label: string | null;
  last_used_at: string | null;
  last_error: string | null;
  total_calls: number;
  total_errors: number;
}

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  useGoogleSearch?: boolean;
}

export interface ProviderResponse {
  content: string;
  keyUsed: ApiKeyConfig;
  raw: any;
}

/**
 * Load active API keys from the api_keys_config table, falling back to
 * GEMINI_API_KEY* env vars if no DB keys exist.
 */
export async function loadApiKeys(supabase: SupabaseClient): Promise<ApiKeyConfig[]> {
  try {
    const { data, error } = await supabase
      .from("decrypted_api_keys_config")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("total_errors", { ascending: true });

    if (!error && data && data.length > 0) {
      console.log(`Loaded ${data.length} API keys from DB`);
      return data as ApiKeyConfig[];
    }
  } catch (e) {
    console.warn("Could not load API keys from DB, falling back to env vars:", e);
  }

  // Fallback: build key configs from GEMINI_API_KEY env vars
  const envKeys = [
    Deno.env.get("GEMINI_API_KEY"),
    Deno.env.get("GEMINI_API_KEY_2"),
    Deno.env.get("GEMINI_API_KEY_3"),
    Deno.env.get("GEMINI_API_KEY_4"),
    Deno.env.get("GEMINI_API_KEY_5"),
    Deno.env.get("GEMINI_API_KEY_6"),
    Deno.env.get("GEMINI_API_KEY_7"),
  ].filter(Boolean) as string[];

  return envKeys.map((key, i) => ({
    id: `env-${i}`,
    provider: "gemini",
    model_name: "gemini-2.5-flash",
    api_key: key,
    is_active: true,
    priority: i,
    label: `Env Key ${i + 1}`,
    last_used_at: null,
    last_error: null,
    total_calls: 0,
    total_errors: 0,
  }));
}

/**
 * Build the right API URL and request body for a given provider + model.
 */
function buildProviderRequest(
  key: ApiKeyConfig,
  req: ProviderRequest,
): { url: string; headers: Record<string, string>; body: any } {
  const { provider, model_name, api_key } = key;
  const { systemPrompt, userPrompt, temperature = 0.3, maxTokens = 4096, useGoogleSearch } = req;

  switch (provider) {
    case "openrouter": {
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api_key}`,
          "HTTP-Referer": Deno.env.get("SITE_URL") || "https://localhost",
        },
        body: {
          model: model_name,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        },
      };
    }

    case "openai": {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api_key}`,
        },
        body: {
          model: model_name,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        },
      };
    }

    case "groq": {
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api_key}`,
        },
        body: {
          model: model_name,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        },
      };
    }

    case "gemini":
    default: {
      const geminiBody: any = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      };
      if (useGoogleSearch) {
        geminiBody.tools = [{ google_search: {} }];
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model_name}:generateContent?key=${api_key}`,
        headers: { "Content-Type": "application/json" },
        body: geminiBody,
      };
    }
  }
}

/**
 * Extract the text content from the provider-specific response format.
 */
function extractContent(provider: string, responseData: any): string {
  switch (provider) {
    case "openrouter":
    case "openai":
    case "groq":
      return responseData.choices?.[0]?.message?.content || "";

    case "gemini":
    default: {
      const parts = responseData.candidates?.[0]?.content?.parts || [];
      return parts.map((p: any) => p.text || "").join("");
    }
  }
}

/**
 * Try each API key in order until one succeeds. Updates usage stats in DB.
 * Returns the parsed text content and metadata.
 */
export async function callWithRotation(
  supabase: SupabaseClient,
  keys: ApiKeyConfig[],
  req: ProviderRequest,
): Promise<ProviderResponse> {
  if (keys.length === 0) {
    throw new Error("No API keys configured");
  }

  let lastError = "All API keys failed";

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`Trying key ${i + 1}/${keys.length}: ${key.provider}/${key.model_name} (${key.label || key.id})`);

    try {
      const { url, headers, body } = buildProviderRequest(key, req);
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const content = extractContent(key.provider, data);

        // Update success stats (non-blocking)
        if (!key.id.startsWith("env-")) {
          (async () => {
            try {
              await supabase
                .from("api_keys_config")
                .update({
                  last_used_at: new Date().toISOString(),
                  total_calls: (key.total_calls || 0) + 1,
                  last_error: null,
                })
                .eq("id", key.id);
            } catch (e: any) {
              console.warn("Failed to update key stats:", e);
            }
          })();
        }

        console.log(`Key ${i + 1} succeeded (${key.provider}/${key.model_name})`);
        return { content, keyUsed: key, raw: data };
      }

      // Handle specific error codes
      const statusCode = response.status;
      const errorText = await response.text().catch(() => "");

      if (statusCode === 429 || statusCode === 402) {
        console.log(`Key ${i + 1} exhausted (${statusCode}), rotating...`);
        lastError = `Key ${key.label || key.provider} exhausted (${statusCode})`;

        // Update error stats
        if (!key.id.startsWith("env-")) {
          (async () => {
            try {
              await supabase
                .from("api_keys_config")
                .update({
                  last_error: `${statusCode}: rate limited / exhausted`,
                  total_errors: (key.total_errors || 0) + 1,
                })
                .eq("id", key.id);
            } catch {
              // ignore
            }
          })();
        }
        continue;
      }

      if (statusCode >= 500) {
        console.log(`Key ${i + 1} server error (${statusCode}), rotating...`);
        lastError = `Server error: ${statusCode}`;
        continue;
      }

      if (statusCode === 401 || statusCode === 403) {
        console.log(`Key ${i + 1} invalid or blocked (${statusCode}), rotating...`);
        lastError = `Key ${key.label || key.provider} invalid or blocked (${statusCode})`;

        if (!key.id.startsWith("env-")) {
          (async () => {
            try {
              await supabase
                .from("api_keys_config")
                .update({
                  is_active: false,
                  last_error: `${statusCode}: ${errorText.slice(0, 200)}`,
                  total_errors: (key.total_errors || 0) + 1,
                })
                .eq("id", key.id);
            } catch {
              // ignore
            }
          })();
        }
        continue;
      }

      // Client error (4xx except handled cases) — stop trying
      console.error(`Key ${i + 1} client error (${statusCode}):`, errorText.slice(0, 200));
      lastError = `API error ${statusCode}: ${errorText.slice(0, 100)}`;

      if (!key.id.startsWith("env-")) {
        (async () => {
          try {
            await supabase
              .from("api_keys_config")
              .update({
                last_error: `${statusCode}: ${errorText.slice(0, 200)}`,
                total_errors: (key.total_errors || 0) + 1,
              })
              .eq("id", key.id);
          } catch {
            // ignore
          }
        })();
      }
      break;

    } catch (fetchErr) {
      console.error(`Key ${i + 1} network error:`, fetchErr);
      lastError = `Network error: ${(fetchErr as Error).message}`;
      continue;
    }
  }

  throw new Error(lastError);
}
