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
    <Link to={`/job/${job.id}`} className="block">
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-card backdrop-blur-md shadow-lg border border-border/50 h-[140px] sm:h-[160px] flex flex-col transition-all hover:bg-gray-50 dark:hover:bg-card/90 hover:scale-[1.02]">
        {/* Icon + Job Title Row */}
        <div className="flex items-start gap-2 mb-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <h3 className="font-bold text-foreground text-xs sm:text-sm line-clamp-2 flex-1">
            {job.title}
          </h3>
        </div>

        {/* Agency/Department Name */}
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-auto">
          {job.department}
        </p>

        {/* Vacancy Count */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-primary mt-auto">
          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
          {formatVacancy(job.vacancies, job.vacancies_display)}
        </div>
      </div>
    </Link>
  );
}
