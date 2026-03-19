import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "app_scroll_positions";
const MAX_RESTORE_ATTEMPTS = 25;
const RESTORE_RETRY_DELAY_MS = 120;

type ScrollPositions = Record<string, number>;

function readStoredPositions(): ScrollPositions {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as ScrollPositions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredPositions(positions: ScrollPositions) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage write failures. Scroll restoration can still work in-memory per session lifecycle.
  }
}

function getScrollKey(locationKey: string, pathname: string, search: string) {
  return locationKey !== "default" ? locationKey : `${pathname}${search}`;
}

function getPathScrollKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const restoreTargetRef = useRef<number | null>(null);
  const previousScrollKeyRef = useRef<string>("");

  // Capture target scroll position before effects run, so POP restores do not get overwritten by a mount-time save.
  const currentScrollKey = getScrollKey(location.key, location.pathname, location.search);
  const currentPathScrollKey = getPathScrollKey(location.pathname, location.search);
  if (previousScrollKeyRef.current !== currentScrollKey) {
    previousScrollKeyRef.current = currentScrollKey;
    if (navigationType === "POP") {
      const positions = readStoredPositions();
      restoreTargetRef.current = positions[currentScrollKey] ?? positions[currentPathScrollKey] ?? null;
    } else {
      restoreTargetRef.current = null;
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;

    const previousSetting = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousSetting;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollKey = getScrollKey(location.key, location.pathname, location.search);
    const pathScrollKey = getPathScrollKey(location.pathname, location.search);

    const saveScrollPosition = () => {
      const positions = readStoredPositions();
      positions[scrollKey] = window.scrollY;
      positions[pathScrollKey] = window.scrollY;
      writeStoredPositions(positions);
    };

    // Avoid eagerly writing 0 on POP navigations before restoration runs.
    if (navigationType !== "POP") {
      saveScrollPosition();
    }
    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    window.addEventListener("pagehide", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("scroll", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [location.key, location.pathname, location.search, navigationType]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (location.hash) {
      const id = location.hash.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (el) {
        el.scrollIntoView();
        return;
      }
    }

    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    const targetY = restoreTargetRef.current;

    if (typeof targetY !== "number" || targetY < 1) return;

    let attempts = 0;
    let cancelled = false;

    const restoreScroll = () => {
      if (cancelled) return;

      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const canFullyRestore = maxScrollY >= targetY || attempts >= MAX_RESTORE_ATTEMPTS;

      window.scrollTo({ top: Math.min(targetY, maxScrollY), left: 0, behavior: "auto" });

      if (canFullyRestore) return;

      attempts += 1;
      window.setTimeout(restoreScroll, RESTORE_RETRY_DELAY_MS);
    };

    const frame = window.requestAnimationFrame(restoreScroll);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [location.hash, location.key, location.pathname, location.search, navigationType]);

  return null;
}
