/**
 * Check if a URL contains "freejobalert" (case-insensitive).
 * Used to filter out freejobalert links across the entire app.
 */
export function isFreeJobAlertUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes("freejobalert");
}

/**
 * Check if a URL is a WhatsApp link (groups, chats, api links).
 */
export function isWhatsAppUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes("wa.me") ||
    u.includes("chat.whatsapp.com") ||
    u.includes("api.whatsapp.com") ||
    u.includes("whatsapp.com/") ||
    u.includes("whatsapp://")
  );
}

/**
 * Check if text content promotes a WhatsApp group or link.
 */
export function isWhatsAppContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("whatsapp group") ||
    t.includes("whatsapp channel") ||
    t.includes("join whatsapp") ||
    t.includes("whatsapp link") ||
    t.includes("join our whatsapp")
  );
}

/**
 * Combined check: returns true if the URL should be blocked (freejobalert or WhatsApp).
 */
export function isBlockedUrl(url: string | null | undefined): boolean {
  return isFreeJobAlertUrl(url) || isWhatsAppUrl(url);
}
