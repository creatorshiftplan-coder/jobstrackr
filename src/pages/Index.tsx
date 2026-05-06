import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { RecommendedJobRow } from "@/components/RecommendedJobRow";
import { ActiveExamCard } from "@/components/ActiveExamCard";
import { BottomNav } from "@/components/BottomNav";
import { SectorPreferenceCard } from "@/components/SectorPreferenceCard";
import { QuickActions } from "@/components/QuickActions";
import { useJobs } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useExams } from "@/hooks/useExams";
import { useProfile } from "@/hooks/useProfile";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useSimilarJobs } from "@/hooks/useSimilarJobs";
import { useForYouJobs } from "@/hooks/useForYouJobs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Briefcase, ChevronLeft, ChevronRight, MapPin, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { isJobActive } from "@/lib/jobUtils";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const [personalizedSectionsReady, setPersonalizedSectionsReady] = useState(false);

  useEffect(() => {
    // Allow access if user is logged in OR is in guest mode
    if (!authLoading && !user && !isGuestMode) {
      navigate("/welcome", { replace: true });
    }
  }, [user, authLoading, isGuestMode, navigate]);

  useEffect(() => {
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const enablePersonalizedSections = () => setPersonalizedSectionsReady(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enablePersonalizedSections, { timeout: 400 });
    } else {
      timeoutId = window.setTimeout(enablePersonalizedSections, 250);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeExamIndex, setActiveExamIndex] = useState(0);
  const [activeForYouIndex, setActiveForYouIndex] = useState(0);
  const [activeRecommendedIndex, setActiveRecommendedIndex] = useState(0);
  const [activeSimilarIndex, setActiveSimilarIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const examsScrollRef = useRef<HTMLDivElement>(null);
  const forYouScrollRef = useRef<HTMLDivElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);
  const similarJobsScrollRef = useRef<HTMLDivElement>(null);
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
  const { data: jobs, isLoading, error } = useJobs();
  const { userExams } = useExams();
  const { profile, isLoading: profileLoading } = useProfile();
  const { recommended: hybridRecommended, examMatched, hasTrackedExams } = useRecommendations(10, personalizedSectionsReady);
  const { forYouJobs, hasWizardAnswers } = useForYouJobs(5, personalizedSectionsReady);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs;
  }, [jobs]);

  // Show the 7 most recently uploaded jobs that haven't expired (already sorted by created_at DESC from useJobs)
  const newJobs = useMemo(() => {
    return filteredJobs
      .filter((job) => isJobActive(job.last_date))
      .slice(0, 7);
  }, [filteredJobs]);

  // Hybrid recommended jobs (from useRecommendations hook)
  const recommendedJobs = useMemo(() => {
    return hybridRecommended.map((r) => r.job).slice(0, 5);
  }, [hybridRecommended]);

  // Similar jobs based on top recommendation or newest job
  const seedJobId = recommendedJobs[0]?.id || newJobs[0]?.id;
  const { data: similarJobs = [] } = useSimilarJobs(seedJobId, 5, personalizedSectionsReady);

  // Jobs matching user's tracked exams
  const examMatchedJobs = useMemo(() => {
    return examMatched.map((r) => r.job);
  }, [examMatched]);

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

  const showNoResults = !isLoading && filteredJobs.length === 0;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <PageHeader variant="dark" />

      <main className="md:mx-auto md:max-w-[960px] md:space-y-8 md:p-6 lg:p-8">
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

            {/* New Government Jobs Section - Latest uploaded jobs */}
            {newJobs.length > 0 && (
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

            {/* My Active Exams Section - Only show if user has tracked exams */}
            {activeExams.length > 0 && (
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

            {/* Based on Your Exams Section - Jobs matching tracked exams */}
            {examMatchedJobs.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up">
                <SectionHeader title="Based on Your Exams" variant="dark" />
                <div className="flex flex-col gap-4 px-5 md:px-0">
                  {examMatchedJobs.map((job) => (
                    <div key={job.id} className="relative">
                      <Badge
                        className="absolute -top-2 right-3 z-10 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 shadow-sm"
                      >
                        <Target className="h-3 w-3 mr-1" />
                        Tracked Exam
                      </Badge>
                      <RecommendedJobCard job={job} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Jobs For You Section - from /for-you wizard preferences */}
            {forYouJobs.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up">
                <SectionHeader title="Jobs For You" linkTo="/for-you" linkText="Show All" variant="dark" />
                <div className="relative">
                  <button
                    onClick={() => scrollLeft(forYouScrollRef, 276)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity md:hidden"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={forYouScrollRef}
                    className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:px-0"
                    onScroll={(e) => {
                      const cardWidth = 260 + 16;
                      const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
                      setActiveForYouIndex(Math.min(index, forYouJobs.length - 1));
                    }}
                  >
                    {forYouJobs.map((job) => (
                      <div key={job.id} className="w-[260px] sm:w-[300px] flex-shrink-0 md:w-auto">
                        <RecommendedJobCard job={job} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => scrollRight(forYouScrollRef, 276)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity md:hidden"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex justify-center gap-2 mt-4 px-5 md:hidden">
                  {forYouJobs.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeForYouIndex ? "bg-primary" : "bg-primary/30"
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Jobs Section - Horizontal scroll on mobile, rows on desktop */}
            {recommendedJobs.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up" style={{ animationDelay: "240ms" }}>
                <SectionHeader title="Recommended Jobs" linkTo="/recommendations" linkText="Show All" variant="dark" />
                {/* Mobile: horizontal scroll */}
                <div className="relative md:hidden">
                  <button
                    onClick={() => scrollLeft(recommendedScrollRef, 276)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={recommendedScrollRef}
                    className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide"
                    onScroll={(e) => {
                      const cardWidth = 260 + 16;
                      const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
                      setActiveRecommendedIndex(Math.min(index, recommendedJobs.length - 1));
                    }}
                  >
                    {recommendedJobs.map((job) => (
                      <div key={job.id} className="w-[260px] sm:w-[300px] flex-shrink-0">
                        <RecommendedJobCard job={job} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => scrollRight(recommendedScrollRef, 276)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex justify-center gap-2 mt-4 px-5 md:hidden">
                  {recommendedJobs.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeRecommendedIndex ? "bg-primary" : "bg-primary/30"
                      )}
                    />
                  ))}
                </div>
                {/* Desktop: row list */}
                <div className="hidden md:flex md:flex-col md:gap-3">
                  {recommendedJobs.map((job) => (
                    <RecommendedJobRow key={job.id} job={job} />
                  ))}
                </div>
              </section>
            )}

            {/* Similar Jobs Section - Horizontal scroll on mobile, grid on desktop */}
            {similarJobs.length > 0 && (
              <section className="mb-8 md:mb-0 md:animate-fade-in-up">
                <SectionHeader title="Similar Jobs" variant="dark" />
                <div className="relative md:hidden">
                  <button
                    onClick={() => scrollLeft(similarJobsScrollRef, 236)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={similarJobsScrollRef}
                    className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide"
                    onScroll={(e) => {
                      const cardWidth = 220 + 16;
                      const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
                      setActiveSimilarIndex(Math.min(index, similarJobs.length - 1));
                    }}
                  >
                    {similarJobs.map((sj) => (
                      <Link key={sj.id} to={`/jobs/${sj.slug || sj.id}`} className="block">
                        <div className="w-[220px] sm:w-[260px] flex-shrink-0 p-4 rounded-2xl bg-white dark:bg-card shadow-md border border-border/50 hover:shadow-lg transition-all">
                          <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2 mb-1">{sj.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{sj.department}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-1">{sj.location || 'India'}</span>
                          </div>
                          {sj.qualification && (
                            <p className="text-[10px] text-muted-foreground/70 mt-2 line-clamp-1">{sj.qualification}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                  <button
                    onClick={() => scrollRight(similarJobsScrollRef, 236)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex justify-center gap-2 mt-4 px-5 md:hidden">
                  {similarJobs.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === activeSimilarIndex ? "bg-primary" : "bg-primary/30"
                      )}
                    />
                  ))}
                </div>
                {/* Desktop: grid */}
                <div className="hidden md:grid md:grid-cols-3 md:gap-4">
                  {similarJobs.map((sj) => (
                    <Link key={sj.id} to={`/jobs/${sj.slug || sj.id}`} className="block">
                      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Briefcase className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2">{sj.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{sj.department}</p>
                        <div className="flex items-center gap-2 text-xs text-primary/70">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="line-clamp-1">{sj.location || 'India'}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Show all jobs if no featured/recommended split */}
            {newJobs.length === 0 &&
              recommendedJobs.length === 0 &&
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
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
