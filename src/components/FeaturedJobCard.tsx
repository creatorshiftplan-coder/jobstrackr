import { MapPin, Bookmark } from "lucide-react";
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
      <div className="min-w-[300px] p-5 rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        {/* Save button */}
        <div className="absolute top-4 right-4 z-10" onClick={(e) => e.preventDefault()}>
          <SaveJobButton jobId={job.id} className="text-primary-foreground hover:bg-white/20" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <p className="text-lg font-bold mb-1">'{job.title}'</p>
          <p className="text-sm text-primary-foreground/80 mb-4">{job.department}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {job.vacancies && (
              <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 rounded-full text-xs">
                {job.vacancies} Vacancy
              </Badge>
            )}
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 rounded-full text-xs">
              Full-Time
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 rounded-full text-xs">
              Govt
            </Badge>
          </div>

          {/* Salary and Location */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {formatSalary(job.salary_min, job.salary_max)}
            </p>
            <div className="flex items-center gap-1 text-sm text-primary-foreground/80">
              <MapPin className="h-4 w-4" />
              <span>{job.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
