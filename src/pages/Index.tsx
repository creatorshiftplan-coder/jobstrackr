import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WelcomeHeader } from "@/components/WelcomeHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AISearchResult } from "@/components/AISearchResult";
import { Briefcase, Sparkles, Loader2, SearchX, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/welcome", { replace: true });
    }
  }, [user, authLoading, navigate]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { data: jobs, isLoading, error } = useJobs();
  const { isSearching, aiResults, searchStatus, searchWithAI, getSavedJobId, dismissJob, clearAIResults } =
    useAIJobSearch();

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs;
  }, [jobs]);

  // Show the 5 most recently uploaded jobs (already sorted by created_at DESC from useJobs)
  const newJobs = useMemo(() => {
    return filteredJobs.slice(0, 5);
  }, [filteredJobs]);

  // Show next 4 jobs for recommended section (avoid overlap with newJobs)
  const recommendedJobs = useMemo(() => {
    return filteredJobs.slice(5, 9);
  }, [filteredJobs]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const cardWidth = 300 + 16; // card width + gap
    const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
    setActiveCardIndex(Math.min(index, newJobs.length - 1));
  };

  const showNoResults = !isLoading && filteredJobs.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A4174] via-[#1a5a9e] to-[#deeefe] pb-24">
      <WelcomeHeader />
      
      {/* Clickable Search Bar - navigates to Explore page */}
      <div className="px-5 pb-4" onClick={() => navigate("/search")}>
        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-lg h-12 px-4 cursor-pointer">
          <Search className="h-5 w-5 text-white/70" />
          <span className="text-white/60 text-base">Search a job or position</span>
        </div>
      </div>

      <main>
        {isLoading ? (
          <div className="px-5 space-y-6">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-5">
            <p className="text-destructive">Failed to load jobs</p>
          </div>
        ) : (
          <>
            {/* AI Search Results */}
            {aiResults.length > 0 && (
              <section className="px-5 mb-6 space-y-4">
                <SectionHeader title="AI Found Jobs" />
                {aiResults.map((job, index) => (
                  <AISearchResult
                    key={`${job.exam_name}-${index}`}
                    job={job}
                    onDismiss={() => dismissJob(job)}
                    savedJobId={getSavedJobId(job.exam_name)}
                  />
                ))}
              </section>
            )}

            {/* AI Search "Not Found" Status */}
            {searchStatus === "not_found" && (
              <div className="text-center py-8 px-5">
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <SearchX className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-foreground mb-2">No exams found</h3>
                <p className="text-sm text-muted-foreground">
                  No exams found for this search. Try another category or keyword.
                </p>
              </div>
            )}

            {/* AI Searching State */}
            {isSearching && (
              <div className="text-center py-8 px-5">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Searching with AI...</p>
              </div>
            )}

            {/* No Results */}
            {showNoResults && aiResults.length === 0 && searchStatus !== "not_found" && !isSearching && (
              <div className="text-center py-12 px-5">
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-foreground mb-2">No jobs found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Check back later for new opportunities
                </p>
              </div>
            )}

            {/* New Government Jobs Section - Latest uploaded jobs */}
            {newJobs.length > 0 && !isSearching && searchStatus !== "not_found" && (
              <section className="mb-8">
                <SectionHeader title="New Government Jobs" />
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide"
                >
                  {newJobs.map((job) => (
                    <FeaturedJobCard key={job.id} job={job} />
                  ))}
                </div>
                {/* Pagination dots */}
                <div className="flex justify-center gap-2 mt-4 px-5">
                  {newJobs.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeCardIndex ? "bg-white" : "bg-white/30"
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Jobs Section */}
            {recommendedJobs.length > 0 && !isSearching && searchStatus !== "not_found" && (
              <section>
                <SectionHeader title="Recommended Jobs" />
                <div className="grid grid-cols-2 gap-4 px-5">
                  {recommendedJobs.map((job, index) => (
                    <RecommendedJobCard
                      key={job.id}
                      job={job}
                      colorVariant={colorVariants[index % colorVariants.length]}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Show all jobs if no featured/recommended split */}
            {newJobs.length === 0 &&
              recommendedJobs.length === 0 &&
              filteredJobs.length > 0 &&
              !isSearching &&
              searchStatus !== "not_found" && (
                <section>
                  <SectionHeader title="All Jobs" />
                  <div className="grid grid-cols-2 gap-4 px-5">
                    {filteredJobs.slice(0, 6).map((job, index) => (
                      <RecommendedJobCard
                        key={job.id}
                        job={job}
                        colorVariant={colorVariants[index % colorVariants.length]}
                      />
                    ))}
                  </div>
                </section>
              )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
