import { Job } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, IndianRupee, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { SaveJobButton } from "./SaveJobButton";

interface JobCardProps {
  job: Job;
}

// Check if last_date_display contains TBD-like values
const isTBDDateDisplay = (displayValue: string | null): boolean => {
  if (!displayValue) return false;
  const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'not available'];
  const lowerValue = displayValue.toLowerCase().trim();
  return tbdPatterns.some(pattern => lowerValue.includes(pattern));
};

export function JobCard({ job }: JobCardProps) {
  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isUrgent = daysLeft <= 7 && daysLeft >= 0;
  const isExpired = daysLeft < 0;
  const isTBDDate = isTBDDateDisplay(job.last_date_display);

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not disclosed";
    if (min && max) return `₹${(min / 1000).toFixed(0)}k - ₹${(max / 1000).toFixed(0)}k`;
    if (min) return `₹${(min / 1000).toFixed(0)}k+`;
    return `Up to ₹${(max! / 1000).toFixed(0)}k`;
  };

  return (
    <Link to={`/job/${job.id}`}>
      <Card className="group shadow-card hover:shadow-card-hover transition-all duration-300 border-0 overflow-hidden animate-slide-up">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {job.is_featured && (
                  <Badge className="bg-warning text-warning-foreground text-xs">
                    Featured
                  </Badge>
                )}
                {isTBDDate && (
                  <Badge variant="outline" className="text-xs bg-muted">
                    Date TBD
                  </Badge>
                )}
                {!isTBDDate && isUrgent && !isExpired && (
                  <Badge variant="destructive" className="text-xs">
                    {daysLeft} days left
                  </Badge>
                )}
                {!isTBDDate && isExpired && (
                  <Badge variant="secondary" className="text-xs">
                    Expired
                  </Badge>
                )}
              </div>
              <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{job.department}</p>
            </div>
            <SaveJobButton jobId={job.id} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="truncate">{job.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <IndianRupee className="h-4 w-4 text-success" />
              <span className="truncate">{formatSalary(job.salary_min, job.salary_max)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-warning" />
              <span className="truncate">
                {job.last_date_display || format(new Date(job.last_date), "dd MMM yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-info" />
              <span className="truncate">
                {job.vacancies_display || (job.vacancies ? `${job.vacancies} vacancies` : "TBD")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Age: {job.age_min || 18} - {job.age_max || 65} yrs
            </span>
            <span className="text-xs font-medium text-primary">
              {job.application_fee ? `Fee: ₹${job.application_fee}` : "Free Apply"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
