import { useState, useMemo } from "react";
import { SearchHeader } from "@/components/SearchHeader";
import { CategoryFilter } from "@/components/CategoryFilter";
import { JobCard } from "@/components/JobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const { data: jobs, isLoading, error } = useJobs();

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    let filtered = jobs;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.department.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query)
      );
    }

    // Filter by category (simplified - in real app, jobs would have category field)
    if (activeCategory !== "all") {
      filtered = filtered.filter((job) =>
        job.department.toLowerCase().includes(activeCategory.toLowerCase())
      );
    }

    return filtered;
  }, [jobs, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <SearchHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
      
      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load jobs</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try a different search term" : "Check back later for new opportunities"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-foreground">
                {filteredJobs.length} Jobs Available
              </h2>
            </div>
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
