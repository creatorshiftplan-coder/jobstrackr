import { Home, Search, CalendarDays, User, Flame } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/", color: "#f44336" },
  { icon: Search, label: "Explore", path: "/search", color: "#ffa117" },
  { icon: Flame, label: "Trending", path: "/trending", color: "#0fc70f" },
  { icon: CalendarDays, label: "My Exams", path: "/tracker", color: "#2196f3" },
  { icon: User, label: "Profile", path: "/profile", color: "#b145e9" },
];

export function BottomNav() {
  const location = useLocation();

  const activeIndex = navItems.findIndex(
    (item) => item.path === location.pathname
  );

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <div className="glow-nav relative flex items-center justify-center h-[60px] bg-card rounded-2xl shadow-lg px-2">
        <ul className="flex w-[350px] relative">
          {navItems.map(({ icon: Icon, label, path, color }, index) => {
            const isActive = activeIndex === index;
            return (
              <li
                key={path}
                className="relative w-[70px] h-[60px] z-[2] list-none"
              >
                <Link
                  to={path}
                  className="flex items-center justify-center w-full h-full text-muted-foreground no-underline"
                >
                  <span
                    className={cn(
                      "relative flex items-center justify-center w-[50px] h-[50px] rounded-full bg-card transition-all duration-500",
                      isActive && "-translate-y-[27px]"
                    )}
                    style={
                      isActive
                        ? { background: color, transitionDelay: "0.25s" }
                        : { transitionDelay: "0s" }
                    }
                  >
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px] transition-colors duration-300",
                        isActive ? "text-white" : "text-muted-foreground"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {/* Glow blur */}
                    {isActive && (
                      <span
                        className="absolute top-[8px] left-0 w-full h-full rounded-full opacity-50 blur-[5px] transition-opacity duration-500"
                        style={{ background: color }}
                      />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          {/* Sliding indicator */}
          <div
            className="glow-indicator absolute -top-[35px] w-[70px] h-[70px] bg-card rounded-full z-[1] transition-transform duration-500"
            style={{
              transform: `translateX(${activeIndex >= 0 ? activeIndex * 70 : 0}px)`,
            }}
          />
        </ul>
      </div>
    </nav>
  );
}