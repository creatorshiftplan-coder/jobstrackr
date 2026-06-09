import { memo, useMemo } from "react";
import { Job } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, IndianRupee, Users, Building2, CheckCircle, Tag, GraduationCap } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { SaveJobButton } from "./SaveJobButton";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { isTBDDateDisplay, inferCategory, parseJobDeadline, shortenQualification } from "@/lib/jobUtils";
import { getBestJobLocation } from "@/lib/jobMatcher";
import { OrganizationLogo } from "@/components/OrganizationLogo";

interface JobCardProps {
  job: Job;
}

const formatAgeValue = (value: number) => {
  return Number.isInteger(value) ? `${value}` : `${value}`.replace(/\.0+$/, "");
};

const extractAgeRangeFromText = (text: string): { min: number | null; max: number | null } => {
  const normalized = text.toLowerCase();

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return {
      min: Number.parseFloat(rangeMatch[1]),
      max: Number.parseFloat(rangeMatch[2]),
    };
  }

  const upperMatch = normalized.match(/(?:upto|up to|maximum|max|not more than)\s*(\d+(?:\.\d+)?)/i);
  if (upperMatch) {
    return { min: null, max: Number.parseFloat(upperMatch[1]) };
  }

  const lowerMatch = normalized.match(/(?:from|min(?:imum)?|at least|above)\s*(\d+(?:\.\d+)?)/i);
  if (lowerMatch) {
    return { min: Number.parseFloat(lowerMatch[1]), max: null };
  }

  return { min: null, max: null };
};

const formatSalaryValue = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
};

