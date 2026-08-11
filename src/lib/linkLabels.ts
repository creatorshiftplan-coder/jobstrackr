/**
 * Readable labels for scraped links.
 *
 * Source sites label almost every link "Click here", so a card can end up
 * showing two identical buttons with no way to tell the notification PDF from
 * the department's homepage. When the text carries no information, infer one
 * from the URL (and fall back to the update's own category).
 *
 * This was previously inlined in TrackedJobCard; it lives here so every card
 * that renders scraped links labels them the same way.
 */

/** True when the link text tells the user nothing about where it goes. */
export function isGenericLinkText(text: string | null | undefined): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t) return true;
  return (
    t === "click here" || t === "click" || t === "here" ||
    t === "link" || t === "download" || t === "view" ||
    t === "open" || t === "go" || t === "visit" ||
    t.startsWith("click here") || t.startsWith("http")
  );
}

/** Infer a descriptive label from a URL, optionally hinted by the update category. */
export function inferLabelFromUrl(url: string, parentCategory?: string | null): string {
  const u = (url || "").toLowerCase();
  if (u.includes("admit") || u.includes("hall-ticket") || u.includes("hallticket"))
    return "Admit Card";
  if (u.includes("result") || u.includes("score")) return "Check Result";
  if (u.includes("answer") || u.includes("key")) return "Answer Key";
  if (u.includes("apply") || u.includes("registr") || u.includes("application"))
    return "Apply Online";
  if (u.includes("syllabus") || u.includes("pattern")) return "Syllabus";
  if (u.includes("notification") || u.includes(".pdf")) return "Notification PDF";
  if (u.includes("cutoff") || u.includes("cut-off")) return "Cutoff";

  // Fall back to the parent update's category…
  const cat = (parentCategory || "").toLowerCase().replace(/_/g, " ");
  if (cat.includes("admit")) return "Admit Card Link";
  if (cat.includes("result")) return "Result Link";
  if (cat.includes("answer")) return "Answer Key Link";
  if (cat.includes("syllabus")) return "Syllabus Link";

  // …and finally the site itself, which at least names the destination.
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host) return host;
  } catch {
    /* not an absolute URL — fall through */
  }
  return "Official Link";
}

/** The label to render for a scraped link: its own text when it says something. */
export function linkLabel(
  text: string | null | undefined,
  url: string,
  parentCategory?: string | null,
): string {
  return isGenericLinkText(text) ? inferLabelFromUrl(url, parentCategory) : (text as string).trim();
}
