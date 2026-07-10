import { Home, Search, CalendarDays, GraduationCap, Flame } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/", color: "#f43f5e" },
  { icon: Search, label: "Explore", path: "/search", color: "#f59e0b" },
  { icon: Flame, label: "Trending", path: "/trending", color: "#10b981" },
  { icon: GraduationCap, label: "My Exams", path: "/tracker", color: "#3b82f6" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar", color: "#8b5cf6" },
];

const visiblePaths = new Set([...navItems.map((item) => item.path), "/profile"]);

export function BottomNav() {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/$/, "") || "/";

  if (!visiblePaths.has(normalizedPath)) {
    return null;
  }

  const activeIndex = navItems.findIndex(
    (item) => item.path === normalizedPath
  );

  const hasActive = activeIndex >= 0;
  const slideIndex = hasActive ? activeIndex : 0;
  const accent = navItems[slideIndex].color;
  const n = navItems.length;

  return (
    <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 md:hidden w-[calc(100%-24px)] max-w-[400px] h-[54px] bg-card rounded-full border border-border shadow-[0_10px_30px_rgba(0,0,0,0.20)] ring-1 ring-black/5 flex items-center">
      {/* Sliding Pill Background Indicator — positioned by % so it scales with screen width */}
      <div
        className="absolute top-1/2 h-[46px] rounded-full pointer-events-none z-0 -translate-y-1/2"
        style={{
          width: `calc(100% / ${n} - 6px)`,
          left: `calc(${slideIndex} * (100% / ${n}) + 3px)`,
          backgroundColor: hasActive ? `${accent}24` : "transparent",
          border: hasActive ? `1px solid ${accent}40` : "1px solid transparent",
          opacity: hasActive ? 1 : 0,
          transition:
            "left 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease, background-color 380ms ease, border-color 380ms ease",
        }}
      />

      {/* Navigation Links */}
      <ul className="flex w-full h-full items-center relative z-10 p-0 m-0">
        {navItems.map(({ icon: Icon, label, path, color }, index) => {
          const isActive = activeIndex === index;
          return (
            <li
              key={path}
              className="relative flex-1 h-full flex items-center justify-center list-none"
            >
              <Link
                to={path}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="flex items-center justify-center w-full h-full text-muted-foreground no-underline"
              >
                <span
                  className="relative flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-out cursor-pointer"
                  style={{
                    opacity: isActive ? 1 : 0.85,
                  }}
                >
                  <Icon
                    className="transition-colors duration-300"
                    style={{
                      width: 24,
                      height: 24,
                      color: isActive ? color : "currentColor",
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className="text-[10px] leading-none whitespace-nowrap transition-colors duration-300"
                    style={{
                      color: isActive ? color : "currentColor",
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

