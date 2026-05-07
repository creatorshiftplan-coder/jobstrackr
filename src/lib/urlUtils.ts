/**
 * Check if a URL contains "freejobalert" (case-insensitive).
 * Used to filter out freejobalert links across the entire app.
 */
export function isFreeJobAlertUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes("freejobalert");
}
