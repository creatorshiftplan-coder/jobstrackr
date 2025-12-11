import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Building2, Users, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface RecommendedJobCardProps {
  job: Job;
  colorVariant?: "pink" | "blue" | "green" | "orange";
}

// Check if last_date_display contains TBD-like values
const isTBDDateDisplay = (displayValue: string | null): boolean => {
  if (!displayValue) return false;
  const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'not available'];
  const lowerValue = displayValue.toLowerCase().trim();
  return tbdPatterns.some(pattern => lowerValue.includes(pattern));
};

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isUrgent = daysLeft <= 7 && daysLeft >= 0;
  const isExpired = daysLeft < 0;
  const isTBDDate = isTBDDateDisplay(job.last_date_display);

  const formatVacancy = (vacancies: number | null, vacanciesDisplay: string | null) => {
    if (vacanciesDisplay) return vacanciesDisplay;
    if (vacancies) return `${vacancies} Vacancies`;
    return "TBD";
  };

  const formatLastDate = () => {
    if (isTBDDate) return 'TBD';
    if (isExpired) return 'Expired';
    if (daysLeft === 0) return 'Last day!';
    if (daysLeft <= 7) return `${daysLeft}d left`;
    return format(new Date(job.last_date), "dd MMM");
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

        {/* Last Date and Vacancy Count */}
        <div className="flex items-center justify-between mt-auto">
          <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium ${isUrgent && !isExpired ? 'text-destructive' : isExpired ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{formatLastDate()}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-primary">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            {formatVacancy(job.vacancies, job.vacancies_display)}
          </div>
        </div>
      </div>
    </Link>
  );
}
