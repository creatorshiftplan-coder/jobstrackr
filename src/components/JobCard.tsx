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
      <Card className="group border-border/40 hover:border-primary/20 hover:shadow-soft-lg hover:-translate-y-0.5">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {job.is_featured && (
                  <Badge className="bg-gradient-to-r from-warning to-warning/80 text-warning-foreground text-xs font-medium px-2.5 py-0.5 rounded-lg border-0">
                    Featured
                  </Badge>
                )}
                {isTBDDate && (
                  <Badge variant="outline" className="text-xs bg-muted/50 rounded-lg px-2.5 py-0.5 border-border/50">
                    Date TBD
                  </Badge>
                )}
                {!isTBDDate && isUrgent && !isExpired && (
                  <Badge variant="destructive" className="text-xs font-medium px-2.5 py-0.5 rounded-lg">
                    {daysLeft} days left
                  </Badge>
                )}
                {!isTBDDate && isExpired && (
                  <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-lg">
                    Expired
                  </Badge>
                )}
              </div>
              <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{job.department}</p>
            </div>
            <SaveJobButton jobId={job.id} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <span className="truncate">{job.location}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-success/15 to-success/5 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="h-4 w-4 text-success" />
              </div>
              <span className="truncate">{formatSalary(job.salary_min, job.salary_max)}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-warning/15 to-warning/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-warning" />
              </div>
              <span className="truncate">
                {job.last_date_display || format(new Date(job.last_date), "dd MMM yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-info/15 to-info/5 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-info" />
              </div>
              <span className="truncate">
                {job.vacancies_display || (job.vacancies ? `${job.vacancies} vacancies` : "TBD")}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground font-medium">
              Age: {job.age_min || 18} - {job.age_max || 65} yrs
            </span>
            <span className="text-xs font-semibold text-primary bg-primary/5 px-2.5 py-1 rounded-lg">
              {job.application_fee ? `Fee: ₹${job.application_fee}` : "Free Apply"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
