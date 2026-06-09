import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "app_scroll_positions";
// Upper bound on how long we keep trying to reach the saved position while
// async content (paginated lists, feed shelves, network-loaded data) renders.
// Generous to handle cold caches on Search / Jobs For You.
const MAX_RESTORE_TIME_MS = 8000;
// How close (px) the scroll offset must be to the target before we consider it
// "restored" and stop reacting to growth.
const RESTORE_TOLERANCE_PX = 2;

type ScrollPositions = Record<string, number>;

// ─── The real scroll container is the document (window), NOT #main-scroll ──────
// Every layout wrapper (html/body/#root, the sidebar wrapper `min-h-svh`, and
// the app shell `min-h-screen`) is sized with min-height only — nothing
// establishes a definite height — so `main#main-scroll`'s `overflow-y-auto`
// never engages and its scrollTop stays 0. The window/documentElement is what
// actually scrolls (this also matches Search.tsx's own search-bar logic, which
// reads window.scrollY). All reads/writes below target the window.
function getScrollY(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function getScrollHeight(): number {
  return document.documentElement.scrollHeight;
}

function getMaxScroll(): number {
  return Math.max(0, getScrollHeight() - window.innerHeight);
}

function scrollToY(y: number) {
  // `behavior: "instant"` overrides the CSS `scroll-behavior: smooth` set on
  // <html>, so restoration jumps immediately instead of animating.
  window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
}

function readPositions(): ScrollPositions {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScrollPositions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePositions(positions: ScrollPositions) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage write failures
  }
}

// primary key
function scrollKey(locKey: string, pathname: string, search: string) {
  // location.key is unique per history entry — use it as primary key.
  // Fall back to pathname+search for entries created before key tracking.
  return locKey !== "default" ? locKey : `${pathname}${search}`;
}

function pathKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

// ─── Module-level flag ────────────────────────────────────────────────────────
// Suppresses save events triggered by our own programmatic scrollTo calls.
// Without this, scrolling to 0 (on PUSH nav) fires the previous page's scroll
// listener and overwrites its saved position with 0.
let suppressNextScrollSave = false;

