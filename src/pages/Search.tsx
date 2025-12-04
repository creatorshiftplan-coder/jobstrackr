import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobCard } from "@/components/JobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon, Filter, X } from "lucide-react";

export default function Search() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const { data: jobs, isLoading } = useJobs();

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="font-display font-bold text-xl text-foreground mb-4">Search Jobs</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Job title, department, location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
