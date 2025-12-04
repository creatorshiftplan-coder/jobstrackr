import { BottomNav } from "@/components/BottomNav";
import { JobCard } from "@/components/JobCard";
import { Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { Job } from "@/types/job";

export default function Saved() {
  const { user, loading: authLoading } = useAuth();
  const { data: savedJobs, isLoading } = useSavedJobs();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="font-display font-bold text-xl text-foreground">Saved Jobs</h1>
      </header>

      <main className="px-4 py-4">
        {!user ? (
          <div className="text-center py-12">
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
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : savedJobs && savedJobs.length > 0 ? (
          <div className="space-y-4">
            {savedJobs.map((saved) => (
              <JobCard key={saved.job_id} job={saved.jobs as unknown as Job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Bookmark className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-2">
              No saved jobs yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Browse jobs and tap the bookmark icon to save them
            </p>
            <Link to="/">
              <Button>Browse Jobs</Button>
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
