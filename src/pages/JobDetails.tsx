import { useParams, Link } from "react-router-dom";
import { useJob } from "@/hooks/useJobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  IndianRupee,
  Users,
  GraduationCap,
  Briefcase,
  Share2,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, error } = useJob(id || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Job not found</p>
          <Link to="/">
            <Button>Go Back</Button>
          </Link>
        </div>
      </div>
    );
  }

  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isExpired = daysLeft < 0;

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not disclosed";
    if (min && max) return `₹${min.toLocaleString()} - ₹${max.toLocaleString()}`;
    if (min) return `₹${min.toLocaleString()}+`;
    return `Up to ₹${max!.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex gap-2">
            <button className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Share2 className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Bookmark className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Title Section */}
        <div className="animate-slide-up">
          <div className="flex gap-2 mb-2">
            {job.is_featured && (
              <Badge className="bg-warning text-warning-foreground">Featured</Badge>
            )}
            {!isExpired && daysLeft <= 7 && (
              <Badge variant="destructive">{daysLeft} days left</Badge>
            )}
            {isExpired && <Badge variant="secondary">Expired</Badge>}
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground mb-2">{job.title}</h1>
          <p className="text-muted-foreground">{job.department}</p>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Card className="border-0 shadow-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium text-sm">{job.location}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Salary</p>
                <p className="font-medium text-sm">{formatSalary(job.salary_min, job.salary_max)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Date</p>
                <p className="font-medium text-sm">{format(new Date(job.last_date), "dd MMM yyyy")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vacancies</p>
                <p className="font-medium text-sm">{job.vacancies || 1} Posts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Section */}
        <Card className="border-0 shadow-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <GraduationCap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Qualification</p>
                <p className="text-sm text-muted-foreground">{job.qualification}</p>
              </div>
            </div>
            {job.experience && (
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Experience</p>
                  <p className="text-sm text-muted-foreground">{job.experience}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Age Limit</p>
                <p className="text-sm font-medium">{job.age_min || 18} - {job.age_max || 65} years</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Application Fee</p>
                <p className="text-sm font-medium text-primary">
                  {job.application_fee ? `₹${job.application_fee}` : "Free"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {job.description && (
          <Card className="border-0 shadow-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <CardContent className="p-4">
              <h3 className="font-display font-semibold text-foreground mb-2">About this Job</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Eligibility */}
        {job.eligibility && (
          <Card className="border-0 shadow-card animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardContent className="p-4">
              <h3 className="font-display font-semibold text-foreground mb-2">Eligibility Criteria</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.eligibility}</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Fixed Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border">
        {job.apply_link && !isExpired ? (
          <a href={job.apply_link} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full gradient-primary text-primary-foreground font-semibold h-12">
              Apply Now <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button disabled className="w-full h-12">
            {isExpired ? "Application Closed" : "Apply Link Not Available"}
          </Button>
        )}
      </div>
    </div>
  );
}
