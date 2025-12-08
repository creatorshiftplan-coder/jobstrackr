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

    // Validate authentication from JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ data: null, error: "Missing authorization header", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ data: null, error: "Invalid or expired token", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const url = new URL(req.url);
    const examId = url.searchParams.get("id");

    // GET - List exams or get single exam (any authenticated user)
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

    // For write operations (POST, PUT, DELETE), check admin role
    const isWriteOperation = ["POST", "PUT", "DELETE"].includes(req.method);
    if (isWriteOperation) {
      const { data: hasAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!hasAdminRole) {
        console.log(`User ${user.id} attempted write operation without admin role`);
        return new Response(
          JSON.stringify({ data: null, error: "Admin access required for this operation", success: false }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Admin user ${user.id} performing ${req.method} operation`);
    }

    // POST - Create new exam (admin only)
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

    // PUT - Update exam (admin only)
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

    // DELETE - Soft delete exam (admin only)
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
