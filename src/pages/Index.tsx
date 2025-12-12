import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { ActiveExamCard } from "@/components/ActiveExamCard";
import { BottomNav } from "@/components/BottomNav";
import { SectorPreferenceCard } from "@/components/SectorPreferenceCard";
import { useJobs } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useExams } from "@/hooks/useExams";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

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
  const [activeRecommendedIndex, setActiveRecommendedIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const examsScrollRef = useRef<HTMLDivElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);
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

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs;
  }, [jobs]);

  // Show the 7 most recently uploaded jobs (already sorted by created_at DESC from useJobs)
  const newJobs = useMemo(() => {
    return filteredJobs.slice(0, 7);
  }, [filteredJobs]);

  // Show 6 jobs sorted by highest vacancy, filtered by user preferences
  const recommendedJobs = useMemo(() => {
    let filtered = [...filteredJobs];

    // Filter by user's preferred sectors if they have set preferences
    if (profile?.preferred_sectors && profile.preferred_sectors.length > 0) {
      filtered = filtered.filter((job) =>
        profile.preferred_sectors!.some((sector) =>
          job.title.toLowerCase().includes(sector.toLowerCase()) ||
          job.department.toLowerCase().includes(sector.toLowerCase())
        )
      );
    }

    // Exclude already tracked exams
    const trackedJobTitles = userExams.map((exam) => exam.exams?.name?.toLowerCase());
    filtered = filtered.filter(
      (job) => !trackedJobTitles.includes(job.title.toLowerCase())
    );

    return filtered
      .sort((a, b) => (b.vacancies || 0) - (a.vacancies || 0))
      .slice(0, 6);
  }, [filteredJobs, profile?.preferred_sectors, userExams]);

  // Show sector card if user is logged in, hasn't set preferences, hasn't skipped, and hasn't saved this session
  const showSectorCard = user && !profileLoading &&
    (!profile?.preferred_sectors || profile.preferred_sectors.length === 0) &&
    !sectorCardSkipped &&
    !preferencesSaved;

  // Active exams from user's tracked exams (top 4)
  const activeExams = useMemo(() => {
    return userExams.slice(0, 4);
  }, [userExams]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const cardWidth = 300 + 16; // card width + gap
    const index = Math.round(e.currentTarget.scrollLeft / cardWidth);
    setActiveCardIndex(Math.min(index, newJobs.length - 1));
  };

  const showNoResults = !isLoading && filteredJobs.length === 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader variant="dark" />

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
            {/* Sector Preference Card for first-time users */}
            {showSectorCard && (
              <div className="px-5 mb-6">
                <SectorPreferenceCard
                  onComplete={() => setPreferencesSaved(true)}
                  onSkip={() => setSectorCardSkipped(true)}
                />
              </div>
            )}

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
              <section className="mb-8">
                <SectionHeader title="New Government Jobs" variant="dark" />
                <div className="relative">
                  {/* Left chevron */}
                  <button
                    onClick={() => scrollLeft(scrollContainerRef, 316)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide"
                  >
                    {newJobs.map((job) => (
                      <FeaturedJobCard key={job.id} job={job} />
                    ))}
                  </div>
                  {/* Right chevron */}
                  <button
                    onClick={() => scrollRight(scrollContainerRef, 316)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Pagination dots */}
                <div className="flex justify-center gap-2 mt-4 px-5">
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
              <section className="mb-8">
                <SectionHeader title="My Active Exams" variant="dark" />
                <div className="relative">
                  {/* Left chevron */}
                  <button
                    onClick={() => scrollLeft(examsScrollRef, 196)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div
                    ref={examsScrollRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide"
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
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-full shadow-sm border border-border/30 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Pagination dots */}
                <div className="flex justify-center gap-2 mt-4 px-5">
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

            {/* Recommended Jobs Section */}
            {recommendedJobs.length > 0 && (
              <section className="mb-8">
                <SectionHeader title="Recommended Jobs" variant="dark" />
                <div className="flex flex-col gap-4 px-5">
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
              filteredJobs.length > 0 && (
                <section>
                  <SectionHeader title="All Jobs" variant="dark" />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 px-5">
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
