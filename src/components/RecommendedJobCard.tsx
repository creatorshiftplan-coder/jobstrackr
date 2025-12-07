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
      <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-white/50 transition-all hover:bg-white/90 hover:scale-[1.02]">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#0A4174] flex items-center justify-center mb-3">
          <Building2 className="h-6 w-6 text-white" />
        </div>

        {/* Job Title - Full name, no department */}
        <h3 className="font-bold text-[#0A4174] text-base mb-3 line-clamp-2">
          {job.title}
        </h3>

        {/* Vacancy Count */}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0A4174]">
          <Users className="h-4 w-4" />
          {formatVacancy(job.vacancies, job.vacancies_display)}
        </div>
      </div>
    </Link>
  );
}
