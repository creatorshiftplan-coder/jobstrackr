import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8585881447:AAE1_z-hAnsPujKTsjwForq1bQcvmVZEqhY";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: object) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
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
            "❌ *Connection Error*\n\nFailed to link your account. Please try again from the website."
          );
        } else {
          // Success Response
          const successMessage = `
🎉 *Account Connected!*

Your Telegram account has been successfully linked to JobsTrackr. 

You will now receive instant alerts for:
• New Vacancies 🚨
• Admit Cards 🎫
• Result Declarations 🏆
• Answer Keys 🔑

Configure your detailed job alerts, qualifications, and state preferences at:
https://www.jobstrackr.in/settings/notifications
          `.trim();
          await sendTelegramMessage(chatId, successMessage);
        }
      } else {
        // start without userId
        const welcomeMessage = `
👋 *Welcome to JobsTrackr Bot!*

To receive personalized job notifications, you need to link your Telegram account from the JobsTrackr website.

1️⃣ Go to the Settings page in JobsTrackr.
2️⃣ Tap "Connect Telegram" under Notifications.
3️⃣ You will be redirected back here to link your account.

Link page: https://www.jobstrackr.in/settings/notifications
        `.trim();
        await sendTelegramMessage(chatId, welcomeMessage);
      }
    } else if (text === "/help") {
      const helpMessage = `
🤖 *JobsTrackr Bot Commands*

Here is how you can manage your notifications:
• /start <id> - Connect your Telegram account
• /preferences - Link to manage your job preferences
• /stop - Temporarily pause job notifications
• /resume - Resume job notifications
• /help - Display this help message

Manage all your detailed job interests (SSC, UPSC, Banking, etc.) directly on the JobsTrackr website.
      `.trim();
      await sendTelegramMessage(chatId, helpMessage);
    } else if (text === "/preferences") {
      const prefMessage = `
⚙️ *Notification Preferences*

You can manage your categories, qualifications, and state filters directly inside your JobsTrackr account.
      `.trim();
      await sendTelegramMessage(chatId, prefMessage, {
        inline_keyboard: [
          [
            {
              text: "Manage Preferences",
              url: "https://www.jobstrackr.in/settings/notifications",
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
🔕 *Notifications Paused*

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
🔔 *Notifications Resumed*

Welcome back! You will now receive personalized job alerts on Telegram based on your preferences.
        `.trim();
        await sendTelegramMessage(chatId, resumeMessage);
      }
    } else {
      // Unrecognized commands
      await sendTelegramMessage(
        chatId,
        "❓ *Unrecognized Command*\n\nType /help to see all available bot commands."
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
