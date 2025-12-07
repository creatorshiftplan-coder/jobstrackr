import { Menu, Search, Bookmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface PageHeaderProps {
  showSearchBar?: boolean;
  variant?: "dark" | "transparent";
}

export function PageHeader({ showSearchBar = true, variant = "transparent" }: PageHeaderProps) {
  const navigate = useNavigate();
  
  const bgClass = variant === "dark" 
    ? "bg-[hsl(var(--blue-800))]" 
    : "bg-white/20";

  return (
    <header className="flex items-center gap-3 px-5 pt-12 pb-4">
      {/* More Button - Left */}
      <Link to="/more">
        <div className={`h-10 w-10 rounded-full ${bgClass} backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors`}>
          <Menu className="h-5 w-5 text-white" />
        </div>
      </Link>
      
      {/* Search Bar - Center */}
      {showSearchBar && (
        <div 
          onClick={() => navigate("/search")}
          className="flex-1 flex items-center gap-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-lg h-10 px-4 cursor-pointer"
        >
          <Search className="h-4 w-4 text-white/70" />
          <span className="text-white/60 text-sm truncate">Search a job...</span>
        </div>
      )}
      
      {/* Saved Button - Right */}
      <Link to="/saved">
        <div className={`h-10 w-10 rounded-full ${bgClass} backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors`}>
          <Bookmark className="h-5 w-5 text-white" />
        </div>
      </Link>
    </header>
  );
}
