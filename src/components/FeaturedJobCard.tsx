import { MapPin } from "lucide-react";
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
    <Link to={`/job/${job.id}`} className="block">
      <div className="w-[260px] sm:w-[300px] h-[160px] sm:h-[180px] flex-shrink-0 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground relative overflow-hidden shadow-lg hover:bg-primary/90 transition-all">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-primary-foreground/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 sm:w-24 h-20 sm:h-24 bg-primary-foreground/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        {/* Save button */}
        <div 
          className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10" 
          onClick={(e) => e.preventDefault()}
        >
          <SaveJobButton jobId={job.id} variant="light" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col">
          <p className="text-sm sm:text-lg font-bold mb-0.5 sm:mb-1 truncate pr-8">{job.title}</p>
          <p className="text-xs sm:text-sm text-primary-foreground/80 mb-3 sm:mb-4 truncate">{job.department}</p>

          {/* Tags */}
          <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-nowrap overflow-hidden">
            {job.vacancies && (
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 rounded-full text-[10px] sm:text-xs flex-shrink-0">
                {job.vacancies} Vacancy
              </Badge>
            )}
            <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 rounded-full text-[10px] sm:text-xs flex-shrink-0">
              Full-Time
            </Badge>
            <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 rounded-full text-[10px] sm:text-xs flex-shrink-0">
              Govt
            </Badge>
          </div>

          {/* Salary and Location */}
          <div className="flex items-center justify-between mt-auto">
            <p className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-[140px]">
              {formatSalary(job.salary_min, job.salary_max)}
            </p>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-primary-foreground/80">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-[80px]">{job.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
