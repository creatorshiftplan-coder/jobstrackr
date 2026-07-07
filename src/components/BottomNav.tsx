import { Home, Search, CalendarDays, GraduationCap, Flame } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/", color: "#f43f5e" },
  { icon: Search, label: "Explore", path: "/search", color: "#f59e0b" },
  { icon: Flame, label: "Trending", path: "/trending", color: "#10b981" },
  { icon: GraduationCap, label: "My Exams", path: "/tracker", color: "#3b82f6" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar", color: "#8b5cf6" },
];

const TAB_WIDTH = 58;
const PILL_WIDTH = 46;

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

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[302px] h-[58px] bg-card/85 backdrop-blur-lg rounded-full border border-border/40 shadow-[0_12px_32px_rgba(0,0,0,0.08)] flex items-center px-1.5">
      {/* Sliding Pill Background Indicator */}
      <div
        className="absolute top-1/2 left-[12px] h-[38px] rounded-full pointer-events-none z-0"
        style={{
          width: `${PILL_WIDTH}px`,
          transform: `translate3d(${slideIndex * TAB_WIDTH}px, -50%, 0)`,
          backgroundColor: hasActive ? `${navItems[slideIndex].color}15` : "transparent",
          border: hasActive ? `1px solid ${navItems[slideIndex].color}25` : "1px solid transparent",
          opacity: hasActive ? 1 : 0,
          transition: "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease, background-color 380ms ease, border-color 380ms ease",
        }}
      />

      {/* Navigation Links */}
      <ul className="flex w-[290px] h-full items-center relative z-10 p-0 m-0">
        {navItems.map(({ icon: Icon, label, path, color }, index) => {
          const isActive = activeIndex === index;
          return (
            <li
              key={path}
              className="relative w-[58px] h-full flex items-center justify-center list-none"
            >
              <Link
                to={path}
                className="flex items-center justify-center w-full h-full text-muted-foreground/60 no-underline"
              >
                <span
                  className="relative flex flex-col items-center justify-center gap-0.5 transition-all duration-300 ease-out cursor-pointer"
                  style={{
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  <Icon
                    className="h-5 w-5 transition-colors duration-300"
                    style={{
                      color: isActive ? color : "currentColor",
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className="text-[9px] leading-none whitespace-nowrap transition-colors duration-300"
                    style={{
                      color: isActive ? color : "currentColor",
                      fontWeight: isActive ? 500 : 400,
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

