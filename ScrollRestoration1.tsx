import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "app_scroll_positions";
const MAX_RESTORE_ATTEMPTS = 25;
const RESTORE_RETRY_DELAY_MS = 120;

type ScrollPositions = Record<string, number>;

// ─── The scroll container is <main id="main-scroll" overflow-y-auto> ──────────
// window.scrollY is always 0 in this app. All reads/writes target the container.
function getContainer(): HTMLElement | null {
  return document.getElementById("main-scroll");
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
  } catch {}
}

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
// Without this, scrolling the container to 0 (on PUSH nav) fires the previous
// page's scroll listener and overwrites its saved position with 0.
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
    const container = getContainer();
    if (!container) return;

    const sk = scrollKey(location.key, location.pathname, location.search);
    const pk = pathKey(location.pathname, location.search);

    // Capture position for this route.
    const save = () => {
      // Skip saves triggered by our own programmatic scrollTo calls.
      if (suppressNextScrollSave) {
        suppressNextScrollSave = false;
        return;
      }
      const positions = readPositions();
      const y = container.scrollTop;   // ← container, never window.scrollY
      positions[sk] = y;
      positions[pk] = y;
      writePositions(positions);
    };

    // Keep a ref so Effect 3 can trigger a save before scrolling to 0.
    saveFnRef.current = save;

    // On POP: don't eagerly save 0 before the restore fires.
    if (navType !== "POP") save();

    container.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);

    return () => {
      // Save current position before leaving this route.
      save();
      container.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [location.key, location.pathname, location.search, navType]);

  // ─── Effect 3: Restore or reset scroll position ─────────────────────────────
  useEffect(() => {
    const container = getContainer();
    if (!container) return;

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
      container.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }

    // POP — restore saved position.
    const targetY = restoreTargetRef.current;
    if (typeof targetY !== "number" || targetY < 1) return;

    let attempts  = 0;
    let cancelled = false;

    const restore = () => {
      if (cancelled) return;

      // Wait until the container has enough content to scroll to targetY.
      const maxScroll = container.scrollHeight - container.clientHeight;
      const canReach  = maxScroll >= targetY || attempts >= MAX_RESTORE_ATTEMPTS;

      // Set the flag so the scroll event fired by this scrollTo is ignored.
      suppressNextScrollSave = true;
      container.scrollTo({
        top:      Math.min(targetY, Math.max(0, maxScroll)),
        left:     0,
        behavior: "instant",
      });

      if (canReach) return;

      attempts++;
      window.setTimeout(restore, RESTORE_RETRY_DELAY_MS);
    };

    const frame = requestAnimationFrame(restore);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [location.hash, location.key, location.pathname, location.search, navType]);

  return null;
}
