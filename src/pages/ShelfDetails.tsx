import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { MatchBadge } from "@/components/MatchBadge";
import { GapChip } from "@/components/GapChip";
import { BottomNav } from "@/components/BottomNav";
import { useSmartBack } from "@/hooks/useSmartBack";
import { Job } from "@/types/job";
import { SkillGap } from "@/hooks/useAlmostEligible";

interface CustomJob extends Job {
  matchScore?: number;
  gapSkills?: SkillGap[];
  experienceNote?: string | null;
}

export default function ShelfDetails() {
  const { shelfKey } = useParams<{ shelfKey: string }>();
  const handleBack = useSmartBack("/for-you");
  const { shelves, isLoading } = useFeed();

  const shelf = shelves.find((s) => s.key === shelfKey);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="h-6 w-32 bg-secondary rounded animate-pulse" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!shelf) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between pb-20">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <h1 className="font-display font-bold text-lg text-foreground">Not Found</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground mb-4">The requested list could not be found or contains no jobs.</p>
          <Link to="/for-you">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium">
              Back to Recommendations
            </button>
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="font-display font-bold text-lg text-foreground tracking-tight">
            {shelf.title}
          </h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-3xl mx-auto flex flex-col gap-4 animate-fadeIn">
        {shelf.jobs.map((job) => {
          const customJob = job as CustomJob;
          const matchScore = customJob.matchScore;
          const gapSkills = customJob.gapSkills;

          return (
            <div key={job.id} className="w-full">
              <RecommendedJobCard
                job={job}
                experienceNote={customJob.experienceNote}
                matchBadge={shelf.showMatchScore && typeof matchScore === "number" ? <MatchBadge score={matchScore} /> : undefined}
                gapChips={shelf.showGapChips && gapSkills && gapSkills.length > 0 ? (
                  gapSkills.map((skill, idx) => (
                    <GapChip key={idx} skill={skill} />
                  ))
                ) : undefined}
              />
            </div>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
}
