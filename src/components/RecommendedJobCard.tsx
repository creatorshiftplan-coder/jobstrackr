import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Building2, Users } from "lucide-react";

interface RecommendedJobCardProps {
  job: Job;
  colorVariant?: "pink" | "blue" | "green" | "orange";
}

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const formatVacancy = (vacancies: number | null, vacanciesDisplay: string | null) => {
    if (vacanciesDisplay) return vacanciesDisplay;
    if (vacancies) return `${vacancies} Vacancies`;
    return "TBD";
  };

  return (
    <Link to={`/job/${job.id}`} className="block group">
      <div className="p-4 rounded-2xl bg-card border border-border/40 shadow-soft h-[140px] sm:h-[160px] flex flex-col transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-primary/20">
        {/* Icon + Job Title Row */}
        <div className="flex items-start gap-3 mb-1.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-2 flex-1 group-hover:text-primary transition-colors">
            {job.title}
          </h3>
        </div>

        {/* Agency/Department Name */}
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-auto pl-12">
          {job.department}
        </p>

        {/* Vacancy Count */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-primary mt-auto bg-primary/5 rounded-lg px-2.5 py-1.5 w-fit">
          <Users className="h-3.5 w-3.5" />
          {formatVacancy(job.vacancies, job.vacancies_display)}
        </div>
      </div>
    </Link>
  );
}
