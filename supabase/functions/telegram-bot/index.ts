import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is missing!");
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function escapeHtml(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: object) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("[telegram-bot] Send message failed:", errorData);
    }
  } catch (error) {
    console.error("[telegram-bot] Fetch error sending message:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Telegram webhook secret token to prevent notification hijacking
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (webhookSecret) {
    const receivedSecret = req.headers.get("X-Telegram-Bot-API-Secret-Token");
    if (receivedSecret !== webhookSecret) {
      console.error("Security Alert: Unauthorized Telegram bot webhook invocation attempt.");
      return new Response(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } else {
    console.warn("TELEGRAM_WEBHOOK_SECRET is not configured. Webhook secret validation is bypassed.");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("[telegram-bot] Received update:", JSON.stringify(body));

    // We only process message updates
    const message = body.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const chatType = message.chat.type;

    // Direct support only for private chats
    if (chatType !== "private") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Command Routing
    if (text.startsWith("/start")) {
      const match = text.match(/^\/start\s+([a-fA-F0-9-]{36})$/i);
      
      if (match) {
        const userId = match[1];
        console.log(`[telegram-bot] Linking user ${userId} to chat ${chatId}`);

        // Fetch name from profiles
        let userName = "Aspirant";
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile?.full_name) {
          userName = profile.full_name;
        }

        // Ensure notification preferences row exists for this user to satisfy foreign key constraints
        const { error: prefError } = await supabase
          .from("notification_preferences")
          .upsert(
            { user_id: userId },
            { onConflict: "user_id", ignoreDuplicates: true }
          );

        if (prefError) {
          console.error("[telegram-bot] Preference initialization error:", prefError);
        }

        // Save connection in supabase (upsert)
        const { error } = await supabase
          .from("telegram_connections")
          .upsert(
            {
              user_id: userId,
              telegram_chat_id: String(chatId),
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "telegram_chat_id" }
          );

        if (error) {
          console.error("[telegram-bot] DB Upsert error:", error);
          await sendTelegramMessage(
            chatId,
            "❌ <b>Connection Error</b>\n\nFailed to link your account. Please try again from the website."
          );
        } else {
          // Success Response
          const successMessage = `
Welcome <b>${escapeHtml(userName)}</b>! You are subscribed to the latest job notification and updates personalised just for you.
          `.trim();
          await sendTelegramMessage(chatId, successMessage);
        }
      } else {
        // start without userId
        const welcomeMessage = `
👋 <b>Welcome to JobsTrackr Bot!</b>

To receive personalized job notifications, you need to link your Telegram account from the JobsTrackr website.

1️⃣ Go to the Settings page in JobsTrackr.
2️⃣ Tap "Connect Telegram" under Notifications.
3️⃣ You will be redirected back here to link your account.

Link page: https://jobstrackr.in/settings/notifications
        `.trim();
        await sendTelegramMessage(chatId, welcomeMessage);
      }
    } else if (text === "/help") {
      const helpMessage = `
🤖 <b>JobsTrackr Bot Commands</b>

Here is how you can manage your notifications:
• /start &lt;id&gt; - Connect your Telegram account
• /preferences - Link to manage your job preferences
• /stop - Temporarily pause job notifications
• /resume - Resume job notifications
• /help - Display this help message

Manage all your detailed job interests (SSC, UPSC, Banking, etc.) directly on the JobsTrackr website.
      `.trim();
      await sendTelegramMessage(chatId, helpMessage);
    } else if (text === "/preferences") {
      const prefMessage = `
⚙️ <b>Notification Preferences</b>

You can manage your categories, qualifications, and state filters directly inside your JobsTrackr account.
      `.trim();
      await sendTelegramMessage(chatId, prefMessage, {
        inline_keyboard: [
          [
            {
              text: "Manage Preferences",
              url: "https://jobstrackr.in/settings/notifications",
            },
          ],
        ],
      });
    } else if (text === "/stop") {
      const { data, error } = await supabase
        .from("telegram_connections")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("telegram_chat_id", String(chatId))
        .select();

      if (error) {
        console.error("[telegram-bot] Stop command failed in DB:", error);
        await sendTelegramMessage(chatId, "❌ Failed to pause notifications. Please try again.");
      } else if (!data || data.length === 0) {
        await sendTelegramMessage(
          chatId,
          "ℹ️ You don't have an active connection to pause. Type /start on the website to connect first."
        );
      } else {
        const stopMessage = `
🔕 <b>Notifications Paused</b>

You will no longer receive job alerts on Telegram. 
Type /resume at any time to start receiving notifications again.
        `.trim();
        await sendTelegramMessage(chatId, stopMessage);
      }
    } else if (text === "/resume") {
      const { data, error } = await supabase
        .from("telegram_connections")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("telegram_chat_id", String(chatId))
        .select();

      if (error) {
        console.error("[telegram-bot] Resume command failed in DB:", error);
        await sendTelegramMessage(chatId, "❌ Failed to resume notifications. Please try again.");
      } else if (!data || data.length === 0) {
        await sendTelegramMessage(
          chatId,
          "ℹ️ You don't have an active connection to resume. Type /start on the website to connect first."
        );
      } else {
        const resumeMessage = `
🔔 <b>Notifications Resumed</b>

Welcome back! You will now receive personalized job alerts on Telegram based on your preferences.
        `.trim();
        await sendTelegramMessage(chatId, resumeMessage);
      }
    } else {
      // Unrecognized commands
      await sendTelegramMessage(
        chatId,
        "❓ <b>Unrecognized Command</b>\n\nType /help to see all available bot commands."
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[telegram-bot] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
