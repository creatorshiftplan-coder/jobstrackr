import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadApiKeys } from "../_shared/apiKeyRotation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mathematical helper to normalize sliced vectors to unit length (L2 Norm)
function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

// Helper to construct embedding text for jobs
function buildJobEmbeddingText(job: any): string {
  const parts = [
    job.title,
    job.department,
    job.tags ? job.tags.join(" ") : "",
    job.qualification,
    job.eligibility,
    job.description ? job.description.slice(0, 1000) : "", // generous context window (nomic supports 8k)
  ];
  return parts.filter(Boolean).join(" ");
}

// Helper to fetch embeddings from Groq with rotation
async function getGroqEmbedding(text: string, groqKeys: any[]): Promise<number[]> {
  if (groqKeys.length === 0) {
    throw new Error("No Groq API keys configured");
  }

  let lastError = "All Groq API keys failed";

  for (let i = 0; i < groqKeys.length; i++) {
    const key = groqKeys[i];
    console.log(`[Embedding] Trying key ${i + 1}/${groqKeys.length}: ${key.label || key.id}`);
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key.api_key}`,
        },
        body: JSON.stringify({
          model: "nomic-embed-text-v1.5",
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawVector = data.data?.[0]?.embedding;
        if (rawVector && Array.isArray(rawVector)) {
          console.log(`[Embedding] Key ${i + 1} succeeded`);
          return rawVector;
        }
      }

      const statusCode = response.status;
      const errorText = await response.text().catch(() => "");
      console.warn(`[Embedding] Key ${i + 1} failed (${statusCode}):`, errorText.slice(0, 200));
      lastError = `Groq API error ${statusCode}: ${errorText.slice(0, 100)}`;
    } catch (e: any) {
      console.error(`[Embedding] Key ${i + 1} network error:`, e);
      lastError = `Network error: ${e.message}`;
    }
  }

  throw new Error(lastError);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load keys & filter for groq provider
    const apiKeys = await loadApiKeys(supabase);
    const groqKeys = apiKeys.filter(k => k.provider === "groq");

    if (groqKeys.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Groq AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, user_id, user_text } = body;

    // --- Action 1: PROFILE EMBEDDING UPDATE ---
    if (action === "profile") {
      if (!user_id || !user_text) {
        return new Response(
          JSON.stringify({ success: false, error: "user_id and user_text are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Profile Embedding] Generating embedding for user profile: ${user_id}`);
      const rawVector = await getGroqEmbedding(user_text, groqKeys);
      
      // Matryoshka Slicing (768 to 384 dimensions) + L2 Normalization
      const sliced = rawVector.slice(0, 384);
      const normalized = normalizeVector(sliced);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ embedding: normalized })
        .eq("user_id", user_id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, message: "Profile embedding successfully updated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Action 2: DEFERRED JOB EMBEDDING QUEUE PROCESSOR (default) ---
    console.log("[Jobs Embedding] Processing deferred jobs embedding queue (jobs created > 30 minutes ago)...");
    
    const cutOffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago

    const { data: jobs, error: fetchError } = await supabase
      .from("jobs")
      .select("id, title, department, description, qualification, eligibility, tags, embedding_attempts")
      .is("embedding", null)
      .lt("embedding_attempts", 3)
      .lte("created_at", cutOffTime)
      .limit(10); // Process in batches of 10 to stay safely under function/API timeouts

    if (fetchError) {
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending jobs in the queue to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Jobs Embedding] Found ${jobs.length} jobs to embed.`);
    let successCount = 0;
    let failCount = 0;

    for (const job of jobs) {
      const attempts = (job.embedding_attempts || 0) + 1;
      const textToEmbed = buildJobEmbeddingText(job);

      try {
        const rawVector = await getGroqEmbedding(textToEmbed, groqKeys);
        
        // Matryoshka Slicing + L2 Normalization
        const sliced = rawVector.slice(0, 384);
        const normalized = normalizeVector(sliced);

        const { error: updateError } = await supabase
          .from("jobs")
          .update({
            embedding: normalized,
            embedding_attempts: attempts,
            embedding_error: null
          })
          .eq("id", job.id);

        if (updateError) throw updateError;
        successCount++;
        console.log(`[Jobs Embedding] Successfully embedded job: ${job.title} (${job.id})`);
      } catch (err: any) {
        failCount++;
        console.error(`[Jobs Embedding] Failed to embed job: ${job.title}. Attempt ${attempts}/3. Error: ${err.message}`);
        
        await supabase
          .from("jobs")
          .update({
            embedding_attempts: attempts,
            embedding_error: err.message || "Unknown embedding generation error"
          })
          .eq("id", job.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: jobs.length,
        succeeded: successCount,
        failed: failCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in process-embeddings function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
