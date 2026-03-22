import { Search, Bookmark, Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

export function TopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() || "GU";

  return (
    <header className="hidden md:flex sticky top-0 z-30 h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      <SidebarTrigger />

      {/* Search */}
      <div
        onClick={() => navigate("/search")}
        className="relative flex-1 max-w-xl cursor-pointer"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <div className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm flex items-center text-muted-foreground transition-shadow hover:ring-2 hover:ring-ring/30">
          Search a job, exam, or syllabus...
        </div>
      </div>

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
