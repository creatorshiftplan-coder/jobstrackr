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
import { Search as SearchIcon, Filter, X, Sparkles, Loader2, SearchX, MapPin, Building, Bookmark, Menu } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { INDIAN_STATES, EXAM_SECTORS } from "@/constants/filters";

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: jobs, isLoading } = useJobs();
  const { isSearching, aiResults, searchStatus, searchWithAI, getSavedJobId, clearAIResults, dismissJob } = useAIJobSearch();

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let filtered = jobs;

    if (query) {
      const q = query.toLowerCase();
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

    return filtered;
  }, [jobs, query, selectedLocations, selectedSectors]);

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

  const clearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedSectors([]);
  };

  const handleSearch = () => {
    if (query.length >= 3) {
      searchWithAI(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const totalFilters = selectedLocations.length + selectedSectors.length;
  const showAISearch = query.length >= 3 && filteredJobs.length === 0 && aiResults.length === 0 && searchStatus !== "not_found";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4FD] via-[#D6EEFF] to-[#F0F8FF] pb-20">
      <header className="sticky top-0 z-40 bg-[#E8F4FD] px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/more">
            <div className="h-10 w-10 rounded-full bg-[#0A4174]/10 flex items-center justify-center hover:bg-[#0A4174]/20 transition-colors">
              <Menu className="h-5 w-5 text-[#0A4174]" />
            </div>
          </Link>
          <h1 className="font-display font-bold text-xl text-[#0A4174] flex-1 text-center">Explore Jobs</h1>
          <Link to="/saved">
            <div className="h-10 w-10 rounded-full bg-[#0A4174]/10 flex items-center justify-center hover:bg-[#0A4174]/20 transition-colors">
              <Bookmark className="h-5 w-5 text-[#0A4174]" />
            </div>
          </Link>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0A4174]/60" />
            <Input
              placeholder="Job title, department, location..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) clearAIResults();
              }}
              onKeyDown={handleKeyDown}
              className="pl-10 bg-white/80 border-[#0A4174]/20 text-[#0A4174] placeholder:text-[#0A4174]/50"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsFilterOpen(true)} 
            className="relative bg-[#0A4174] border-[#0A4174] hover:bg-[#0A4174]/90 text-white"
          >
            <Filter className="h-4 w-4" />
            {totalFilters > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 justify-center text-xs bg-[#A7EBF2] text-[#0A4174]">
                {totalFilters}
              </Badge>
            )}
          </Button>
        </div>
      </header>

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
                  {INDIAN_STATES.map((state) => (
                    <Badge
                      key={state}
                      variant={selectedLocations.includes(state) ? "default" : "outline"}
                      className="cursor-pointer"
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
              <ScrollArea className="h-[40vh]">
                <div className="flex flex-wrap gap-2 pr-4">
                  {EXAM_SECTORS.map((sector) => (
                    <Badge
                      key={sector}
                      variant={selectedSectors.includes(sector) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSector(sector)}
                    >
                      {sector}
                      {selectedSectors.includes(sector) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {totalFilters > 0 && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={clearAllFilters}>
              Clear all filters ({totalFilters})
            </Button>
          )}
        </SheetContent>
      </Sheet>

      <main className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[#0A4174]/80">{filteredJobs.length} results</p>

            <div className="flex flex-col gap-6">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {/* AI Search Results */}
            {aiResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-[#0A4174]/90">AI Found Results</h3>
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
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                  <SearchX className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No exams found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  No exams found for this search. Try another category or keyword.
                </p>
              </div>
            )}

            {/* AI Search Section */}
            {showAISearch && !isSearching && (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold">No jobs found in database</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Want to search with AI? We'll find information about this job and add it for you.
                </p>
                <Button onClick={handleSearch}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Search with AI
                </Button>
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
