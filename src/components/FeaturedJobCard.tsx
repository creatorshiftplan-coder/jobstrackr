import { memo, useMemo } from "react";
import { MapPin, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { SaveJobButton } from "@/components/SaveJobButton";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { OrganizationLogo } from "@/components/OrganizationLogo";

import { format, differenceInDays } from "date-fns";

interface FeaturedJobCardProps {
  job: Job;
}

// Check if last_date_display contains TBD-like values
const isTBDDateDisplay = (displayValue: string | null): boolean => {
  if (!displayValue) return false;
  const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'not available'];
  const lowerValue = displayValue.toLowerCase().trim();
  return tbdPatterns.some(pattern => lowerValue.includes(pattern));
};

export const FeaturedJobCard = memo(function FeaturedJobCard({ job }: FeaturedJobCardProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);

  const { daysLeft, isUrgent, isExpired, isTBDDate, lastDateText } = useMemo(() => {
    const dl = differenceInDays(new Date(job.last_date), new Date());
    const urgent = dl <= 7 && dl >= 0;
    const expired = dl < 0;
    const tbd = isTBDDateDisplay(job.last_date_display);
    let text: string;
    if (tbd) text = 'Date TBD';
    else if (expired) text = 'Expired';
    else if (dl === 0) text = 'Last day!';
    else if (dl <= 7) text = `${dl} days left`;
    else text = format(new Date(job.last_date), "dd MMM yyyy");
    return { daysLeft: dl, isUrgent: urgent, isExpired: expired, isTBDDate: tbd, lastDateText: text };
  }, [job.last_date, job.last_date_display]);

  return (
    <Link to={`/jobs/${job.slug || job.id}`} className="block">
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
          <div className="flex items-start gap-2 mb-0.5 sm:mb-1 pr-8">
            <OrganizationLogo
              logoUrl={logoUrl}
              name={job.department}
              containerClassName="h-7 w-7 rounded-md bg-primary-foreground/15 flex items-center justify-center flex-shrink-0 overflow-hidden"
              imageClassName="h-5 w-5 object-contain"
              iconClassName="h-4 w-4 text-primary-foreground"
            />
            <p className="text-sm sm:text-lg font-bold truncate">{job.title}</p>
          </div>
          <p className="text-xs sm:text-sm text-primary-foreground/80 mb-3 sm:mb-4 truncate">{job.department}</p>

          {/* Tags */}
          <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-nowrap overflow-hidden">
            {job.vacancies && (
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 rounded-full text-[10px] sm:text-xs flex-shrink-0">
                {job.vacancies} Vacancy
              </Badge>
            )}
            <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 rounded-full text-[10px] sm:text-xs flex-shrink-0">
              Govt
            </Badge>
          </div>

          {/* Last Date and Location */}
          <div className="flex items-center justify-between mt-auto">
            <div className={`flex items-center gap-1 text-xs sm:text-sm font-semibold ${isUrgent && !isExpired ? 'text-yellow-200' : isExpired ? 'text-primary-foreground/60' : 'text-primary-foreground'}`}>
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate max-w-[100px] sm:max-w-[120px]">
                {lastDateText}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-primary-foreground/80">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-[80px]">{job.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});
