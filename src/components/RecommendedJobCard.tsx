import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Building2, Users, Calendar, GraduationCap, Tag } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { SaveJobButton } from "@/components/SaveJobButton";
import { Badge } from "@/components/ui/badge";
import { isTBDDateDisplay, inferCategory, shortenQualification } from "@/lib/jobUtils";

interface RecommendedJobCardProps {
  job: Job;
}

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);

  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isExpired = daysLeft < 0;
  const isTBDDate = isTBDDateDisplay(job.last_date_display);

  const category = inferCategory(job.department, job.title);
  const shortQualification = shortenQualification(job.qualification);

  const formatVacancy = (vacancies: number | null, vacanciesDisplay: string | null) => {
    if (vacanciesDisplay) return vacanciesDisplay;
    if (vacancies) return `${vacancies} Vacancies`;
    return "TBD";
  };

  const formatLastDate = () => {
    if (isTBDDate) return 'TBD';
    if (isExpired) return 'Expired';
    if (daysLeft === 0) return 'Last day!';
    // Show full date format
    return format(new Date(job.last_date), "dd MMM yyyy");
  };

  return (
    <Link to={`/jobs/${job.slug || job.id}`} className="block w-full">
      <div className="relative p-4 sm:p-5 rounded-2xl bg-white dark:bg-card backdrop-blur-md shadow-lg border border-border/50 min-h-[180px] sm:min-h-[200px] flex flex-col transition-all hover:bg-gray-50 dark:hover:bg-card/90 hover:scale-[1.01] hover:shadow-xl">
        {/* Save Button - Top Right */}
        <div className="absolute top-2 right-2">
          <SaveJobButton jobId={job.id} />
        </div>

        {/* Icon + Job Title Row */}
        <div className="flex items-start gap-3 mb-2 pr-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            ) : (
              <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight line-clamp-2">
              {job.title}
            </h3>
            {/* Agency/Department Name */}
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">
              {job.department}
            </p>
          </div>
        </div>

        {/* Category & Qualification Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {category}
          </Badge>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {shortQualification}
          </Badge>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last Date and Vacancy Count */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-destructive">
            <Calendar className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span>Last date: {formatLastDate()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            {formatVacancy(job.vacancies, job.vacancies_display)}
          </div>
        </div>
      </div>
    </Link>
  );
}


