import type { CSSProperties } from "react";
import { Home, Search, CalendarDays, GraduationCap, Flame } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Explore", path: "/search" },
  { icon: Flame, label: "Trending", path: "/trending" },
  { icon: GraduationCap, label: "My Exams", path: "/tracker" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
];

// Profile moved to the top-right of page headers, but the nav stays visible there
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
  const hasActiveTab = activeIndex >= 0;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 md:hidden"
      aria-label="Primary navigation"
    >
      <div
        className="bottom-nav-shell pointer-events-auto relative"
        style={
          {
            "--active-index": hasActiveTab ? activeIndex : 0,
            "--active-center": `${(((hasActiveTab ? activeIndex : 0) + 0.5) / navItems.length) * 100}%`,
            "--nav-count": navItems.length,
          } as CSSProperties
        }
      >
        <ul className="bottom-nav-list relative z-[1] grid h-full list-none items-end">
          {navItems.map(({ icon: Icon, label, path }, index) => {
            const isActive = activeIndex === index;
            return (
              <li
                key={path}
                className="relative z-[2] flex h-full list-none items-end justify-center"
              >
                <Link
                  to={path}
                  className={cn(
                    "bottom-nav-link flex flex-col items-center justify-end text-muted-foreground no-underline",
                    isActive && "bottom-nav-item-active"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="bottom-nav-icon flex items-center justify-center rounded-full">
                    <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.5 : 2.1} />
                  </span>
                  <span className="bottom-nav-label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="bottom-nav-back" aria-hidden="true" />
      </div>
    </nav>
  );
}
