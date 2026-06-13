import { format } from "date-fns";
import { CountdownItem } from "@/hooks/useCountdownExams";

/** Public origin for share links — falls back to the prod domain during SSR/build. */
export function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://jobstrackr.in";
}

/** Canonical shareable URL for a single exam's countdown. */
export function countdownShareUrl(item: CountdownItem): string {
  // Jobs have a rich, server-rendered detail page (with OG previews); link
  // straight to it. Exam-updates use the dedicated countdown share landing.
  if (item.sourceType === "job") {
    return `${appOrigin()}${item.slug ? `/jobs/${item.slug}` : `/job/${item.sourceId}`}`;
  }
  return `${appOrigin()}/countdown/${item.slug || item.sourceId}`;
}

/** Human countdown phrase, e.g. "Only 23 days left" / "is TODAY". */
export function countdownPhrase(daysLeft: number): string {
  if (daysLeft <= 0) return "is TODAY";
  if (daysLeft === 1) return "Only 1 day left";
  return `Only ${daysLeft} days left`;
}

/** Marketing-friendly share caption (used for WhatsApp / Telegram / native text). */
export function buildShareText(item: CountdownItem): string {
  const phrase = countdownPhrase(item.daysLeft);
  const dateStr = format(item.examDate, "EEE, d MMM yyyy");
  const title = item.title?.trim() || "this exam";
  return `⏰ ${phrase} for ${title}!\n📅 ${item.eventLabel}: ${dateStr}\n\nTrack the live countdown on JobsTrackr 👇`;
}

export function whatsappShareUrl(item: CountdownItem): string {
  const text = `${buildShareText(item)}\n${countdownShareUrl(item)}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(item: CountdownItem): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    countdownShareUrl(item)
  )}&text=${encodeURIComponent(buildShareText(item))}`;
}
