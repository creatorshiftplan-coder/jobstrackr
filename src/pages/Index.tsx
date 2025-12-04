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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AISearchResult } from "@/components/AISearchResult";
import { Briefcase, Sparkles, Loader2, X } from "lucide-react";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: jobs, isLoading, error } = useJobs();
  const { isSearching, isSaving, aiResults, searchWithAI, saveAIJob, dismissJob, clearAIResults } = useAIJobSearch();

  // Get unique locations for filter
  const locations = useMemo(() => {
    if (!jobs) return [];
    const locs = [...new Set(jobs.map(job => job.location))];
    return locs.slice(0, 8);
  }, [jobs]);

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
      result = result.filter(job => selectedLocations.includes(job.location));
    }

    return result;
  }, [jobs, searchQuery, selectedLocations]);

  const featuredJobs = useMemo(() => {
    return filteredJobs.filter(job => job.is_featured).slice(0, 5);
  }, [filteredJobs]);

  const recommendedJobs = useMemo(() => {
    return filteredJobs.filter(job => !job.is_featured).slice(0, 4);
  }, [filteredJobs]);

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const handleAISearch = async () => {
    if (searchQuery.length >= 3) {
      await searchWithAI(searchQuery);
    }
  };

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
      />

      {/* Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Filter Jobs</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <h4 className="text-sm font-medium mb-3">Location</h4>
            <div className="flex flex-wrap gap-2">
              {locations.map(location => (
                <Badge
                  key={location}
                  variant={selectedLocations.includes(location) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleLocation(location)}
                >
                  {location}
                  {selectedLocations.includes(location) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
            {selectedLocations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setSelectedLocations([])}
              >
                Clear all filters
              </Button>
            )}
          </div>
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
                    onSave={() => saveAIJob(job)}
                    onDismiss={() => dismissJob(job)}
                    isSaving={isSaving}
                  />
                ))}
              </section>
            )}

            {/* No Results - Show AI Search Option */}
            {showNoResults && aiResults.length === 0 && (
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
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Search with AI
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Featured Jobs Section */}
            {featuredJobs.length > 0 && (
              <section className="mb-8">
                <SectionHeader title="New Government Jobs" />
                <div className="flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide">
                  {featuredJobs.map((job) => (
                    <FeaturedJobCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Jobs Section */}
            {recommendedJobs.length > 0 && (
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
            {featuredJobs.length === 0 && recommendedJobs.length === 0 && filteredJobs.length > 0 && (
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
