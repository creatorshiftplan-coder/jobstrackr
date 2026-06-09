import { useRef } from "react";
import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { RecommendedJobCard } from "./RecommendedJobCard";
import { MatchBadge } from "./MatchBadge";
import { GapChip } from "./GapChip";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface CustomJob extends Job {
  matchScore?: number;
  gapSkills?: string[];
}

interface FeedShelfProps {
  shelf: {
    key: string;
    title: string;
    jobs: Job[];
    showGapChips?: boolean;
    showMatchScore?: boolean;
  };
}

function getShelfLink(shelfKey: string): string {
  if (shelfKey === "saved") return "/saved";
  if (shelfKey.startsWith("org:")) {
    const org = shelfKey.split(":")[1];
    return `/search?q=${encodeURIComponent(org)}`;
  }
  return `/for-you/shelf/${shelfKey}`;
}

export function FeedShelf({ shelf }: FeedShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const cardWidth = 310; // width (w-72 is 288px) + gap
      scrollRef.current.scrollBy({
        left: direction === "left" ? -cardWidth * 2 : cardWidth * 2,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="mb-10 relative group/shelf">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-4">
        <h2 className="font-display font-bold text-lg sm:text-xl text-foreground tracking-tight">
          {shelf.title}
        </h2>
        {shelf.jobs.length > 3 && (
          <Link
            to={getShelfLink(shelf.key)}
            className="text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            See all
          </Link>
        )}
      </div>

      {/* Navigation Arrows - Desktop Only */}
      <div className="absolute left-2 top-[50%] -translate-y-1/2 z-10 hidden md:group-hover/shelf:block">
        <Button
          variant="outline"
          size="icon"
          onClick={() => scroll("left")}
          className="h-9 w-9 rounded-full bg-background/90 shadow-md border-border/60 hover:bg-background transition-all"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </Button>
      </div>

      <div className="absolute right-2 top-[50%] -translate-y-1/2 z-10 hidden md:group-hover/shelf:block">
        <Button
          variant="outline"
          size="icon"
          onClick={() => scroll("right")}
          className="h-9 w-9 rounded-full bg-background/90 shadow-md border-border/60 hover:bg-background transition-all"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </Button>
      </div>

      {/* Horizontal Scroll Area */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 sm:px-6 pb-4 snap-x snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]"
      >
        {shelf.jobs.map((job) => {
          const customJob = job as CustomJob;
          const matchScore = customJob.matchScore;
          const gapSkills = customJob.gapSkills;

          return (
            <div key={job.id} className="flex-shrink-0 w-[290px] sm:w-[320px] snap-start">
              <RecommendedJobCard
                job={job}
                matchBadge={shelf.showMatchScore && typeof matchScore === "number" ? <MatchBadge score={matchScore} /> : undefined}
                gapChips={shelf.showGapChips && gapSkills && gapSkills.length > 0 ? (
                  gapSkills.map((gap, idx) => (
                    <GapChip key={idx} skill={gap} />
                  ))
                ) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default FeedShelf;
