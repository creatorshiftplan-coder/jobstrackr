import { MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { SaveJobButton } from "@/components/SaveJobButton";

interface FeaturedJobCardProps {
  job: Job;
}

export function FeaturedJobCard({ job }: FeaturedJobCardProps) {
  const formatSalary = (min: number | null, max: number | null) => {
    if (min && max) {
      return `₹${(min / 1000).toFixed(0)}k - ₹${(max / 1000).toFixed(0)}k/month`;
    }
    if (min) return `₹${(min / 1000).toFixed(0)}k/month`;
    if (max) return `₹${(max / 1000).toFixed(0)}k/month`;
    return "Salary negotiable";
  };

  return (
    <Link to={`/job/${job.id}`} className="block group">
      <div className="w-[260px] sm:w-[300px] h-[160px] sm:h-[180px] flex-shrink-0 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground relative overflow-hidden shadow-soft hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-foreground/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-primary-foreground/5 rounded-full blur-xl animate-pulse-soft" />
        
        {/* Save button */}
        <div 
          className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10" 
          onClick={(e) => e.preventDefault()}
        >
          <SaveJobButton jobId={job.id} variant="light" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground/80" />
            <span className="text-[10px] sm:text-xs font-medium text-primary-foreground/80 uppercase tracking-wider">Featured</span>
          </div>
          <p className="text-sm sm:text-lg font-bold mb-0.5 truncate pr-8">{job.title}</p>
          <p className="text-xs sm:text-sm text-primary-foreground/70 mb-3 truncate">{job.department}</p>

          {/* Tags */}
          <div className="flex gap-1.5 sm:gap-2 mb-3 flex-nowrap overflow-hidden">
            {job.vacancies && (
              <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0 rounded-lg text-[10px] sm:text-xs flex-shrink-0 backdrop-blur-sm">
                {job.vacancies} Posts
              </Badge>
            )}
            <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0 rounded-lg text-[10px] sm:text-xs flex-shrink-0 backdrop-blur-sm">
              Full-Time
            </Badge>
          </div>

          {/* Salary and Location */}
          <div className="flex items-center justify-between mt-auto">
            <p className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-[140px]">
              {formatSalary(job.salary_min, job.salary_max)}
            </p>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-primary-foreground/80 bg-primary-foreground/10 rounded-lg px-2 py-1 backdrop-blur-sm">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-[80px]">{job.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
