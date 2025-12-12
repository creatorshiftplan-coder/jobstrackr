import { Search, Bookmark } from "lucide-react";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { Link, useNavigate } from "react-router-dom";

interface PageHeaderProps {
  showSearchBar?: boolean;
  variant?: "dark" | "transparent";
}

export function PageHeader({ showSearchBar = true, variant = "transparent" }: PageHeaderProps) {
  const navigate = useNavigate();

  // Use theme-aware semantic tokens
  const iconColor = "text-primary";
  const bgClass = "bg-secondary";
  const hoverClass = "hover:bg-secondary/80";
  const searchBgClass = "bg-card/60 border-border";
  const searchTextColor = "text-muted-foreground";
  const placeholderColor = "text-muted-foreground";

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 pt-10 sm:pt-12 pb-3 sm:pb-4">
      {/* More Button - Left */}
      <Link to="/more">
        <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full ${bgClass} backdrop-blur-sm flex items-center justify-center ${hoverClass} transition-colors`}>
          <MenuBarsIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor}`} />
        </div>
      </Link>

      {/* Search Bar - Center */}
      {showSearchBar && (
        <div
          onClick={() => navigate("/search")}
          className={`flex-1 flex items-center gap-2 sm:gap-3 ${searchBgClass} backdrop-blur-xl border rounded-xl sm:rounded-2xl shadow-lg h-11 sm:h-12 px-3 sm:px-4 cursor-pointer`}
        >
          <Search className={`h-4 w-4 sm:h-5 sm:w-5 ${searchTextColor}`} />
          <span className={`${placeholderColor} text-sm sm:text-base truncate`}>Search a job...</span>
        </div>
      )}

      {/* Saved Button - Right */}
      <Link to="/saved">
        <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full ${bgClass} backdrop-blur-sm flex items-center justify-center ${hoverClass} transition-colors`}>
          <Bookmark className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor}`} />
        </div>
      </Link>
    </header>
  );
}
