import { Search, Bookmark, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProfileMenu } from "@/components/ProfileMenu";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden" />

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search a job, exam, or syllabus..."
          className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-1">
        <button className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bookmark className="h-5 w-5" />
        </button>
        <button className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}