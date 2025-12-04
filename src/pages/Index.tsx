import { useState, useMemo } from "react";
import { WelcomeHeader } from "@/components/WelcomeHeader";
import { SearchWithFilter } from "@/components/SearchWithFilter";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedJobCard } from "@/components/FeaturedJobCard";
import { RecommendedJobCard } from "@/components/RecommendedJobCard";
import { BottomNav } from "@/components/BottomNav";
import { useJobs } from "@/hooks/useJobs";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";

const colorVariants = ["pink", "blue", "green", "orange"] as const;

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: jobs, isLoading, error } = useJobs();

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    
    if (!searchQuery) return jobs;

    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        job.department.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const featuredJobs = useMemo(() => {
    return filteredJobs.filter(job => job.is_featured).slice(0, 5);
  }, [filteredJobs]);

  const recommendedJobs = useMemo(() => {
    return filteredJobs.filter(job => !job.is_featured).slice(0, 4);
  }, [filteredJobs]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <WelcomeHeader />
      <SearchWithFilter 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
      />
      
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
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 px-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try a different search term" : "Check back later for new opportunities"}
            </p>
          </div>
        ) : (
          <>
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
            {featuredJobs.length === 0 && recommendedJobs.length === 0 && (
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
