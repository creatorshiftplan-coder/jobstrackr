import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 7;

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
      console.error("GEMINI_API_KEY not configured");
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

    // Check if user is admin (admins bypass rate limit)
    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });
    const isAdmin = isAdminData === true;

    // Check rate limit only for non-admin users
    if (!isAdmin) {
      const { data: rateLimitData, error: rateLimitError } = await supabase.rpc("check_user_rate_limit", {
        _user_id: user.id,
        _daily_limit: DAILY_LIMIT,
      });

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      } else if (rateLimitData && !rateLimitData.allowed) {
        console.log(`Rate limit exceeded for user ${user.id}: ${rateLimitData.used}/${rateLimitData.limit}`);
        return new Response(
          JSON.stringify({
            data: null,
            error: "AI limit reached! You've used all 7 daily requests. Your limit resets at 11:59 PM IST. Please try again tomorrow.",
            rate_limit: rateLimitData,
            success: false,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
    console.log(`File URL received: ${file_url}`);

    // Update document status to processing
    const { error: updateError } = await supabase
      .from("documents")
      .update({ ocr_status: "processing" })
      .eq("id", document_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update document status:", updateError);
    }

    // Download the file - handle different URL formats
    let filePath = "";
    
    // Check for different URL patterns
    if (file_url.includes("/storage/v1/object/public/documents/")) {
      const urlParts = file_url.split("/storage/v1/object/public/documents/");
      if (urlParts.length === 2) {
        filePath = decodeURIComponent(urlParts[1]);
      }
    } else if (file_url.includes("/storage/v1/object/sign/documents/")) {
      // Handle signed URLs
      const urlParts = file_url.split("/storage/v1/object/sign/documents/");
      if (urlParts.length === 2) {
        filePath = decodeURIComponent(urlParts[1].split("?")[0]);
      }
    } else if (file_url.startsWith("documents/")) {
      // Handle internal path format: documents/user-id/filename
      filePath = file_url.replace("documents/", "");
    } else {
      // Try to extract path from any URL format
      const match = file_url.match(/documents\/(.+?)(?:\?|$)/);
      if (match) {
        filePath = decodeURIComponent(match[1]);
      }
    }

    if (!filePath) {
      console.error("Could not parse file path from URL:", file_url);
      await supabase
        .from("documents")
        .update({ ocr_status: "failed" })
        .eq("id", document_id)
        .eq("user_id", user.id);
      throw new Error("Invalid file URL format. Could not extract file path.");
    }

    console.log(`Extracted file path: ${filePath}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError) {
      console.error("File download error:", downloadError);
      await supabase
        .from("documents")
        .update({ ocr_status: "failed" })
        .eq("id", document_id)
        .eq("user_id", user.id);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
    
    if (!fileData) {
      console.error("No file data returned");
      await supabase
        .from("documents")
        .update({ ocr_status: "failed" })
        .eq("id", document_id)
        .eq("user_id", user.id);
      throw new Error("Failed to download file: No data returned");
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    console.log(`File downloaded: ${filePath}, size: ${arrayBuffer.byteLength} bytes`);
    
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
    
    console.log(`Converted to base64: ${base64.length} chars, MIME type: ${mimeType}`);

    // Extraction prompts based on document type (simplified to 5 types)
    const extractionPrompts: Record<string, string> = {
      identity_card: `Extract from this Identity Card (Aadhaar/PAN/Passport):

If AADHAAR CARD:
- Full Name, Date of Birth (YYYY-MM-DD), Gender, Aadhaar Number (12 digits), Address

If PAN CARD:
- Full Name, Father's Name, Date of Birth (YYYY-MM-DD), PAN Number (10 chars)

If PASSPORT:
- Full Name, Date of Birth (YYYY-MM-DD), Gender, Passport Number, Father's Name, Mother's Name

Return ONLY JSON with applicable fields:
{
  "full_name": "",
  "father_name": "",
  "mother_name": "",
  "date_of_birth": "",
  "gender": "",
  "aadhar_number": "",
  "pan_number": "",
  "passport_number": "",
  "address": ""
}
Use null for fields not found.`,

      marksheet: `Extract from this Marksheet (any class/degree):
- Full Name, Father's Name, Mother's Name, Date of Birth (YYYY-MM-DD)
- Roll Number, Institute/School/College Name, Board/University Name
- Qualification Type (determine: 10th, 12th, graduation, post_graduation, diploma)
- Qualification Name (e.g., B.Tech, B.Sc, MBA, etc. if applicable)
- Date/Year of Passing (YYYY-MM-DD or YYYY-01-01)
- Marks Obtained, Maximum Marks, Percentage, CGPA

Return ONLY JSON:
{
  "full_name": "",
  "father_name": "",
  "mother_name": "",
  "date_of_birth": "",
  "roll_number": "",
  "institute_name": "",
  "board_university": "",
  "qualification_type": "",
  "qualification_name": "",
  "date_of_passing": "",
  "marks_obtained": null,
  "maximum_marks": null,
  "percentage": null,
  "cgpa": null
}
Use null for fields not found. qualification_type MUST be one of: 10th, 12th, graduation, post_graduation, diploma, other.`,

      certificate: `Extract from this Certificate (any class/degree):
- Full Name, Father's Name, Mother's Name, Date of Birth (YYYY-MM-DD)
- Roll Number, Institute/School/College Name, Board/University Name
- Qualification Type (determine: 10th, 12th, graduation, post_graduation, diploma)
- Qualification Name (e.g., B.Tech, B.Sc, MBA, etc. if applicable)
- Date/Year of Passing (YYYY-MM-DD or YYYY-01-01)

Return ONLY JSON:
{
  "full_name": "",
  "father_name": "",
  "mother_name": "",
  "date_of_birth": "",
  "roll_number": "",
  "institute_name": "",
  "board_university": "",
  "qualification_type": "",
  "qualification_name": "",
  "date_of_passing": ""
}
Use null for fields not found. qualification_type MUST be one of: 10th, 12th, graduation, post_graduation, diploma, other.`,
      
      caste_certificate: `Extract from this Caste Certificate:
- Full Name, Father's Name
- Category (SC/ST/OBC/EWS/General)
- Caste Name (specific caste/community)
- Sub-Caste (if mentioned separately)
- Certificate Number
- Issuing Authority
- Issue Date (YYYY-MM-DD)
- Valid Until (YYYY-MM-DD if mentioned)
- Address

Return ONLY JSON:
{
  "full_name": "",
  "father_name": "",
  "category": "",
  "caste_name": "",
  "sub_category": "",
  "caste_certificate_number": "",
  "caste_issuing_authority": "",
  "caste_issue_date": "",
  "address": ""
}
Use null for fields not found.`,

      job_application: `Extract ALL details from this Job Application Form/PDF:

PERSONAL DETAILS:
- Full Name, Father's Name, Mother's Name, Date of Birth (YYYY-MM-DD), Gender, Marital Status, Category

IDENTITY NUMBERS:
- Aadhaar Number (12 digits), PAN Number (10 chars), Passport Number

CONTACT INFORMATION:
- Phone, Email, Address, PIN Code

EDUCATIONAL QUALIFICATIONS:
- Qualification Type (10th/12th/graduation/post_graduation), Qualification Name, Board/University, Date of Passing, Percentage/CGPA, Roll Number, Institute Name

CATEGORY DETAILS:
- Caste Name, Sub-Category, Disability Type (if PwBD)

Return ONLY JSON:
{
  "full_name": "",
  "father_name": "",
  "mother_name": "",
  "date_of_birth": "",
  "gender": "",
  "marital_status": "",
  "category": "",
  "aadhar_number": "",
  "pan_number": "",
  "passport_number": "",
  "phone": "",
  "email": "",
  "address": "",
  "pincode": "",
  "qualification_type": "",
  "qualification_name": "",
  "board_university": "",
  "institute_name": "",
  "date_of_passing": "",
  "percentage": null,
  "cgpa": null,
  "roll_number": "",
  "caste_name": "",
  "sub_category": "",
  "disability_type": ""
}
Use null for fields not found.`,
    };

    const prompt = extractionPrompts[document_type] || `Extract all personal information from this document. Return ONLY JSON with fields like: full_name, date_of_birth, gender, address, qualification_type, etc. Use null for missing fields.`;

    console.log(`Calling Gemini API for document type: ${document_type}`);

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);

      // Handle 402 Credit Exhaustion
      if (geminiResponse.status === 402) {
        await supabase
          .from("documents")
          .update({ ocr_status: "failed" })
          .eq("id", document_id)
          .eq("user_id", user.id);
          
        return new Response(
          JSON.stringify({ data: null, error: "AI service credits exhausted. Please contact support.", success: false }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle 429 Rate Limit
      if (geminiResponse.status === 429) {
        await supabase
          .from("documents")
          .update({ ocr_status: "failed" })
          .eq("id", document_id)
          .eq("user_id", user.id);
          
        return new Response(
          JSON.stringify({ data: null, error: "AI service rate limit exceeded. Please try again in a few minutes.", success: false }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("AI raw response length:", aiContent.length);
    console.log("AI raw response preview:", aiContent.substring(0, 500));

    // Parse JSON response
    let extractedFields: Record<string, unknown> = {};
    try {
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      extractedFields = JSON.parse(jsonStr.trim());
      console.log("Successfully parsed JSON response");
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content that failed to parse:", aiContent);
      extractedFields = { raw_text: aiContent };
    }

    // Count extracted fields (excluding nulls and empty strings)
    const fieldCount = Object.entries(extractedFields).filter(
      ([_, v]) => v !== null && v !== undefined && v !== ""
    ).length;

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
      .update({ 
        ocr_status: "completed",
        ocr_result: ocrResult 
      })
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

    console.log(`OCR completed for document ${document_id}, extracted ${fieldCount} fields`);

    return new Response(
      JSON.stringify({ data: { ...data, extracted_fields: extractedFields }, error: null, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ocr-process function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ data: null, error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
