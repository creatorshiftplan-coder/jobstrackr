import { BottomNav } from "@/components/BottomNav";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Saved() {
  // TODO: Implement saved jobs with authentication
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="font-display font-bold text-xl text-foreground">Saved Jobs</h1>
      </header>

      <main className="px-4 py-12">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Bookmark className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">
            No saved jobs yet
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Login to save jobs and access them anytime
          </p>
          <Link to="/auth">
            <Button>Login to Save Jobs</Button>
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
