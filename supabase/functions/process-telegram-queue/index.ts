import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8585881447:AAE1_z-hAnsPujKTsjwForq1bQcvmVZEqhY";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface QueueItem {
  id: string;
  user_id: string;
  telegram_chat_id: string;
  message_text: string;
  retry_count: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-telegram-queue] Worker started...");

    // Claim next batch of 50 pending/retrying notifications
    const { data: queueItems, error: claimError } = await supabase.rpc(
      "claim_next_notifications_batch",
      { batch_size: 50 }
    );

    if (claimError) {
      console.error("[process-telegram-queue] Claim batch RPC error:", claimError);
      throw claimError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("[process-telegram-queue] No pending notifications to process.");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-telegram-queue] Processing ${queueItems.length} claimed notifications...`);
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < queueItems.length; i++) {
      const item: QueueItem = queueItems[i];
      console.log(`[process-telegram-queue] Dispatching item ${item.id} to chat ${item.telegram_chat_id}`);

      try {
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: item.telegram_chat_id,
            text: item.message_text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });

        const resData = await response.json();

        if (response.ok && resData.ok) {
          // Success
          await supabase
            .from("telegram_notifications_queue")
            .update({ status: "sent", processed_at: new Date().toISOString(), error_message: null })
            .eq("id", item.id);
          sentCount++;
          console.log(`[process-telegram-queue] Sent notification ${item.id} successfully`);
        } else {
          // Telegram API Error
          const errDesc = resData.description || "Telegram API Send Error";
          console.error(`[process-telegram-queue] Telegram send error for item ${item.id}:`, errDesc);
          
          let nextRetryCount = item.retry_count + 1;
          let connectionDeactivated = false;

          // Check if user blocked the bot or chat was not found
          const isBlocked = 
            errDesc.toLowerCase().includes("blocked") || 
            errDesc.toLowerCase().includes("chat not found") || 
            errDesc.toLowerCase().includes("deactivated");

          if (isBlocked) {
            nextRetryCount = 99; // Stop retrying permanently
            connectionDeactivated = true;
            
            // Deactivate connection in DB to prevent further spam
            await supabase
              .from("telegram_connections")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("telegram_chat_id", item.telegram_chat_id);
              
            console.warn(`[process-telegram-queue] Chat ${item.telegram_chat_id} is unavailable/blocked. Deactivating telegram connection.`);
          }

          await supabase
            .from("telegram_notifications_queue")
            .update({
              status: "failed",
              retry_count: nextRetryCount,
              error_message: `${errDesc}${connectionDeactivated ? ' (Bot blocked/chat unavailable)' : ''}`,
              processed_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          failedCount++;
        }
      } catch (err: any) {
        // Fetch or other connection exception
        console.error(`[process-telegram-queue] Network exception for item ${item.id}:`, err);
        await supabase
          .from("telegram_notifications_queue")
          .update({
            status: "failed",
            retry_count: item.retry_count + 1,
            error_message: err.message || "Network request failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failedCount++;
      }

      // 50ms delay to keep rate below 20 requests/sec (well within Telegram's 30/sec limit)
      if (queueItems.length > 1 && i < queueItems.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems.length,
        sent: sentCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[process-telegram-queue] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
