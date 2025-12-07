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
      <div className="p-3 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-white/50 h-[140px] sm:h-[160px] flex flex-col transition-all hover:bg-white/90 hover:scale-[1.02]">
        {/* Icon */}
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-[#0A4174] flex items-center justify-center mb-2 sm:mb-3">
          <Building2 className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
        </div>

        {/* Job Title - Full name, no department */}
        <h3 className="font-bold text-[#0A4174] text-xs sm:text-sm mb-auto line-clamp-2">
          {job.title}
        </h3>

        {/* Vacancy Count */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-[#0A4174] mt-auto">
          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
          {formatVacancy(job.vacancies, job.vacancies_display)}
        </div>
      </div>
    </Link>
  );
}
