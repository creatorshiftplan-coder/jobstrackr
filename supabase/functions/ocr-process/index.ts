import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ data: null, error: "AI service not configured", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ data: null, error: "Authorization required", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ data: null, error: "Invalid token", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc("check_user_rate_limit", {
      _user_id: user.id,
      _daily_limit: DAILY_LIMIT,
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    } else if (rateLimitData && !rateLimitData.allowed) {
      return new Response(
        JSON.stringify({
          data: null,
          error: `Daily limit of ${DAILY_LIMIT} API calls reached. Please try again tomorrow.`,
          rate_limit: rateLimitData,
          success: false,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ data: null, error: "Method not allowed", success: false }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { document_id, document_type, file_url } = body;

    if (!document_id || !file_url) {
      return new Response(
        JSON.stringify({ data: null, error: "Document ID and file URL required", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing OCR for document ${document_id}, type: ${document_type}`);

    // Update document status to processing
    await supabase
      .from("documents")
      .update({ ocr_status: "processing" })
      .eq("id", document_id)
      .eq("user_id", user.id);

    // Download the file
    const urlParts = file_url.split("/storage/v1/object/public/documents/");
    if (urlParts.length !== 2) {
      throw new Error("Invalid file URL format");
    }
    const filePath = decodeURIComponent(urlParts[1]);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || "Unknown error"}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    const extension = filePath.split(".").pop()?.toLowerCase() || "jpeg";
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
    };
    const mimeType = mimeTypes[extension] || "image/jpeg";

    // Extraction prompts based on document type
    const extractionPrompts: Record<string, string> = {
      aadhar: `Extract from this Aadhaar card: Full Name, Date of Birth (YYYY-MM-DD), Gender, Aadhaar Number (12 digits), Address.
Return ONLY JSON: { "full_name": "", "date_of_birth": "", "gender": "", "aadhar_number": "", "address": "" }`,
      pan: `Extract from this PAN card: Full Name, Father's Name, Date of Birth (YYYY-MM-DD), PAN Number (10 chars).
Return ONLY JSON: { "full_name": "", "father_name": "", "date_of_birth": "", "pan_number": "" }`,
      passport: `Extract from this passport: Full Name, Date of Birth (YYYY-MM-DD), Gender, Passport Number, Father's Name, Mother's Name.
Return ONLY JSON: { "full_name": "", "date_of_birth": "", "gender": "", "passport_number": "", "father_name": "", "mother_name": "" }`,
      marksheet: `Extract from this marksheet: Full Name, Father's Name, Mother's Name, Date of Birth, Roll Number, Institute, Board/University, Qualification, Passing Date, Percentage/CGPA.
Return ONLY JSON: { "full_name": "", "father_name": "", "mother_name": "", "date_of_birth": "", "roll_number": "", "institute_name": "", "board_university": "", "qualification_name": "", "date_of_passing": "", "percentage": null, "cgpa": null }`,
      caste_certificate: `Extract from this Caste Certificate: Full Name, Father's Name, Category (SC/ST/OBC/EWS), Caste Name, Certificate Number, Issuing Authority, Issue Date, Address.
Return ONLY JSON: { "full_name": "", "father_name": "", "category": "", "caste_name": "", "caste_certificate_number": "", "caste_issuing_authority": "", "caste_issue_date": "", "address": "" }`,
      photo: `Return ONLY JSON: { "photo_uploaded": true }`,
      signature: `Return ONLY JSON: { "signature_uploaded": true }`,
    };

    const prompt = extractionPrompts[document_type] || `Extract all personal information from this document. Return ONLY JSON with fields like: full_name, date_of_birth, gender, address, etc.`;

    // Call Gemini Vision API directly
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);

      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ data: null, error: "Rate limit exceeded. Please try again later.", success: false }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI raw response:", aiContent);

    // Parse JSON response
    let extractedFields: Record<string, unknown> = {};
    try {
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      extractedFields = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extractedFields = { raw_text: aiContent };
    }

    const ocrResult = {
      status: "completed",
      document_type,
      extracted_fields: extractedFields,
      processed_at: new Date().toISOString(),
      confidence: "high",
    };

    // Update document with OCR result
    const { data, error } = await supabase
      .from("documents")
      .update({ ocr_status: "completed", ocr_result: ocrResult })
      .eq("id", document_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // Log the update
    await supabase.from("update_logs").insert({
      user_id: user.id,
      source: "ocr",
      action: "process_document",
      target_table: "documents",
      target_id: document_id,
      new_data: ocrResult,
    });

    console.log(`OCR completed for document ${document_id}`);

    return new Response(
      JSON.stringify({ data: { ...data, extracted_fields: extractedFields }, error: null, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ocr-process function:", error);
    return new Response(
      JSON.stringify({ data: null, error: error instanceof Error ? error.message : "Unknown error", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
