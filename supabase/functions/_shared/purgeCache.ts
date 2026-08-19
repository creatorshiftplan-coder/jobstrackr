/**
 * Best-effort Vercel CDN purge by cache tag.
 * ────────────────────────────────────────────────────────────
 * The SSR routes (api/exam-updates/[slug].ts, api/updates/[slug].ts) tag their
 * response with `Vercel-Cache-Tag: <prefix>-<id>` and cache it for hours at the
 * CDN edge (see CDN_TTL comments in those files). Without this, a status flip
 * (e.g. "result expected" -> "result out") would sit stale until that TTL
 * expires. Calling this after the write invalidates just that one page
 * instantly instead of shortening the TTL for every page to compensate.
 *
 * Requires VERCEL_API_TOKEN + VERCEL_PROJECT_ID as Supabase Edge Function
 * secrets (VERCEL_TEAM_ID too, if the project lives under a team). Missing
 * config or a failed call is swallowed, never thrown — same as the Telegram
 * broadcast in sync-sheets, a purge hiccup must not break the write it follows.
 * Until those secrets are set, pages just fall back to their CDN_TTL, exactly
 * as they did before this existed.
 */
export async function purgeCacheTags(tags: string[]): Promise<void> {
  const clean = tags.filter((t) => !!t);
  if (clean.length === 0) return;

  const token = Deno.env.get("VERCEL_API_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");
  if (!token || !projectId) return;

  const teamId = Deno.env.get("VERCEL_TEAM_ID");
  const url = new URL("https://api.vercel.com/v1/edge-cache/invalidate-by-tags");
  url.searchParams.set("projectIdOrName", projectId);
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: clean, target: "production" }),
    });
    if (!res.ok) {
      console.error(`[purgeCache] invalidate-by-tags failed (${res.status}):`, (await res.text()).slice(0, 200));
    }
  } catch (e) {
    console.error("[purgeCache] invalidate-by-tags error:", (e as Error).message);
  }
}
