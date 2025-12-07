import { BottomNav } from "@/components/BottomNav";
import { JobCard } from "@/components/JobCard";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { Job } from "@/types/job";

export default function Saved() {
  const navigate = useNavigate();
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
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
          </button>
          <h1 className="font-display font-bold text-lg sm:text-xl text-foreground">Saved Jobs</h1>
        </div>
      </header>

      <main className="px-4 py-4">
        {!user ? (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Bookmark className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
              No saved jobs yet
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
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
            <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Bookmark className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
              No saved jobs yet
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
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
