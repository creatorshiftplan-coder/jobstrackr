import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { FeedShelf } from "@/components/FeedShelf";
import { ActiveExamCard } from "@/components/ActiveExamCard";
import { BottomNav } from "@/components/BottomNav";
import { SectorPreferenceCard } from "@/components/SectorPreferenceCard";
import { QuickActions } from "@/components/QuickActions";
import { LazySection } from "@/components/LazySection";
import { useHomepageData } from "@/hooks/useHomepageData";
import { useAuth } from "@/hooks/useAuth";
import { useExams } from "@/hooks/useExams";
import { useProfile } from "@/hooks/useProfile";
import { useFeed } from "@/hooks/useFeed";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isJobActive } from "@/lib/jobUtils";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isGuestMode } = useAuth();

  useEffect(() => {
    // Allow access if user is logged in OR is in guest mode
    if (!authLoading && !user && !isGuestMode) {
      navigate("/welcome", { replace: true });
    }
  }, [user, authLoading, isGuestMode, navigate]);

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeExamIndex, setActiveExamIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const examsScrollRef = useRef<HTMLDivElement>(null);
  const [sectorCardSkipped, setSectorCardSkipped] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  const scrollLeft = (ref: React.RefObject<HTMLDivElement>, cardWidth: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement>, cardWidth: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  // ── Core data: single bundled API call ──
  const { data: homepageData, isLoading: homepageLoading, error: homepageError } = useHomepageData();
  const jobs = homepageData?.allJobs;
  const queryClient = useQueryClient();

  // ── Netflix rows feed ──
  // Reuses the bundle's allJobs so the multi-MB jobs list is downloaded once.
  // While the bundle is in flight the feed's own jobs fetch stays disabled;
  // if the bundle errors, the feed falls back to fetching jobs itself.
  const { shelves, isLoading: feedLoading } = useFeed(true, jobs, homepageLoading);

  // Homepage shelves: drop "Almost There - 1 Skill Away" and surface the
  // highest-vacancy jobs followed by the "Expiring Soon" deadline row, then the
  // "Because You Saved" rows. Other shelves fill any remaining slots.
  const homeShelves = useMemo(() => {
    const homeRank = (key: string) => {
      if (key === "eligible_for_you") return 0;
      if (key === "high_vacancies") return 1;
      if (key === "expiring_soon") return 2;
      if (key.startsWith("because_liked")) return 3;
      return 4;
    };
    return shelves
      .filter((shelf) => shelf.key !== "almost_there")
      .sort((a, b) => homeRank(a.key) - homeRank(b.key))
      .slice(0, 4);
  }, [shelves]);

  // Jobs-scoped readiness — sections render independently, no global gate
  const jobsReady = !homepageLoading && !homepageError;

  // Seed the shared ["jobs"] cache from the bundle so other pages
  // (ShelfDetails, Recommendations, Search) don't re-download the jobs list
  useEffect(() => {
    if (homepageData?.allJobs && !queryClient.getQueryData(["jobs"])) {
      queryClient.setQueryData(["jobs"], homepageData.allJobs);
    }
  }, [homepageData, queryClient]);

  // ── Shared user data: fetched once ──
  const { userExams, isLoading: examsLoading } = useExams({ includeExamCatalog: false });
  const { profile, isLoading: profileLoading } = useProfile();

  // Prefetch explore page data when idle (P7: cross-page prefetching)
  useEffect(() => {
    let idleId: number | undefined;
    const prefetchExplore = () => {
      queryClient.prefetchQuery({
        queryKey: ["trending_exams", "All"],
        queryFn: async () => {
          const res = await fetch("/api/cache/trending-exams");
          if (!res.ok) return [];
          return res.json();
        },
        staleTime: 1000 * 60 * 5,
      });
      queryClient.prefetchQuery({
        queryKey: ["all-exam-updates", undefined],
        queryFn: async () => {
          const res = await fetch("/api/cache/exam-updates");
          if (!res.ok) return [];
          return res.json();
        },
        staleTime: 1000 * 60 * 5,
      });
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetchExplore, { timeout: 3000 });
    } else {
      idleId = window.setTimeout(prefetchExplore, 2000) as unknown as number;
    }
    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [queryClient]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs;
  }, [jobs]);

  // Show the 7 most recently uploaded jobs that haven't expired
  const newJobs = useMemo(() => {
    const list = homepageData?.recentJobs || filteredJobs;
    return list
      .filter((job) => isJobActive(job.last_date))
      .slice(0, 7);
  }, [homepageData?.recentJobs, filteredJobs]);

  // Show sector card if user is logged in, hasn't set preferences, hasn't skipped, and hasn't saved this session
  const showSectorCard = user && !profileLoading &&
    (!profile?.preferred_sectors || profile.preferred_sectors.length === 0) &&
    !sectorCardSkipped &&
    !preferencesSaved;

  // Active exams from user's tracked exams (show all)
  const activeExams = useMemo(() => {
    return userExams;
  }, [userExams]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const cardWidth = 300 + 16; // card width + gap
    const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
    setActiveCardIndex(Math.min(index, newJobs.length - 1));
  };

  const showNoResults = jobsReady && filteredJobs.length === 0;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Page shell renders immediately — header, nav, layout never wait on data */}
      <PageHeader variant="dark" />

      <main className="md:mx-auto md:max-w-[960px] md:space-y-8 md:p-6 lg:p-8">
        <>
            {/* Sector Preference Card for first-time users */}
            {showSectorCard && (
              <div className="px-5 mb-6 md:px-0">
                <SectorPreferenceCard
                  onComplete={() => setPreferencesSaved(true)}
                  onSkip={() => setSectorCardSkipped(true)}
                />
              </div>
            )}

            {/* Quick Actions - Desktop only */}
            <section className="hidden md:block animate-fade-in-up">
              <QuickActions />
            </section>

            {/* No Results */}
            {showNoResults && (
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

            {/* New Government Jobs Section - skeleton while its data is in flight */}
            {homepageLoading && (
              <section className="mb-8 md:mb-0">
                <SectionHeader title="New Government Jobs" variant="dark" />
                <div className="flex gap-4 overflow-x-hidden px-5 pb-2 md:px-0">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-48 w-[300px] flex-shrink-0 rounded-3xl" />
                  ))}
                </div>
              </section>
            )}

            {/* Jobs error is scoped to this section — exams and feed still render */}
            {!homepageLoading && homepageError && (
              <div className="text-center py-12 px-5">
                <p className="text-destructive">Failed to load jobs</p>
              </div>
            )}

            {/* New Government Jobs Section - Latest uploaded jobs */}
            {jobsReady && newJobs.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up" style={{ animationDelay: "80ms" }}>
                <SectionHeader title="New Government Jobs" variant="dark" />
                <div className="relative">
                  {/* Left chevron */}
                  <button
                    onClick={() => scrollLeft(scrollContainerRef, 316)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-9 md:w-9 md:-left-4 flex items-center justify-center bg-background/60 md:bg-card backdrop-blur-sm rounded-full shadow-sm md:shadow-md border border-border/30 opacity-60 hover:opacity-100 md:opacity-100 transition-all hover:shadow-lg active:scale-95"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  </button>
                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide md:px-0"
                  >
                    {newJobs.map((job) => (
                      <FeaturedJobCard key={job.id} job={job} />
                    ))}
                  </div>
                  {/* Right chevron */}
                  <button
                    onClick={() => scrollRight(scrollContainerRef, 316)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 md:h-9 md:w-9 md:-right-4 flex items-center justify-center bg-background/60 md:bg-card backdrop-blur-sm rounded-full shadow-sm md:shadow-md border border-border/30 opacity-60 hover:opacity-100 md:opacity-100 transition-all hover:shadow-lg active:scale-95"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  </button>
                </div>
                {/* Pagination dots */}
                <div className="flex justify-center gap-2 mt-4 px-5 md:hidden">
                  {newJobs.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeCardIndex ? "bg-primary" : "bg-primary/30"
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* My Active Exams - independent skeleton while the user's exams load */}
            {user && examsLoading && (
              <section className="mb-8 md:mb-0">
                <SectionHeader title="My Active Exams" variant="dark" />
                <div className="flex gap-3 sm:gap-4 overflow-x-hidden px-5 pb-2 md:grid md:grid-cols-4 md:px-0">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-36 w-[180px] flex-shrink-0 rounded-2xl md:w-auto" />
                  ))}
                </div>
              </section>
            )}

            {/* My Active Exams Section - Only show if user has tracked exams */}
            {!examsLoading && activeExams.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up" style={{ animationDelay: "160ms" }}>
                <SectionHeader title="My Active Exams" variant="dark" />
                <div className="relative">
                  {/* Left chevron */}
                  <button
                    onClick={() => scrollLeft(examsScrollRef, 196)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity md:hidden"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={examsScrollRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:px-0"
                    onScroll={(e) => {
                      const cardWidth = 180 + 16;
                      const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
                      setActiveExamIndex(Math.min(index, activeExams.length - 1));
                    }}
                  >
                    {activeExams.map((attempt) => (
                      <ActiveExamCard key={attempt.id} attempt={attempt} />
                    ))}
                  </div>
                  {/* Right chevron */}
                  <button
                    onClick={() => scrollRight(examsScrollRef, 196)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity md:hidden"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Pagination dots */}
                <div className="flex justify-center gap-2 mt-4 px-5 md:hidden">
                  {activeExams.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeExamIndex ? "bg-primary" : "bg-primary/30"
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Netflix Rows Feed - skeleton shelf while recommendations compute */}
            {feedLoading && (
              <div className="mb-10">
                <div className="px-4 sm:px-6 mb-4">
                  <Skeleton className="h-6 w-44 rounded-md" />
                </div>
                <div className="flex gap-4 overflow-x-hidden px-4 sm:px-6 pb-4">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-44 w-[290px] sm:w-[320px] flex-shrink-0 rounded-2xl" />
                  ))}
                </div>
              </div>
            )}

            {/* First shelf renders eagerly; the rest are below the fold and
                mount lazily as the user scrolls toward them */}
            {!feedLoading && homeShelves.map((shelf, index) =>
              index === 0 ? (
                <FeedShelf key={shelf.key} shelf={shelf} />
              ) : (
                <LazySection key={shelf.key} minHeight={360}>
                  <FeedShelf shelf={shelf} />
                </LazySection>
              )
            )}

            {/* Show all jobs if no featured/feed rows split */}
            {jobsReady && !feedLoading &&
              newJobs.length === 0 &&
              shelves.length === 0 &&
              filteredJobs.length > 0 && (
                <section>
                  <SectionHeader title="All Jobs" variant="dark" />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 px-5 md:grid-cols-3 md:px-0">
                    {filteredJobs.slice(0, 6).map((job) => (
                      <RecommendedJobCard
                        key={job.id}
                        job={job}
                      />
                    ))}
                  </div>
                </section>
              )}
        </>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
