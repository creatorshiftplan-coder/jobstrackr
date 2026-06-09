import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobCard } from "@/components/JobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { AISearchResult } from "@/components/AISearchResult";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search as SearchIcon, X, Sparkles, Loader2, SearchX, MapPin, Building, Bookmark, GraduationCap, Check } from "lucide-react";
import { MenuBarsIcon } from "@/components/icons/MenuBarsIcon";
import { Link, useSearchParams } from "react-router-dom";
import logoColor from "@/assets/logo-color.png";
import logoWhite from "@/assets/logo-white.png";
import { INDIAN_STATES, EXAM_SECTORS, EDUCATION_QUALIFICATIONS } from "@/constants/filters";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { inferCategory, isJobActive, matchesSectorPreference } from "@/lib/jobUtils";

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: jobs, isLoading } = useJobs();
  const { isSearching, aiResults, searchStatus, searchWithAI, getSavedJobId, clearAIResults, dismissJob } = useAIJobSearch();
  const { user } = useAuth();
  const { showAuthRequired } = useAuthRequired();

  const updateSearchQuery = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value.trim()) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
      clearAIResults();
    }

    setSearchParams(nextParams, { replace: true });
  };

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let filtered = jobs;

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          job.department.toLowerCase().includes(q) ||
          job.location.toLowerCase().includes(q) ||
          job.qualification.toLowerCase().includes(q)
      );
    }

    if (selectedLocations.length > 0) {
      if (!selectedLocations.includes("All India")) {
      filtered = filtered.filter((job) =>
        selectedLocations.some((loc) => job.location.toLowerCase().includes(loc.toLowerCase()))
      );
      }
    }

    if (selectedSectors.length > 0) {
      filtered = filtered.filter((job) =>
        selectedSectors.some(
          (sector) =>
            matchesSectorPreference(job.department, job.title, sector) ||
            inferCategory(job.department, job.title).toLowerCase().includes(sector.toLowerCase())
        )
      );
    }

    if (selectedQualifications.length > 0) {
      filtered = filtered.filter((job) =>
        selectedQualifications.some((qual) =>
          job.qualification.toLowerCase().includes(qual.toLowerCase().replace(" / ", "/").replace("/", " "))
        )
      );
    }

    // Sort by newest active jobs first
    const now = new Date();
    filtered = [...filtered].sort((a, b) => {
      const aActive = isJobActive(a.last_date);
      const bActive = isJobActive(b.last_date);
      // Prioritize active jobs
      if (aActive !== bActive) return bActive ? 1 : -1;
      // Then sort by created_at descending (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  }, [jobs, debouncedQuery, selectedLocations, selectedSectors, selectedQualifications]);

  const deferredFilteredJobs = useDeferredValue(filteredJobs);

  // ── Mobile sticky header: directional-reveal (Facebook / Instagram style) ──
  // Two-state machine: "shown" | "hidden". CSS handles the animation.
  //
  // Uses a position-anchor instead of a direction+accumulator so that mobile
  // momentum jitter (tiny backward events between real scroll events) cannot
  // reset the counter and break the reveal.
  //
  // Rules:
  //   • scrollY ≤ TOP_PIN_PX   → always shown (top of page / pull-to-refresh)
  //   • shown  + scrolled DOWN ≥ HIDE_THRESHOLD from anchorY → hidden
  //   • hidden + scrolled UP   ≥ REVEAL_THRESHOLD from anchorY → shown
  //   • While hidden and scrolling further down, anchorY advances with the
  //     scroll so the reveal threshold is always measured from the most
  //     recent bottom, not from where the bar first disappeared.
  const TOP_PIN_PX          = 10;
  const HIDE_THRESHOLD_PX   = 30;
  const REVEAL_THRESHOLD_PX = 30;

  const mobileHeaderRef = useRef<HTMLElement>(null);
  const [visibleJobsCount, setVisibleJobsCount] = useState(20);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const header = mobileHeaderRef.current;
    if (!header) return;

    type HeaderState = "shown" | "hidden";
    let state: HeaderState = "shown";
    let lastY   = window.scrollY;
    // anchorY is the reference point for threshold measurements.
    //   • shown  → set when we became shown; hide fires at anchorY + HIDE_THRESHOLD
    //   • hidden → tracks the furthest-down position reached; reveal fires when
    //              we've come back up REVEAL_THRESHOLD from anchorY
    let anchorY = window.scrollY;
    let rafId: number | null = null;

    const setHeaderState = (next: HeaderState, y: number) => {
      if (next === state) return;
      state  = next;
      anchorY = y;
      const h = header.offsetHeight || 1;
      header.style.transform = next === "hidden"
        ? `translate3d(0, ${-h}px, 0)`
        : "translate3d(0, 0, 0)";
    };

    const apply = () => {
      rafId = null;
      const y  = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy === 0) return;

      const h = header.offsetHeight || 1;

      if (y <= TOP_PIN_PX) {
        // Always visible at the very top (handles pull-to-refresh / overscroll)
        setHeaderState("shown", y);
      } else if (state === "shown") {
        // Hide once we've scrolled down HIDE_THRESHOLD from where we last showed
        if (y > h && y > anchorY + HIDE_THRESHOLD_PX) {
          setHeaderState("hidden", y);
        }
      } else {
        // state === "hidden"
        // Keep anchorY at the furthest-down position reached while hidden, so
        // the reveal always measures from the most recent bottom. Tiny jitter
        // (a few-px forward bump during momentum scroll) just nudges anchorY
        // down slightly — it does NOT reset a separate counter to 0.
        if (dy > 0 && y > anchorY) anchorY = y;
        // Reveal once the user has scrolled up REVEAL_THRESHOLD from anchorY
        if (y < anchorY - REVEAL_THRESHOLD_PX) {
          setHeaderState("shown", y);
        }
      }
    };

    const onScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      header.style.transform = "";
    };
  }, []);

  // Scroll-triggered infinite scroll via IntersectionObserver
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && deferredFilteredJobs.length > visibleJobsCount) {
          setVisibleJobsCount((prev) => Math.min(prev + 20, deferredFilteredJobs.length));
        }
      },
      {
        root: document.getElementById("main-scroll") || null,
        rootMargin: "300px",
      }
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [deferredFilteredJobs, visibleJobsCount]);

  // Background loader to gradually render more jobs after initial paint / filter reset
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const loadMoreBackground = () => {
      setVisibleJobsCount((prev) => {
        if (prev < deferredFilteredJobs.length) {
          timerId = setTimeout(loadMoreBackground, 300);
          return Math.min(prev + 20, deferredFilteredJobs.length);
        }
        return prev;
      });
    };

    // Delay start slightly to let the initial 20 items paint first
    timerId = setTimeout(loadMoreBackground, 500);

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [deferredFilteredJobs]);

  useEffect(() => {
    setVisibleJobsCount(20);
  }, [debouncedQuery, selectedLocations, selectedSectors, selectedQualifications]);

  const toggleLocation = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  const toggleQualification = (qualification: string) => {
    setSelectedQualifications((prev) =>
      prev.includes(qualification) ? prev.filter((q) => q !== qualification) : [...prev, qualification]
    );
  };

  const clearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedSectors([]);
    setSelectedQualifications([]);
  };

  const handleSearch = () => {
    if (!user) {
      showAuthRequired("Login to use AI-powered job search");
      return;
    }
    if (query.length >= 3) {
      searchWithAI(query);
    }
  };

  const totalFilters = selectedLocations.length + selectedSectors.length + selectedQualifications.length;
  const visibleJobs = deferredFilteredJobs.slice(0, visibleJobsCount);
  const hasMoreJobs = deferredFilteredJobs.length > visibleJobs.length;

  // Show AI button when query has 3+ chars and no AI results yet
  const showAISearchButton = query.length >= 3 && !isSearching && searchStatus !== "not_found" && aiResults.length === 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header
        ref={mobileHeaderRef}
        className="sticky top-0 z-40 bg-primary dark:bg-card backdrop-blur-xl border-b border-primary-foreground/10 dark:border-border md:hidden will-change-transform"
        style={{ transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/more">
            <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
              <MenuBarsIcon className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </div>
          </Link>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <img src={logoColor} alt="JobsTrackr" className="h-7 w-7 object-contain dark:hidden" />
            <img src={logoWhite} alt="JobsTrackr" className="h-7 w-7 object-contain hidden dark:block" />
            <h1 className="font-display font-bold text-lg text-primary-foreground dark:text-foreground tracking-tight">Explore Jobs</h1>
          </div>
          <Link to="/saved">
            <div className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 dark:hover:bg-secondary/80 transition-colors">
              <Bookmark className="h-5 w-5 text-primary-foreground dark:text-primary" />
            </div>
          </Link>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Job title, department, location..."
              value={query}
              onChange={(e) => updateSearchQuery(e.target.value)}
              className="pl-10 pr-9 bg-white/95 dark:bg-secondary/80 border border-white/30 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11 focus:ring-2 focus:ring-white/50 dark:focus:ring-primary/50 transition-all shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsFilterOpen(true)}
            className="relative h-11 w-11 rounded-xl bg-white dark:bg-secondary hover:bg-white/90 dark:hover:bg-secondary/80 text-primary border-0 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4h9.75M10.5 4a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 4H7.5m3 16h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-8h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            {totalFilters > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 justify-center text-xs bg-accent text-accent-foreground rounded-full">
                {totalFilters}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[75vh]">
          <SheetHeader>
            <SheetTitle className="text-lg font-display">Filter Jobs</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="location" className="mt-4">
            <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-secondary/50 rounded-xl">
              <TabsTrigger value="location" className="gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Location</span>
                {selectedLocations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                    {selectedLocations.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sector" className="gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Sector</span>
                {selectedSectors.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                    {selectedSectors.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="qualification" className="gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Education</span>
                {selectedQualifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                    {selectedQualifications.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="location" className="mt-4">
              <ScrollArea className="h-[45vh]">
                <div className="flex flex-col gap-2 pr-4">
                  {INDIAN_STATES.map((state) => {
                    const isSelected = selectedLocations.includes(state);
                    return (
                      <div
                        key={state}
                        onClick={() => toggleLocation(state)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-secondary/30"
                          }`}
                      >
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                          ? "bg-primary-foreground border-primary-foreground"
                          : "border-muted-foreground/40"
                          }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <span className="font-medium">{state}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sector" className="mt-4">
              <ScrollArea className="h-[45vh]">
                <div className="flex flex-col gap-2 pr-4">
                  {EXAM_SECTORS.map((sector) => {
                    const isSelected = selectedSectors.includes(sector);
                    return (
                      <div
                        key={sector}
                        onClick={() => toggleSector(sector)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-secondary/30"
                          }`}
                      >
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                          ? "bg-primary-foreground border-primary-foreground"
                          : "border-muted-foreground/40"
                          }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <span className="font-medium">{sector}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="qualification" className="mt-4">
              <ScrollArea className="h-[45vh]">
                <div className="flex flex-col gap-2 pr-4">
                  {EDUCATION_QUALIFICATIONS.map((qual) => {
                    const isSelected = selectedQualifications.includes(qual);
                    return (
                      <div
                        key={qual}
                        onClick={() => toggleQualification(qual)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-secondary/30"
                          }`}
                      >
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                          ? "bg-primary-foreground border-primary-foreground"
                          : "border-muted-foreground/40"
                          }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <span className="font-medium">{qual}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {totalFilters > 0 && (
            <Button variant="ghost" size="sm" className="mt-4 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={clearAllFilters}>
              Clear all filters ({totalFilters})
            </Button>
          )}
        </SheetContent>
      </Sheet>

      <main className="px-4 py-4 md:mx-auto md:max-w-6xl md:px-6 md:py-6">
        <div className="hidden md:flex md:items-center md:justify-between md:gap-6 md:pb-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Explore Jobs</h1>
            <p className="text-sm text-muted-foreground">Search by title, department, location, and qualification.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(true)}
            className="relative min-w-32 rounded-xl"
          >
            Filters
            {totalFilters > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1.5 justify-center text-xs bg-primary text-primary-foreground rounded-full">
                {totalFilters}
              </Badge>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">{deferredFilteredJobs.length} results</p>

            <div className="flex flex-col gap-4">
              {visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {hasMoreJobs && (
              <div ref={observerTargetRef} className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {/* Find more jobs with AI button - appears after search results */}
            {showAISearchButton && (
              <div className="text-center py-6 border-t border-border/30 mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to discover more jobs related to "{query}"?
                </p>
                <button
                  onClick={handleSearch}
                  className="ai-glow-btn"
                >
                  <div className="ai-glow-btn-inner">
                    <Sparkles className="h-4 w-4" />
                    Search with AI
                  </div>
                </button>
              </div>
            )}

            {/* AI Search Results */}
            {aiResults.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-primary">AI Discovered Jobs</h3>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {aiResults.length} found
                  </Badge>
                </div>
                {aiResults.map((job, index) => (
                  <AISearchResult
                    key={`${job.exam_name}-${index}`}
                    job={job}
                    onDismiss={() => dismissJob(job)}
                    savedJobId={getSavedJobId(job.exam_name)}
                  />
                ))}
              </div>
            )}

            {/* AI Search "Not Found" Status */}
            {searchStatus === "not_found" && (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center">
                  <SearchX className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">No exams found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  No exams found for this search. Try another category or keyword.
                </p>
              </div>
            )}

            {isSearching && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Searching with AI...</p>
              </div>
            )}

            {searchStatus === "error" && aiResults.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Couldn't find information about this job. Try a different search term.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
