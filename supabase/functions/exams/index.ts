import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const examId = url.searchParams.get("id");

    // GET - List exams or get single exam
    if (req.method === "GET") {
      if (examId) {
        console.log(`Fetching exam with ID: ${examId}`);
        const { data, error } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data, error: null, success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Fetching all active exams");
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return new Response(JSON.stringify({ data, error: null, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Create new exam
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Creating new exam:", body.name);

      const { data, error } = await supabase
        .from("exams")
        .insert(body)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ data, error: null, success: true }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT - Update exam
    if (req.method === "PUT") {
      if (!examId) {
        return new Response(
          JSON.stringify({ data: null, error: "Exam ID required", success: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      console.log(`Updating exam ${examId}`);

      const { data, error } = await supabase
        .from("exams")
        .update(body)
        .eq("id", examId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ data, error: null, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - Soft delete exam
    if (req.method === "DELETE") {
      if (!examId) {
        return new Response(
          JSON.stringify({ data: null, error: "Exam ID required", success: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Soft deleting exam ${examId}`);
      const { data, error } = await supabase
        .from("exams")
        .update({ is_active: false })
        .eq("id", examId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ data, error: null, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ data: null, error: "Method not allowed", success: false }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in exams function:", error);
    return new Response(
      JSON.stringify({ data: null, error: error instanceof Error ? error.message : "Unknown error", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
