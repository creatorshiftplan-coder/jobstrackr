import { Home, Search, Briefcase, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Explore", path: "/search" },
  { icon: Briefcase, label: "My Exams", path: "/tracker" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-2xl border-t border-border/30 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] z-50">
      <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto px-4">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 min-w-0 flex-shrink-0 relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-2xl animate-scale-in" />
              )}
              <Icon className={cn(
                "h-5 w-5 transition-all duration-300 relative z-10", 
                isActive && "stroke-[2.5px]"
              )} />
              <span className={cn(
                "text-[10px] whitespace-nowrap tracking-wide relative z-10", 
                isActive ? "font-semibold" : "font-medium"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for bottom inset */}
      <div className="h-safe-bottom bg-card/95" />
    </nav>
  );
}
