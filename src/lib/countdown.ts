import { useEffect, useState } from "react";

export type Urgency = "critical" | "soon" | "calm";

export function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "soon";
  return "calm";
}

export interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function diffTo(target: Date): TimeParts {
  const ms = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Ticks once per second; pauses when the tab is hidden to save battery. */
export function useLiveCountdown(target: Date): TimeParts {
  const [parts, setParts] = useState<TimeParts>(() => diffTo(target));

  useEffect(() => {
    setParts(diffTo(target));
    let id: number | undefined;
    const start = () => {
      stop();
      id = window.setInterval(() => setParts(diffTo(target)), 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setParts(diffTo(target));
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target]);

  return parts;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Build the in-app URL for the immersive fullscreen countdown. Self-contained:
 * everything the view needs (title, label, date) rides in the query string, so
 * it opens correctly in a brand-new tab with no app state.
 */
export function fullscreenCountdownUrl(item: {
  title: string;
  eventLabel: string;
  examDate: Date;
}): string {
  const params = new URLSearchParams({
    t: item.title,
    e: item.eventLabel,
    d: item.examDate.toISOString(),
  });
  return `/countdown/live?${params.toString()}`;
}
