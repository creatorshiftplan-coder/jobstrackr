import { memo, useMemo, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Job } from "@/types/job";
import { Users, Calendar, GraduationCap, Tag, Briefcase } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { SaveJobButton } from "@/components/SaveJobButton";
import { Badge } from "@/components/ui/badge";
import { isTBDDateDisplay, inferCategory, parseJobDeadline, shortenQualification, getVacancyDisplay } from "@/lib/jobUtils";
import { OrganizationLogo } from "@/components/OrganizationLogo";
import { cn } from "@/lib/utils";

interface RecommendedJobCardProps {
  job: Job;
  matchBadge?: ReactNode;
  gapChips?: ReactNode;
  /** Informational experience requirement (does not affect eligibility) */
  experienceNote?: string | null;
}

export const RecommendedJobCard = memo(function RecommendedJobCard({
  job,
  matchBadge,
  gapChips,
  experienceNote
}: RecommendedJobCardProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);

  const { isExpired, isTBDDate, category, shortQualification, lastDateText, vacancyText } = useMemo(() => {
    const deadlineDate = parseJobDeadline(job.last_date);
    const daysLeft = deadlineDate ? differenceInDays(deadlineDate, new Date()) : null;
    const expired = daysLeft !== null && daysLeft < 0;
    const tbd = isTBDDateDisplay(job.last_date_display);
    const cat = inferCategory(job.department, job.title);
    const shortQual = shortenQualification(job.qualification);

    let dateText: string;
    if (tbd) dateText = 'TBD';
    else if (expired) dateText = 'Expired';
    else if (daysLeft === 0) dateText = 'Last day!';
    else if (!deadlineDate) dateText = 'TBD';
    else dateText = format(deadlineDate, "dd MMM yyyy");

    return {
      isExpired: expired,
      isTBDDate: tbd,
      category: cat,
      shortQualification: shortQual,
      lastDateText: dateText,
      vacancyText: getVacancyDisplay(job, "Vacancies"),
    };
  }, [job]);

  return (
    <Link to={`/jobs/${job.slug || job.id}`} className="block w-full">
      <div className={cn(
        "relative p-4 sm:p-5 rounded-2xl bg-white dark:bg-card backdrop-blur-md shadow-lg flex flex-col transition-all hover:bg-gray-50 dark:hover:bg-card/90 hover:scale-[1.01] hover:shadow-xl",
        gapChips 
          ? "border border-amber-500/50 dark:border-amber-500/30 shadow-amber-500/5 bg-amber-500/[0.01]" 
          : "border border-border/50"
      )}>
        {/* Save Button - Top Right */}
        <div className="absolute top-2 right-2">
          <SaveJobButton jobId={job.id} />
        </div>

        {/* Icon + Job Title Row */}
        <div className="flex items-start gap-3 mb-2 pr-8">
          <OrganizationLogo
            logoUrl={logoUrl}
            name={job.department}
            containerClassName="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
            imageClassName="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            iconClassName="h-6 w-6 sm:h-7 sm:w-7 text-primary"
          />
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
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {category}
          </Badge>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {shortQualification}
          </Badge>
          {matchBadge}
          {experienceNote && (
            <Badge variant="secondary" className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {experienceNote}
            </Badge>
          )}
        </div>

        {/* Gap Chips */}
        {gapChips && (
          <div className="flex flex-wrap gap-1.5 mb-3" onClick={(e) => e.stopPropagation()}>
            {gapChips}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last Date and Vacancy Count */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-destructive">
            <Calendar className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span>Last date: {lastDateText}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            {vacancyText}
          </div>
        </div>
      </div>
    </Link>
  );
});


