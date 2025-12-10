import { Home, Search, CalendarDays, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Explore", path: "/search" },
  { icon: CalendarDays, label: "My Exams", path: "/tracker" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-2xl border-t border-border/50 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-xl transition-all duration-200 min-w-0 flex-shrink-0",
                isActive
                  ? "text-primary bg-primary/10 scale-105"
                  : "text-muted-foreground hover:text-primary/70 hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("h-6 w-6 transition-all stroke-[2px]", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[11px] whitespace-nowrap tracking-wide font-semibold", isActive && "font-bold")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}