export const JobCard = memo(function JobCard({ job }: JobCardProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);

  const computed = useMemo(() => {
    const deadlineDate = parseJobDeadline(job.last_date);
    const daysLeft = deadlineDate ? differenceInDays(deadlineDate, new Date()) : Number.POSITIVE_INFINITY;
    const isUrgent = daysLeft <= 7 && daysLeft >= 0;
    const isExpired = daysLeft < 0;
    const isTBDDate = isTBDDateDisplay(job.last_date_display);
    const category = inferCategory(job.department, job.title);
    const shortQualification = shortenQualification(job.qualification);
    const meta = job.job_metadata;

    const rawAgeMin = typeof job.age_min === "number" ? job.age_min : null;
    const rawAgeMax = typeof job.age_max === "number" ? job.age_max : null;
    const textAge = meta?.age_limit_text ? extractAgeRangeFromText(meta.age_limit_text) : { min: null, max: null };
    const hasSuspiciousLowAge = [rawAgeMin, rawAgeMax].some((age) => typeof age === "number" && age > 0 && age < 14);
    const effectiveAgeMin = hasSuspiciousLowAge && textAge.min !== null ? textAge.min : rawAgeMin;
    const effectiveAgeMax = hasSuspiciousLowAge && textAge.max !== null ? textAge.max : rawAgeMax;
    const showLowAgeFlag = [effectiveAgeMin, effectiveAgeMax].some((age) => typeof age === "number" && age > 0 && age < 14);

    // Salary display
    let salaryDisplay: string;
    if (!job.salary_min && !job.salary_max) {
      salaryDisplay = meta?.salary_text || "Not disclosed";
    } else if (meta?.salary_text && ((job.salary_min && job.salary_min < 100) || (job.salary_max && job.salary_max < 100))) {
      salaryDisplay = meta.salary_text;
    } else if (job.salary_min && job.salary_max) {
      salaryDisplay = job.salary_min === job.salary_max ? formatSalaryValue(job.salary_min) : `${formatSalaryValue(job.salary_min)} - ${formatSalaryValue(job.salary_max)}`;
    } else if (job.salary_min) {
      salaryDisplay = `${formatSalaryValue(job.salary_min)}+`;
    } else {
      salaryDisplay = `Up to ${formatSalaryValue(job.salary_max!)}`;
    }

    // Age display
    let ageDisplay: string;
    if (effectiveAgeMin !== null && effectiveAgeMax !== null) {
      if (effectiveAgeMin === effectiveAgeMax) {
        const text = meta?.age_limit_text?.toLowerCase() || '';
        if (text.includes('max') || text.includes('upper') || text.includes('upto') || text.includes('up to')) {
          ageDisplay = `Upto ${formatAgeValue(effectiveAgeMax)} yrs`;
        } else if (text.includes('min') || text.includes('lower') || text.includes('from') || text.includes('min.')) {
          ageDisplay = `From ${formatAgeValue(effectiveAgeMin)} yrs`;
        } else {
          ageDisplay = `${formatAgeValue(effectiveAgeMin)} yrs`;
        }
      } else {
        ageDisplay = `${formatAgeValue(effectiveAgeMin)} - ${formatAgeValue(effectiveAgeMax)} yrs`;
      }
    } else if (meta?.age_limit_text) {
      ageDisplay = meta.age_limit_text.length > 25 ? meta.age_limit_text.substring(0, 25) + '...' : meta.age_limit_text;
    } else if (effectiveAgeMin !== null) {
      ageDisplay = `From ${formatAgeValue(effectiveAgeMin)} yrs`;
    } else if (effectiveAgeMax !== null) {
      ageDisplay = `Upto ${formatAgeValue(effectiveAgeMax)} yrs`;
    } else {
      ageDisplay = "Not Specified";
    }

    // Date display
    const dateDisplay = job.last_date_display || (deadlineDate ? format(deadlineDate, "dd MMM yyyy") : "TBD");
    const location = getBestJobLocation(job);

    return { deadlineDate, daysLeft, isUrgent, isExpired, isTBDDate, category, shortQualification, meta, showLowAgeFlag, salaryDisplay, ageDisplay, dateDisplay, location };
  }, [job]);

  const { deadlineDate, daysLeft, isUrgent, isExpired, isTBDDate, category, shortQualification, meta, showLowAgeFlag, salaryDisplay, ageDisplay, dateDisplay, location } = computed;

  const getAgeDisplay = () => {
    return ageDisplay;
  };

  return (
    <Link to={`/jobs/${job.slug || job.id}`}>
      <Card className="group shadow-md hover:shadow-xl transition-all duration-300 border border-border/50 rounded-2xl overflow-hidden hover:-translate-y-0.5 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-card/90 backdrop-blur-sm">
        <CardContent className="p-4">
          {/* Header Row: Logo + Title + Save Button */}
          <div className="flex gap-3">
            {/* Logo - vertically centered with title */}
            <OrganizationLogo
              logoUrl={logoUrl}
              name={job.department}
              containerClassName="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5"
              imageClassName="w-7 h-7 sm:w-9 sm:h-9 object-contain"
              iconClassName="h-5 w-5 sm:h-6 sm:w-6 text-primary"
            />

            <div className="flex-1 min-w-0">
              {/* Job Title Row with inline badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                    {job.title}
                  </h3>
                </div>
                <SaveJobButton jobId={job.id} />
              </div>

              {/* Department */}
              <p className="text-sm text-muted-foreground mt-1 font-medium">{job.department}</p>

              {/* All Tags in one row */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {/* Days left / Expired / Date TBD badges first for urgency visibility */}
                {!isTBDDate && isUrgent && !isExpired && (
                  <Badge variant="destructive" className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full">
                    {daysLeft === 0 ? "Last Day" : `${daysLeft} days left`}
                  </Badge>
                )}
                {!isTBDDate && isExpired && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full">
                    Expired
                  </Badge>
                )}
                {isTBDDate && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs bg-muted/50 rounded-full px-2 py-0.5">
                    Date TBD
                  </Badge>
                )}
                {/* Category Tag */}
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1 px-2 py-0.5">
                  <Tag className="h-3 w-3" />
                  {category}
                </Badge>
                {/* Qualification Tag */}
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1 px-2 py-0.5">
                  <GraduationCap className="h-3 w-3" />
                  {shortQualification}
                </Badge>
                {/* Other Status Badges */}
                {job.is_featured && (
                  <Badge className="bg-warning/90 text-warning-foreground text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full">
                    Featured
                  </Badge>
                )}
                {job.admin_refreshed_at && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-500/5 dark:bg-green-500/10 text-green-600/70 dark:text-green-400/60 border-green-200/50 dark:border-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="truncate">{location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="truncate">{salaryDisplay}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="truncate text-red-500 dark:text-red-400 font-medium">
                <span className="hidden sm:inline">Last date: </span>
                {dateDisplay}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-3.5 w-3.5 text-info" />
              </div>
              <span className="truncate">
                {job.vacancies_display || (job.vacancies ? `${job.vacancies} vacancies` : "TBD")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-medium" title={meta?.age_limit_text || undefined}>
              Age: {ageDisplay}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {showLowAgeFlag && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full">
                  Low age - verify
                </Badge>
              )}
              <span className="text-xs font-semibold text-primary">
                {job.application_fee ? `Fee: ₹${job.application_fee}` : "Free Apply"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
