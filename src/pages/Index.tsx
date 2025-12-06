import { useState, useMemo } from "react";
import { WelcomeHeader } from "@/components/WelcomeHeader";
import { SearchWithFilter } from "@/components/SearchWithFilter";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { useAIJobSearch } from "@/hooks/useAIJobSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AISearchResult } from "@/components/AISearchResult";
import { Briefcase, Sparkles, Loader2, X, SearchX, MapPin, Building } from "lucide-react";
import { INDIAN_STATES, EXAM_SECTORS } from "@/constants/filters";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: jobs, isLoading, error } = useJobs();
  const { isSearching, aiResults, searchStatus, searchWithAI, getSavedJobId, dismissJob, clearAIResults } = useAIJobSearch();

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    let result = jobs;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.department.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query)
      );
    }

    if (selectedLocations.length > 0) {
      result = result.filter(job => 
        selectedLocations.some(loc => 
          job.location.toLowerCase().includes(loc.toLowerCase())
        )
      );
    }

    if (selectedSectors.length > 0) {
      result = result.filter(job =>
        selectedSectors.some(sector =>
          job.title.toLowerCase().includes(sector.toLowerCase()) ||
          job.department.toLowerCase().includes(sector.toLowerCase())
        )
      );
    }

    return result;
  }, [jobs, searchQuery, selectedLocations, selectedSectors]);

  // Show the 5 most recently uploaded jobs (already sorted by created_at DESC from useJobs)
  const newJobs = useMemo(() => {
    return filteredJobs.slice(0, 5);
  }, [filteredJobs]);

  // Show next 4 jobs for recommended section (avoid overlap with newJobs)
  const recommendedJobs = useMemo(() => {
    return filteredJobs.slice(5, 9);
  }, [filteredJobs]);

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const toggleSector = (sector: string) => {
    setSelectedSectors(prev => 
      prev.includes(sector) 
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    );
  };

  const handleAISearch = async () => {
    if (searchQuery.length >= 3) {
      await searchWithAI(searchQuery);
    }
  };

  const clearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedSectors([]);
  };

  const totalFilters = selectedLocations.length + selectedSectors.length;
  const showNoResults = !isLoading && filteredJobs.length === 0;
  const canSearchAI = searchQuery.length >= 3 && !isSearching;

  return (
    <div className="min-h-screen bg-background pb-24">
      <WelcomeHeader />
      <SearchWithFilter 
        searchQuery={searchQuery} 
        onSearchChange={(value) => {
          setSearchQuery(value);
          if (!value) clearAIResults();
        }}
        onFilterClick={() => setIsFilterOpen(true)}
        filterCount={totalFilters}
      />

      {/* Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[70vh]">
          <SheetHeader>
            <SheetTitle>Filter Jobs</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="location" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="location" className="gap-1">
                <MapPin className="h-4 w-4" />
                Location
                {selectedLocations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {selectedLocations.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sector" className="gap-1">
                <Building className="h-4 w-4" />
                Exam Sector
                {selectedSectors.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {selectedSectors.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="location" className="mt-4">
              <ScrollArea className="h-[40vh]">
                <div className="flex flex-wrap gap-2 pr-4">
                  {INDIAN_STATES.map(state => (
                    <Badge
                      key={state}
                      variant={selectedLocations.includes(state) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleLocation(state)}
                    >
                      {state}
                      {selectedLocations.includes(state) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="sector" className="mt-4">
              <ScrollArea className="h-[40vh]">
                <div className="flex flex-wrap gap-2 pr-4">
                  {EXAM_SECTORS.map(sector => (
                    <Badge
                      key={sector}
                      variant={selectedSectors.includes(sector) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSector(sector)}
                    >
                      {sector}
                      {selectedSectors.includes(sector) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {totalFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={clearAllFilters}
            >
              Clear all filters ({totalFilters})
            </Button>
          )}
        </SheetContent>
      </Sheet>
      
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

            {/* No Results - Show AI Search Option */}
            {showNoResults && aiResults.length === 0 && searchStatus !== "not_found" && !isSearching && (
              <div className="text-center py-12 px-5">
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-foreground mb-2">No jobs found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search term or use AI search" : "Check back later for new opportunities"}
                </p>
                
                {canSearchAI && (
                  <Button onClick={handleAISearch} disabled={isSearching}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Search with AI
                  </Button>
                )}
              </div>
            )}

            {/* New Government Jobs Section - Latest uploaded jobs */}
            {newJobs.length > 0 && !isSearching && searchStatus !== "not_found" && (
              <section className="mb-8">
                <SectionHeader title="New Government Jobs" />
                <div className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide">
                  {newJobs.map((job) => (
                    <FeaturedJobCard key={job.id} job={job} />
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
            {newJobs.length === 0 && recommendedJobs.length === 0 && filteredJobs.length > 0 && !isSearching && searchStatus !== "not_found" && (
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
