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

// 5 tabs across the floating bar: 5 x 58px = 290px content width.
const TAB_WIDTH = 58;
const NAV_WIDTH = navItems.length * TAB_WIDTH;

const visiblePaths = new Set(navItems.map((item) => item.path));

export function BottomNav() {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/$/, "") || "/";

  if (!visiblePaths.has(normalizedPath)) {
    return null;
  }

  const activeIndex = navItems.findIndex(
    (item) => item.path === normalizedPath
  );

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:hidden">
      <div className="glow-nav relative flex h-[60px] items-center justify-center rounded-2xl bg-card px-2 shadow-lg">
        <ul className="relative flex" style={{ width: NAV_WIDTH }}>
          {navItems.map(({ icon: Icon, path }, index) => {
            const isActive = activeIndex === index;
            return (
              <li
                key={path}
                className="relative z-[2] h-[60px] w-[58px] list-none"
              >
                <Link
                  to={path}
                  className="flex h-full w-full items-center justify-center text-muted-foreground no-underline"
                >
                  <span
                    className={cn(
                      "relative flex h-[50px] w-[50px] items-center justify-center rounded-full bg-card transition-all duration-500",
                      isActive && "-translate-y-[27px]"
                    )}
                    style={
                      isActive
                        ? { background: "hsl(var(--primary))", transitionDelay: "0.25s" }
                        : { transitionDelay: "0s" }
                    }
                  >
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px] transition-colors duration-300",
                        isActive ? "text-primary-foreground" : "text-muted-foreground"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isActive && (
                      <span
                        className="absolute left-0 top-[8px] h-full w-full rounded-full opacity-50 blur-[5px] transition-opacity duration-500"
                        style={{ background: "hsl(var(--primary))" }}
                      />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          <div
            className="glow-indicator absolute -top-[35px] z-[1] h-[70px] w-[70px] rounded-full bg-card transition-transform duration-500"
            style={{
              transform: `translateX(${activeIndex >= 0 ? activeIndex * TAB_WIDTH - 6 : -6}px)`,
            }}
          />
        </ul>
      </div>
    </nav>
  );
}
