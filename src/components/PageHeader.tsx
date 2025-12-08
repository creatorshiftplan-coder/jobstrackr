import { Menu, Search, Bookmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface PageHeaderProps {
  showSearchBar?: boolean;
  variant?: "dark" | "transparent";
}

export function PageHeader({ showSearchBar = true, variant = "transparent" }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-3 px-4 sm:px-5 pt-10 sm:pt-12 pb-3 sm:pb-4">
      {/* More Button - Left */}
      <Link to="/more">
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-card/80 backdrop-blur-xl border border-border/30 flex items-center justify-center hover:bg-card hover:shadow-soft transition-all duration-200 group">
          <Menu className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-foreground/70 group-hover:text-foreground transition-colors" />
        </div>
      </Link>
      
      {/* Search Bar - Center */}
      {showSearchBar && (
        <div 
          onClick={() => navigate("/search")}
          className="flex-1 flex items-center gap-3 bg-card/80 backdrop-blur-xl border border-border/30 rounded-xl shadow-soft h-10 sm:h-11 px-4 cursor-pointer hover:bg-card hover:shadow-soft-lg transition-all duration-200 group"
        >
          <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-muted-foreground text-sm truncate">Search a job...</span>
        </div>
      )}
      
      {/* Saved Button - Right */}
      <Link to="/saved">
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-card/80 backdrop-blur-xl border border-border/30 flex items-center justify-center hover:bg-card hover:shadow-soft transition-all duration-200 group">
          <Bookmark className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-foreground/70 group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </header>
  );
}
