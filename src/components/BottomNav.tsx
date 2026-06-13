import { Home, Search, CalendarDays, GraduationCap, Flame } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/", color: "#f44336" },
  { icon: Search, label: "Explore", path: "/search", color: "#ffa117" },
  { icon: Flame, label: "Trending", path: "/trending", color: "#0fc70f" },
  { icon: GraduationCap, label: "My Exams", path: "/tracker", color: "#2196f3" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar", color: "#00bcd4" },
];

// Tabs must fit a 360px-wide viewport
const TAB_WIDTH = 58;
const NAV_WIDTH = navItems.length * TAB_WIDTH;

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

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden w-[290px] h-[55px] bg-transparent">
      {/* Backdrop bar */}
      <div className="absolute left-0 right-0 bottom-0 h-[45px] bg-card rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/30 z-0">
        {/* Notch cutout */}
        <div
          className="absolute -top-[20px] w-[56px] h-[56px] bg-background rounded-full transition-transform duration-300 ease-out z-0"
          style={{
            transform: `translateX(${activeIndex >= 0 ? activeIndex * 58 + 1 : 1}px)`,
          }}
        />
      </div>

      {/* Navigation Links */}
      <ul className="flex w-[290px] relative z-10">
        {navItems.map(({ icon: Icon, path, color }, index) => {
          const isActive = activeIndex === index;
          return (
            <li
              key={path}
              className="relative w-[58px] h-[55px] z-[2] list-none"
            >
              <Link
                to={path}
                className="flex items-center justify-center w-full h-full text-muted-foreground no-underline"
              >
                <span
                  className={cn(
                    "relative flex items-center justify-center w-[42px] h-[42px] rounded-full bg-card transition-all duration-300 ease-out cursor-pointer",
                    isActive
                      ? "-translate-y-[7px] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.2)]"
                      : "translate-y-[5px]"
                  )}
                >
                  <Icon
                    className="h-[22px] w-[22px] transition-colors duration-300"
                    style={{
                      color: isActive ? color : "hsl(var(--muted-foreground))",
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
