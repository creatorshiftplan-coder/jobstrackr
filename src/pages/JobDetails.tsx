import { getBestJobLocation } from "@/lib/jobMatcher";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobBySlug } from "@/hooks/useJobs";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  ExternalLink,
  Loader2,
  CheckCircle,
  Bell,
  BellRing,
} from "lucide-react";
import { SaveJobButton } from "@/components/SaveJobButton";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuthRequired } from "@/components/AuthRequiredDialog";
import { BottomNav } from "@/components/BottomNav";
import { formatAgeLimit } from "@/lib/jobUtils";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useSimilarJobs } from "@/hooks/useSimilarJobs";

// Check if last_date_display contains TBD-like values
const isTBDDateDisplay = (displayValue: string | null): boolean => {
  if (!displayValue) return false;
  const tbdPatterns = ['tbd', 'to be announced', 'walk in', 'walk-in', 'walkin', 'n/a', 'not available'];
  const lowerValue = displayValue.toLowerCase().trim();
  return tbdPatterns.some(pattern => lowerValue.includes(pattern));
};

export default function JobDetails() {
  const { slug } = useParams<{ slug: string }>();
  const handleBack = useSmartBack("/search");
  const { data: job, isLoading, error } = useJobBySlug(slug || "");
  const { user } = useAuth();
  const { userExams, addExamAttempt } = useExams();
  const [isTracking, setIsTracking] = useState(false);
  const { trackJobViewed, trackExamTracked } = useAnalytics();
  const { showAuthRequired } = useAuthRequired();

  // Track job view when page loads
  useEffect(() => {
    if (job) {
      trackJobViewed(job.id, job.title);
    }
  }, [job, trackJobViewed]);

  // Update document title with job name
  useEffect(() => {
    if (job) {
      document.title = `${job.title} | JobsTrackr`;
    }
    // Restore default title on unmount
    return () => {
      document.title = 'JobsTrackr - Your Government Job Tracker';
    };
  }, [job]);

  // Check if this job is already tracked
  const isAlreadyTracked = userExams.some(
    (attempt) => attempt.exams?.name?.toLowerCase() === job?.title?.toLowerCase()
  );

  const handleTrackExam = async () => {
    if (!user) {
      showAuthRequired("Login to track exams and get status updates");
      return;
    }

    if (!job) return;

    setIsTracking(true);
    try {
      // Check if exam already exists by title
      const { data: existingExam } = await supabase
        .from("exams")
        .select("id")
        .ilike("name", job.title)
        .maybeSingle();

      let examId = existingExam?.id;

      // If exam doesn't exist, create it
      if (!examId) {
        const { data: newExam, error: createError } = await supabase
          .from("exams")
          .insert({
            name: job.title,
            conducting_body: job.department,
            category: "Government",
            is_active: true,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        examId = newExam.id;
      }

      // Add exam attempt
      await addExamAttempt.mutateAsync({
        examId: examId,
        year: new Date().getFullYear(),
      });

      toast.success("Exam added to your tracker!");
      trackExamTracked(examId, job.title);
    } catch (error: any) {
      toast.error("Failed to track exam: " + error.message);
    } finally {
      setIsTracking(false);
    }
  };

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
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  const daysLeft = differenceInDays(new Date(job.last_date), new Date());
  const isExpired = daysLeft < 0;
  const isTBDDate = isTBDDateDisplay(job.last_date_display);

  const meta = job.job_metadata as any;
  const officialWebsite = job.official_website?.trim() || meta?.official_website?.trim() || null;
  const applyLink = job.apply_link?.trim() || null;

  // Format raw JSON keys into proper column headers: "post_name" → "Post Name"
  const formatKey = (key: string) =>
    key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Filter out header-echo rows and total rows from vacancy breakdown;
  // also extract the numeric total from the "Total" row.
  let breakdownTotal = "";
  const vacancyRows: any[] = [];
  if (Array.isArray(meta?.vacancies_detail)) {
    for (const row of meta.vacancies_detail) {
      const vals = Object.values(row).map((v: any) => String(v).toLowerCase().trim());
      // Skip rows whose values echo column headers
      const isHeaderEcho = vals.every((v: string) =>
        ['post name', 'total posts', 'post_name', 'total_posts', 'name of post',
         'name of the post', 'no of posts', 'no. of posts', 'number of posts',
         'vacancy', 'vacancies', 'category', 'posts'].includes(v)
      );
      if (isHeaderEcho) continue;

      // Extract total from the Total row (but keep the row visible in the table)
      const isTotalRow = vals.some((v: string) => v === 'total' || v === 'grand total');
      if (isTotalRow) {
        const num = Object.values(row).find((v: any) => {
          const s = String(v).trim().replace(/,/g, '');
          return s !== '' && !isNaN(Number(s));
        });
        if (num) breakdownTotal = String(num).trim().replace(/,/g, '');
      }

      vacancyRows.push(row);
    }
  }

  let btnHref: string | null = null;
  let btnText = "";
  let btnDisabled = false;
  let btnVariant: "primary" | "secondary" = "primary";

  if (isExpired && !isTBDDate) {
    if (officialWebsite) {
      btnHref = officialWebsite;
      btnText = "Official Website";
      btnVariant = "secondary";
    } else {
      btnText = "Application Closed";
      btnDisabled = true;
    }
  } else {
    // Active job (or TBD so considered active)
    if (applyLink) {
      btnHref = applyLink;
      btnText = "Apply Now";
      btnVariant = "primary";
    } else if (officialWebsite) {
      btnHref = officialWebsite;
      btnText = "Official Website";
      btnVariant = "primary";
    } else {
      btnText = "Apply Link Not Available";
      btnDisabled = true;
    }
  }

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) {
      // Fallback: use salary_text from metadata if available
      if (meta?.salary_text) return meta.salary_text;
      return "Not disclosed";
    }
    // If values look suspiciously low (e.g. 3 instead of 3,00,000), prefer salary_text
    if (meta?.salary_text && ((min && min < 100) || (max && max < 100))) {
      return meta.salary_text;
    }
    if (min && max) {
      if (min === max) return `₹${min.toLocaleString('en-IN')}`;
      return `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
    }
    if (min) return `₹${min.toLocaleString('en-IN')}+`;
    return `Up to ₹${max!.toLocaleString('en-IN')}`;
  };

  const getAgeDisplay = () => {
    if (job.age_min && job.age_max) {
      if (job.age_min === job.age_max) {
        const text = job.job_metadata?.age_limit_text?.toLowerCase() || '';
        if (text.includes('max') || text.includes('upper') || text.includes('upto') || text.includes('up to')) {
          return `Upto ${job.age_max} years`;
        }
        if (text.includes('min') || text.includes('lower') || text.includes('from') || text.includes('min.')) {
          return `From ${job.age_min} years`;
        }
        return `${job.age_min} years`;
      }
      return `${job.age_min} - ${job.age_max} years`;
    }
    if (job.age_min) return `From ${job.age_min} years`;
    if (job.age_max) return `Upto ${job.age_max} years`;
    return 'Not Available';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 font-semibold text-sm text-foreground truncate">{job.title}</h1>
          <SaveJobButton jobId={job.id} />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Title Section */}
        <div className="animate-slide-up">
          <div className="flex gap-2 mb-2">
            {job.is_featured && (
              <Badge className="bg-warning text-warning-foreground">Featured</Badge>
            )}
            {isTBDDate && (
              <Badge variant="outline" className="bg-muted">Date TBD</Badge>
            )}
            {!isTBDDate && !isExpired && daysLeft <= 7 && (
              <Badge variant="destructive">{daysLeft} days left</Badge>
            )}
            {!isTBDDate && isExpired && <Badge variant="secondary">Expired</Badge>}
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground mb-1">{job.title}</h1>
          <p className="text-muted-foreground mb-3">{job.department}</p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTrackExam}
              disabled={isTracking || isAlreadyTracked}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                isAlreadyTracked
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 hover:border-primary/50 active:scale-95'
              }`}
            >
              {isTracking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isAlreadyTracked ? (
                <BellRing className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              {isTracking ? 'Saving...' : isAlreadyTracked ? 'Tracking' : 'Track Exam'}
            </button>

            <button
              onClick={async () => {
                const shareUrl = `${window.location.origin}/jobs/${job.slug || job.id}`;
                const shareData = {
                  title: job.title,
                  text: `Check out this job: ${job.title} at ${job.department}`,
                  url: shareUrl,
                };

                if (navigator.share && navigator.canShare?.(shareData)) {
                  try {
                    await navigator.share(shareData);
                  } catch (err) {
                    if ((err as Error).name !== 'AbortError') {
                      toast.error("Failed to share");
                    }
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied to clipboard!");
                  } catch (err) {
                    const textArea = document.createElement("textarea");
                    textArea.value = shareUrl;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                      document.execCommand("copy");
                      toast.success("Link copied to clipboard!");
                    } catch {
                      toast.error("Failed to copy link");
                    }
                    document.body.removeChild(textArea);
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border/50 transition-all duration-200 active:scale-95"
              aria-label="Share job"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-3 flex items-center gap-2 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium text-sm truncate">{getBestJobLocation(job)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-3 flex items-center gap-2 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Salary</p>
                <p className="font-medium text-sm truncate">{formatSalary(job.salary_min, job.salary_max)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-3 flex items-center gap-2 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Last Date</p>
                <p className="font-medium text-sm truncate">
                  {job.last_date_display || format(new Date(job.last_date), "dd MMM yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-3 flex items-center gap-2 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Vacancies</p>
                <p className="font-medium text-sm truncate">
                  {(() => {
                    // Prioritize breakdownTotal from vacancy table over unhelpful display values
                    if (breakdownTotal) return `${breakdownTotal} Posts`;
                    const display = job.vacancies_display?.trim().toLowerCase();
                    if (display && display !== 'not found' && display !== 'tbd' && display !== 'n/a') {
                      return job.vacancies_display;
                    }
                    if (job.vacancies) return `${job.vacancies} Posts`;
                    return "TBD";
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Section */}
        <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.2s" }}>
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
                <p className="text-sm font-medium">
                  {getAgeDisplay()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Application Fee</p>
                <p className="text-sm font-medium text-primary">
                  {(() => {
                    if (job.application_fee) return `₹${job.application_fee}`;
                    // Fallback: extract max fee from breakdown
                    if (Array.isArray(meta?.application_fees) && meta.application_fees.length > 0) {
                      const nums = meta.application_fees
                        .map((f: any) => {
                          // Strip Rs., ₹, /-, commas, spaces, and other non-numeric chars
                          const cleaned = String(f.fee)
                            .replace(/rs\.?/gi, '')
                            .replace(/[₹,\s/\-]+/g, '')
                            .trim();
                          return parseFloat(cleaned);
                        })
                        .filter((n: number) => !isNaN(n) && n > 0);
                      if (nums.length > 0) return `₹${Math.max(...nums)}`;
                    }
                    return "Free";
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About this Job - Description + Unique Info */}
        <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-display font-semibold text-foreground mb-2">About this Job</h3>

            {job.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.description}</p>
            )}

            {/* First Date of Application - not shown in other cards */}
            <div className="flex items-start gap-3 pt-3 border-t border-border">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">First Date of Application</p>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(job.created_at), "dd MMM yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eligibility */}
        {job.eligibility && (
          <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardContent className="p-4">
              <h3 className="font-display font-semibold text-foreground mb-2">Eligibility Criteria</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.eligibility}</p>
            </CardContent>
          </Card>
        )}

        {/* Rich Metadata Sections (from scraper v5) */}
        {job.job_metadata && (() => {
          const meta = job.job_metadata as any;
          return (
            <>
              {/* Salary Details */}
              {meta.salary_text && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.45s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-2">💰 Salary Details</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{meta.salary_text}</p>
                  </CardContent>
                </Card>
              )}

              {/* Age Limit Details */}
              {meta.age_limit_text && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.5s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-2">👤 Age Limit Details</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{meta.age_limit_text}</p>
                  </CardContent>
                </Card>
              )}

              {/* Vacancy Breakdown */}
              {vacancyRows.length > 0 && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.55s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Vacancy Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(vacancyRows[0]).map((key: any) => (
                              <TableHead key={key} className="text-xs whitespace-nowrap">{formatKey(key)}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vacancyRows.map((row: Record<string, string>, i: number) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val: any, j: number) => (
                                <TableCell key={j} className="text-xs py-2 whitespace-nowrap">{val}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Application Fees */}
              {meta.application_fees && Array.isArray(meta.application_fees) && meta.application_fees.length > 0 && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.6s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3">💰 Application Fees</h3>
                    <div className="space-y-2">
                      {meta.application_fees.map((fee: { category: string; fee: string }, i: number) => (
                        <div key={i} className="flex justify-between items-center bg-secondary/30 rounded-lg px-4 py-2.5">
                          <span className="text-sm text-muted-foreground">{fee.category}</span>
                          <span className="text-sm font-semibold text-primary">{fee.fee}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selection Process */}
              {meta.selection_process && Array.isArray(meta.selection_process) && meta.selection_process.length > 0 && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.65s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3">📋 Selection Process</h3>
                    <ol className="space-y-2 pl-1">
                      {meta.selection_process.map((step: string, i: number) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {/* Important Dates */}
              {meta.important_dates && Object.values(meta.important_dates).some((v: any) => v) && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Important Dates
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(meta.important_dates as Record<string, string | null>)
                        .filter(([, v]) => v)
                        .map(([key, val]) => (
                          <div key={key} className="flex justify-between items-center bg-secondary/30 rounded-lg px-4 py-2.5">
                            <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-sm font-medium">{val}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Overview */}
              {meta.overview && typeof meta.overview === 'object' && Object.keys(meta.overview).length > 0 && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.75s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3">ℹ️ Overview</h3>
                    <div className="space-y-2">
                      {Object.entries(meta.overview as Record<string, string>).map(([key, val]) => (
                        <div key={key} className="flex items-start gap-2 bg-secondary/30 rounded-lg px-4 py-2.5">
                          <span className="text-sm text-muted-foreground capitalize min-w-[120px] flex-shrink-0">{key.replace(/_/g, " ")}</span>
                          <span className="text-sm font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notification PDF & Links */}
              {meta.notification_pdf && (
                <Card className="border-0 shadow-md animate-slide-up" style={{ animationDelay: "0.8s" }}>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground mb-3">📄 Documents</h3>
                    <a href={meta.notification_pdf} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View Official Notification PDF
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}

        {/* Track This Exam Button - Below Eligibility */}
        {user && (
          <div className="mt-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <Button
              onClick={handleTrackExam}
              variant="outline"
              className="w-full h-11 shadow-md bg-white dark:bg-card"
              disabled={isTracking || isAlreadyTracked}
            >
              {isTracking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : isAlreadyTracked ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Already Tracking
                </>
              ) : (
                <>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Track This Exam
                </>
              )}
            </Button>
          </div>
        )}

        {/* Blank space below Track button */}
        <div className="h-24" />

        {/* Similar Jobs Section (vector similarity) */}
        <SimilarJobsSection jobId={job?.id} />
      </main>

      {/* Fixed Apply Now Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border z-40">
        <div className="flex justify-center gap-3">
          {!btnDisabled && btnHref ? (
            <a href={btnHref} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button 
                className={`w-full font-semibold h-12 text-xs sm:text-sm ${
                  btnVariant === "primary" 
                    ? "gradient-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {btnText} <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          ) : (
            <Button disabled className="flex-1 h-12">
              {btnText}
            </Button>
          )}
          <Button
            onClick={handleTrackExam}
            disabled={isTracking || isAlreadyTracked}
            className={`flex-shrink-0 h-12 px-3 sm:px-5 font-semibold text-xs sm:text-sm ${
              isAlreadyTracked
                ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/20'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
            }`}
            variant="outline"
          >
            {isTracking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isAlreadyTracked ? (
              <BellRing className="h-4 w-4 mr-2" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            {isTracking ? 'Saving...' : isAlreadyTracked ? 'Tracking' : 'Track'}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

/** Similar Jobs section using vector similarity */
function SimilarJobsSection({ jobId }: { jobId: string | undefined }) {
  const navigate = useNavigate();
  const { data: similarJobs, isLoading } = useSimilarJobs(jobId);

  if (isLoading || !similarJobs || similarJobs.length === 0) return null;

  return (
    <section className="px-5 mb-8">
      <h3 className="font-display font-semibold text-base text-foreground mb-3">Similar Jobs</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {similarJobs.map((sj) => (
          <button
            key={sj.id}
            onClick={() => navigate(sj.slug ? `/jobs/${sj.slug}` : `/jobs/${sj.id}`)}
            className="flex-shrink-0 w-[220px] rounded-xl border border-border bg-card p-3 text-left hover:shadow-md transition-shadow"
          >
            <p className="font-semibold text-sm text-foreground line-clamp-2 mb-1">{sj.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{sj.department}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="line-clamp-1">{sj.location}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