export function ScrollRestoration() {
  const location   = useLocation();
  const navType    = useNavigationType();

  // Refs that survive re-renders without triggering effects.
  const restoreTargetRef    = useRef<number | null>(null);
  const prevScrollKeyRef    = useRef<string>("");
  // Keeps the save function stable so we can add/remove the exact same reference.
  const saveFnRef           = useRef<() => void>(() => {});

  // ─── Read restore target synchronously in render phase ──────────────────────
  // Must happen before Effect 2 runs its mount-time save(), so POP restores
  // are not overwritten by an eager save(0) on the newly mounted route.
  const curScrollKey = scrollKey(location.key, location.pathname, location.search);
  const curPathKey   = pathKey(location.pathname, location.search);

  if (prevScrollKeyRef.current !== curScrollKey) {
    prevScrollKeyRef.current = curScrollKey;
    if (navType === "POP") {
      const positions = readPositions();
      restoreTargetRef.current =
        positions[curScrollKey] ??
        positions[curPathKey]   ??
        null;
    } else {
      restoreTargetRef.current = null;
    }
  }

  // ─── Effect 1: Disable browser native scroll restoration (once) ─────────────
  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // ─── Effect 2: Attach scroll listener and save on cleanup ───────────────────
  useEffect(() => {
    const sk = scrollKey(location.key, location.pathname, location.search);
    const pk = pathKey(location.pathname, location.search);

    // ── Anti-clamp tracking ──────────────────────────────────────────────────
    // When React swaps in the next route's component, the document height
    // changes. If the new route is shorter than the previous one (Search →
    // JobDetails is a typical case), the browser auto-clamps the scroll offset
    // down to the new max and fires a scroll event. Without protection, that
    // event — and our own cleanup-time save() — would write the clamped value
    // over the position the user was actually at.
    //
    // Defence: track the largest scrollHeight we've seen, and ignore any save
    // whose current scrollHeight is meaningfully smaller. That kills the
    // auto-clamp write while still allowing real user scrolls (which keep the
    // page tall) to land.
    let lastSeenScrollHeight = getScrollHeight();

    const save = () => {
      // Skip saves triggered by our own programmatic scrollTo calls.
      if (suppressNextScrollSave) {
        suppressNextScrollSave = false;
        return;
      }
      const sh = getScrollHeight();
      if (lastSeenScrollHeight - sh > 100) {
        // Content shrunk substantially — almost certainly the next route's
        // (shorter) component was just committed and the browser auto-clamped
        // the scroll offset. Don't overwrite the position we already saved
        // while the page was still its full size. We deliberately leave
        // lastSeenScrollHeight at the higher value so the cleanup-time save()
        // that runs immediately after also gets skipped for the same reason.
        return;
      }
      if (sh > lastSeenScrollHeight) lastSeenScrollHeight = sh;
      const positions = readPositions();
      const y = getScrollY();
      positions[sk] = y;
      positions[pk] = y;
      writePositions(positions);
    };

    // Keep a ref so Effect 3 can trigger a save before scrolling to 0.
    saveFnRef.current = save;

    // On POP: don't eagerly save 0 before the restore fires.
    if (navType !== "POP") save();

    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);

    return () => {
      // Save current position before leaving this route. The shrink check
      // inside save() prevents this from writing a clamped offset when the
      // next route's content is shorter than ours.
      save();
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [location.key, location.pathname, location.search, navType]);

  // ─── Effect 3: Restore or reset scroll position ─────────────────────────────
  useEffect(() => {
    // Hash navigation — scroll element into view.
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }

    if (navType !== "POP") {
      // PUSH / REPLACE — reset to top.
      // Save current position FIRST before scrolling away, so the upcoming
      // scroll event (fired by scrollTo) doesn't clobber the previous route's
      // saved position via the still-attached listener.
      saveFnRef.current();
      suppressNextScrollSave = true;
      scrollToY(0);
      return;
    }

    // POP — restore saved position.
    const targetY = restoreTargetRef.current;
    if (typeof targetY !== "number" || targetY < 1) return;

    // ── Strategy ─────────────────────────────────────────────────────────────
    // Pages like Search (paginated list with a background loader) and
    // Recommendations / Jobs For You (loading spinner → shelves once auth +
    // profile + jobs + feed all resolve) grow the document height over time.
    // We must keep trying until the page is tall enough to seat targetY, or
    // until the user starts scrolling, or until our budget expires.
    //
    // We drive the retry off three signals so we react the moment content
    // appears rather than polling at a fixed cadence:
    //   1. ResizeObserver on document.body (its box grows as items render).
    //   2. MutationObserver on document.body subtree (catches new nodes even
    //      when their size hasn't settled yet).
    //   3. A 100ms tick as a safety net for cases where neither observer fires.
    let cancelled    = false;
    let aborted      = false;
    let lastProgrammaticScrollAt = 0;
    const startTime  = performance.now();

    const tryScroll = () => {
      const maxScroll = getMaxScroll();
      const target    = Math.min(targetY, maxScroll);
      if (Math.abs(getScrollY() - target) > 0.5) {
        suppressNextScrollSave = true;
        lastProgrammaticScrollAt = performance.now();
        scrollToY(target);
      }
      return maxScroll >= targetY - RESTORE_TOLERANCE_PX;
    };

    // If the user touches the wheel / starts a swipe mid-restoration, give up
    // immediately so we don't fight them. We can't rely on suppressNextScrollSave
    // here — the save() listener in Effect 2 consumes that flag on the same
    // event. Use a short timestamp window instead to recognise our own scrolls.
    const onUserScroll = () => {
      if (performance.now() - lastProgrammaticScrollAt < 150) return;
      aborted = true;
      stop();
    };

    let stop: () => void = () => {};

    let tickId: number | undefined;
    const scheduleTick = () => {
      tickId = window.setTimeout(() => {
        if (cancelled || aborted) return;
        if (tryScroll()) { stop(); return; }
        if (performance.now() - startTime >= MAX_RESTORE_TIME_MS) { stop(); return; }
        scheduleTick();
      }, 100);
    };

    const onGrowth = () => {
      if (cancelled || aborted) return;
      if (tryScroll()) stop();
      else if (performance.now() - startTime >= MAX_RESTORE_TIME_MS) stop();
    };

    const ro = "ResizeObserver" in window ? new ResizeObserver(onGrowth) : null;
    const mo = "MutationObserver" in window ? new MutationObserver(onGrowth) : null;

    stop = () => {
      if (tickId !== undefined) window.clearTimeout(tickId);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("scroll", onUserScroll);
    };

    // Initial attempt — if content is already tall enough (cached data, fast
    // network, route just toggled visibility), we're done in one frame.
    const frame = requestAnimationFrame(() => {
      if (cancelled || aborted) return;
      if (tryScroll()) { stop(); return; }

      // Otherwise wire up the observers and the safety tick.
      ro?.observe(document.body);
      mo?.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("scroll", onUserScroll, { passive: true });
      scheduleTick();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stop();
    };
  }, [location.hash, location.key, location.pathname, location.search, navType]);

  return null;
}
