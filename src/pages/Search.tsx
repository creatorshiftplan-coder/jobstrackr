import { useState, useMemo } from "react";
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
import { Search as SearchIcon, Filter, X, Sparkles, Loader2, SearchX, MapPin, Building, Bookmark, Menu, GraduationCap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { INDIAN_STATES, EXAM_SECTORS, EDUCATION_QUALIFICATIONS } from "@/constants/filters";
import { useDebouncedValue } from "@/hooks/useDebounce";

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: jobs, isLoading } = useJobs();
  const { isSearching, aiResults, searchStatus, searchWithAI, getSavedJobId, clearAIResults, dismissJob } = useAIJobSearch();

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
      filtered = filtered.filter((job) =>
        selectedLocations.some((loc) => job.location.toLowerCase().includes(loc.toLowerCase()))
      );
    }

    if (selectedSectors.length > 0) {
      filtered = filtered.filter((job) =>
        selectedSectors.some(
          (sector) =>
            job.title.toLowerCase().includes(sector.toLowerCase()) ||
            job.department.toLowerCase().includes(sector.toLowerCase())
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
      const aActive = new Date(a.last_date) > now;
      const bActive = new Date(b.last_date) > now;
      // Prioritize active jobs
      if (aActive !== bActive) return bActive ? 1 : -1;
      // Then sort by created_at descending (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  }, [jobs, debouncedQuery, selectedLocations, selectedSectors, selectedQualifications]);

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
    if (query.length >= 3) {
      searchWithAI(query);
    }
  };

  const totalFilters = selectedLocations.length + selectedSectors.length + selectedQualifications.length;
  
  // Show AI button when query has 3+ chars and no AI results yet
  const showAISearchButton = query.length >= 3 && !isSearching && searchStatus !== "not_found" && aiResults.length === 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl px-4 pt-12 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/more">
            <div className="h-10 w-10 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors">
              <Menu className="h-5 w-5 text-primary" />
            </div>
          </Link>
          <h1 className="font-display font-bold text-xl text-foreground flex-1 text-center tracking-tight">Explore Jobs</h1>
          <Link to="/saved">
            <div className="h-10 w-10 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
          </Link>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Job title, department, location..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) clearAIResults();
              }}
              
              className="pl-10 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl h-11 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <Button 
            variant="default" 
            size="icon" 
            onClick={() => setIsFilterOpen(true)} 
            className="relative h-11 w-11 rounded-xl"
          >
            <Filter className="h-4 w-4" />
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
                <div className="flex flex-wrap gap-2 pr-4">
                  {INDIAN_STATES.map((state) => (
                    <Badge
                      key={state}
                      variant={selectedLocations.includes(state) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition-transform px-3 py-1.5"
                      onClick={() => toggleLocation(state)}
                    >
                      {state}
                      {selectedLocations.includes(state) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sector" className="mt-4">
              <ScrollArea className="h-[45vh]">
                <div className="flex flex-wrap gap-2 pr-4">
                  {EXAM_SECTORS.map((sector) => (
                    <Badge
                      key={sector}
                      variant={selectedSectors.includes(sector) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition-transform px-3 py-1.5"
                      onClick={() => toggleSector(sector)}
                    >
                      {sector}
                      {selectedSectors.includes(sector) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="qualification" className="mt-4">
              <ScrollArea className="h-[45vh]">
                <div className="flex flex-wrap gap-2 pr-4">
                  {EDUCATION_QUALIFICATIONS.map((qual) => (
                    <Badge
                      key={qual}
                      variant={selectedQualifications.includes(qual) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition-transform px-3 py-1.5"
                      onClick={() => toggleQualification(qual)}
                    >
                      {qual}
                      {selectedQualifications.includes(qual) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
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

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">{filteredJobs.length} results</p>

            <div className="flex flex-col gap-4">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {/* Find more jobs with AI button - appears after search results */}
            {showAISearchButton && (
              <div className="text-center py-6 border-t border-border/30 mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to discover more jobs related to "{query}"?
                </p>
                <Button 
                  onClick={handleSearch} 
                  variant="outline"
                  className="rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Find more jobs with AI
                </Button>
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