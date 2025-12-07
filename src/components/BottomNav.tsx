import { Home, Search, Briefcase, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Explore", path: "/search" },
  { icon: Briefcase, label: "Exams", path: "/tracker" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-white/50 shadow-lg z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg transition-colors min-w-0 flex-shrink-0",
                isActive ? "text-[#0A4174]" : "text-[#0A4174]/50 hover:text-[#0A4174]/80"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-[#0A4174]/20")} />
              <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
