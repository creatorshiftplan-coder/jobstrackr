import { Search, Bookmark, X } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isSearchPage = location.pathname === "/search";
  const searchQuery = searchParams.get("q") ?? "";

  const initials = user?.email?.slice(0, 2).toUpperCase() || "GU";

  const updateSearchQuery = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value.trim()) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleSearchNavigation = () => {
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };

    const navigateToSearch = () => navigate("/search");

    if (window.matchMedia("(min-width: 768px)").matches && transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(navigateToSearch);
      return;
    }

    navigateToSearch();
  };

  return (
    <header className="hidden md:flex sticky top-0 z-30 h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      <SidebarTrigger />

      {isSearchPage ? (
        <div
          className="relative flex-1 max-w-xl"
          style={{ viewTransitionName: "desktop-search-bar" }}
        >
          <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => updateSearchQuery(event.target.value)}
            placeholder="Job title, department, location..."
            className="h-10 rounded-lg border-input bg-background pl-10 pr-10 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => updateSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={handleSearchNavigation}
          className="relative flex-1 max-w-xl cursor-pointer"
          style={{ viewTransitionName: "desktop-search-bar" }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <div className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm flex items-center text-muted-foreground transition-shadow hover:ring-2 hover:ring-ring/30">
            Search a job, exam, or syllabus...
          </div>
        </div>
      )}

      {/* Right icons */}
      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/saved"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bookmark className="h-5 w-5" />
        </Link>
        <Link
          to="/profile"
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
