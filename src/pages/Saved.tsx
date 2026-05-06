
import { JobCard } from "@/components/JobCard";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function Saved() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
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
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 sm:py-4 md:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
          </button>
          <h1 className="font-display font-bold text-lg sm:text-xl text-foreground">Saved Jobs</h1>
        </div>
      </header>

      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.45)_48%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Bookmark className="h-3.5 w-3.5" />
                Personal Shortlist
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Saved Jobs</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Keep your shortlisted government jobs in one focused desktop workspace and return to them whenever you are ready to apply.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur-sm min-w-[220px]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Saved Count</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{savedJobs?.length || 0}</p>
              <p className="mt-1 text-sm text-muted-foreground">jobs bookmarked for later</p>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-4 md:mx-auto md:max-w-6xl md:px-6 lg:px-8">
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
            {savedJobs.map((saved) => 
              saved.jobs && <JobCard key={saved.job_id} job={saved.jobs} />
            )}
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
    </div>
  );
}
