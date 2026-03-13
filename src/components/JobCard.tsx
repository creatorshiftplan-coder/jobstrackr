import { Job } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, IndianRupee, Users, Building2, CheckCircle, Tag, GraduationCap } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { SaveJobButton } from "./SaveJobButton";
import { useConductingBodyLogos } from "@/hooks/useConductingBodyLogos";
import { formatAgeLimit, isTBDDateDisplay, inferCategory, shortenQualification } from "@/lib/jobUtils";

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const { getLogoByName } = useConductingBodyLogos();
  const logoUrl = getLogoByName(job.department);

  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isUrgent = daysLeft <= 7 && daysLeft >= 0;
  const isExpired = daysLeft < 0;
  const isTBDDate = isTBDDateDisplay(job.last_date_display);

  const category = inferCategory(job.department, job.title);
  const shortQualification = shortenQualification(job.qualification);

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not disclosed";
    if (min && max) return `₹${(min / 1000).toFixed(0)}k - ₹${(max / 1000).toFixed(0)}k`;
    if (min) return `₹${(min / 1000).toFixed(0)}k+`;
    return `Up to ₹${(max! / 1000).toFixed(0)}k`;
  };

  return (
    <Link to={`/jobs/${job.slug || job.id}`}>
      <Card className="group shadow-md hover:shadow-xl transition-all duration-300 border border-border/50 rounded-2xl overflow-hidden hover:-translate-y-0.5 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-card/90 backdrop-blur-sm">
        <CardContent className="p-4">
          {/* Header Row: Logo + Title + Save Button */}
          <div className="flex gap-3">
            {/* Logo - vertically centered with title */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-7 h-7 sm:w-9 sm:h-9 object-contain" />
              ) : (
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              )}
            </div>

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
                    {daysLeft} days left
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
              <span className="truncate">{job.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="h-3.5 w-3.5 text-success" />
              </div>
              <span className="truncate">{formatSalary(job.salary_min, job.salary_max)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-3.5 w-3.5 text-warning" />
              </div>
              <span className="truncate text-red-500 dark:text-red-400 font-medium">
                <span className="hidden sm:inline">Last date: </span>
                {job.last_date_display || format(new Date(job.last_date), "dd MMM yyyy")}
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

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-medium">
              Age: {formatAgeLimit(job.age_min, job.age_max, "yrs")}
            </span>
            <span className="text-xs font-semibold text-primary">
              {job.application_fee ? `Fee: ₹${job.application_fee}` : "Free Apply"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
