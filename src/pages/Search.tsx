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
import { Search as SearchIcon, Filter, X, Sparkles, Loader2 } from "lucide-react";

export default function Search() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const { data: jobs, isLoading } = useJobs();
  const { isSearching, isSaving, aiResults, searchStatus, searchWithAI, saveAIJob, clearAIResults, dismissJob } = useAIJobSearch();

  const locations = useMemo(() => {
    if (!jobs) return [];
    const uniqueLocations = [...new Set(jobs.map((j) => j.location))];
    return uniqueLocations.slice(0, 6);
  }, [jobs]);

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

    if (filters.length > 0) {
      filtered = filtered.filter((job) =>
        filters.some((f) => job.location.toLowerCase().includes(f.toLowerCase()))
      );
    }

    return filtered;
  }, [jobs, query, filters]);

  const toggleFilter = (filter: string) => {
    setFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
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

  const showAISearch = query.length >= 3 && filteredJobs.length === 0 && aiResults.length === 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="font-display font-bold text-xl text-foreground mb-4">Search Jobs</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Job title, department, location..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) clearAIResults();
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 bg-secondary border-0"
          />
        </div>
      </header>

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filter by location</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <Badge
              key={loc}
              variant={filters.includes(loc) ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => toggleFilter(loc)}
            >
              {loc}
              {filters.includes(loc) && <X className="ml-1 h-3 w-3" />}
            </Badge>
          ))}
        </div>
      </div>

      <main className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{filteredJobs.length} results</p>
            
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}

            {/* AI Search Results */}
            {aiResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">AI Found Results</h3>
                {aiResults.map((job, index) => (
                  <AISearchResult
                    key={`${job.exam_name}-${index}`}
                    job={job}
                    onSave={() => saveAIJob(job)}
                    onDismiss={() => dismissJob(job)}
                    isSaving={isSaving}
                  />
                ))}
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
