import { ReactNode, useEffect, useRef, useState } from "react";

interface LazySectionProps {
  children: ReactNode;
  /** Reserved height before the section renders, to avoid layout shift */
  minHeight?: number;
  /** How early to start rendering before the section scrolls into view */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers rendering of below-the-fold content until it approaches the viewport.
 * Reduces initial render work and TTI without changing visible UI — content
 * mounts ~one screen before the user reaches it.
 */
export function LazySection({
  children,
  minHeight = 320,
  rootMargin = "600px 0px",
  className,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    // Fallback for very old browsers: render immediately
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}

export default LazySection;
