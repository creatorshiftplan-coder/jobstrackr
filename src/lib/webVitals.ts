/**
 * Lightweight Core Web Vitals reporting using native PerformanceObserver —
 * no extra dependency. Tracks FCP, LCP, INP (TTI proxy), CLS, and TTFB.
 *
 * Logged to the console in dev. In production, metrics are exposed on
 * `window.__webVitals` and can be forwarded to any analytics endpoint
 * from the `report` callback below.
 */

type MetricName = "FCP" | "LCP" | "INP" | "CLS" | "TTFB";

interface Metric {
  name: MetricName;
  value: number; // ms (CLS is unitless)
}

declare global {
  interface Window {
    __webVitals?: Partial<Record<MetricName, number>>;
  }
}

function report(metric: Metric) {
  if (typeof window === "undefined") return;
  window.__webVitals = { ...window.__webVitals, [metric.name]: metric.value };
  if (import.meta.env.DEV) {
    console.info(
      `[web-vitals] ${metric.name}: ${metric.name === "CLS" ? metric.value.toFixed(4) : Math.round(metric.value) + "ms"}`
    );
  }
  // To ship to analytics, send here (e.g. navigator.sendBeacon("/api/vitals", ...))
}

function observe(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
  opts: PerformanceObserverInit = {}
): PerformanceObserver | null {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return null;
    const po = new PerformanceObserver((list) => callback(list.getEntries()));
    po.observe({ type, buffered: true, ...opts } as PerformanceObserverInit);
    return po;
  } catch {
    return null;
  }
}

export function initWebVitals() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  // TTFB
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) report({ name: "TTFB", value: nav.responseStart });
  } catch { /* noop */ }

  // FCP
  observe("paint", (entries) => {
    const fcp = entries.find((e) => e.name === "first-contentful-paint");
    if (fcp) report({ name: "FCP", value: fcp.startTime });
  });

  // LCP — final value is the last candidate before first interaction / hide
  let lcpValue = 0;
  const lcpObserver = observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcpValue = last.startTime;
  });

  // CLS
  let clsValue = 0;
  observe("layout-shift", (entries) => {
    for (const entry of entries as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
  });

  // INP (interaction responsiveness — modern stand-in for TTI health)
  let inpValue = 0;
  observe(
    "event",
    (entries) => {
      for (const entry of entries as Array<PerformanceEntry & { interactionId?: number }>) {
        if (entry.interactionId && entry.duration > inpValue) inpValue = entry.duration;
      }
    },
    { durationThreshold: 40 } as PerformanceObserverInit
  );

  const flush = () => {
    if (lcpValue) report({ name: "LCP", value: lcpValue });
    if (inpValue) report({ name: "INP", value: inpValue });
    report({ name: "CLS", value: clsValue });
  };

  // LCP finalizes on first interaction or page hide
  ["keydown", "click"].forEach((t) =>
    window.addEventListener(t, () => lcpObserver?.takeRecords(), { once: true, capture: true })
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
