import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ExamAttempt, useExams } from "@/hooks/useExams";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  Newspaper,
  Trash2,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  Edit2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { ExamCredentialsModal } from "@/components/ExamCredentialsModal";

// Helper function to get phase-specific data from AI response
const getPhaseData = (statusData: any, phaseNumber: 1 | 2): any => {
  const phaseKey = phaseNumber === 1 ? "phase1" : "phase2";
  const phase = statusData?.phases?.[phaseKey];

  // Return phase data if available, otherwise return null for Phase 2
  // For Phase 1, fall back to root-level data for backward compatibility
  if (phase) return phase;

  if (phaseNumber === 1) {
    // Backward compatibility: use root-level data as Phase 1
    return {
      name: "Phase 1",
      status: statusData?.current_status,
      admit_card_available: statusData?.admit_card_available,
      admit_card_link: statusData?.admit_card_link,
      exam_date: null,
      exam_details: statusData?.exam_details,
      result_available: statusData?.result_available,
      result_link: statusData?.result_link,
      result_date: null,
    };
  }

  return null; // No Phase 2 data available
};

// Helper function to check if Phase 2 is applicable
const isPhase2Available = (statusData: any): boolean => {
  const phase2 = statusData?.phases?.phase2;
  return !!(phase2 && phase2.status !== "not_applicable" && phase2.name !== null);
};

// Helper function to extract exam date from AI response (phase-aware)
const getExamDateFromResponse = (statusData: any, phaseNumber: 1 | 2 = 1): string | null => {
  const phaseData = getPhaseData(statusData, phaseNumber);

  // Check phase-specific exam_date
  if (phaseData?.exam_date) return phaseData.exam_date;

  // For Phase 1, also check predicted_events
  if (phaseNumber === 1) {
    // Check direct exam_dates field (backward compat)
    if (statusData?.exam_dates) return statusData.exam_dates;

    // Check predicted_events array for exam_date event
    const examDateEvent = statusData?.predicted_events?.find(
      (e: any) => (e.event_type === "exam_date" || e.event_type === "exam") &&
        (e.phase === phaseNumber || !e.phase)
    );
    if (examDateEvent?.predicted_date) return examDateEvent.predicted_date;
  } else {
    // Phase 2 predicted events
    const examDateEvent = statusData?.predicted_events?.find(
      (e: any) => (e.event_type === "exam_date" || e.event_type === "exam") && e.phase === 2
    );
    if (examDateEvent?.predicted_date) return examDateEvent.predicted_date;
  }

  return null;
};

// Helper function to extract result info from AI response (phase-aware)
const getResultInfoFromResponse = (statusData: any, phaseNumber: 1 | 2 = 1): { date: string | null; isReleased: boolean } => {
  const phaseData = getPhaseData(statusData, phaseNumber);

  // Check phase-specific result data
  if (phaseData?.result_available === true || phaseData?.status === "result_declared") {
    return { date: phaseData?.result_date || "Released", isReleased: true };
  }

  if (phaseData?.result_date) {
    return { date: phaseData.result_date, isReleased: false };
  }

  // For Phase 1, fall back to root-level data
  if (phaseNumber === 1) {
    if (statusData?.current_status === "result_declared" || statusData?.result_available === true) {
      return { date: "Released", isReleased: true };
    }

    if (statusData?.expected_result_date) {
      return { date: statusData.expected_result_date, isReleased: false };
    }

    // Check predicted_events array
    const resultEvent = statusData?.predicted_events?.find(
      (e: any) => e.event_type === "result" && (e.phase === 1 || !e.phase)
    );
    if (resultEvent?.predicted_date) {
      return { date: resultEvent.predicted_date, isReleased: false };
    }
  } else {
    // Phase 2 predicted events
    const resultEvent = statusData?.predicted_events?.find(
      (e: any) => e.event_type === "result" && e.phase === 2
    );
    if (resultEvent?.predicted_date) {
      return { date: resultEvent.predicted_date, isReleased: false };
    }
  }

  return { date: null, isReleased: false };
};

// Helper function to get exam details text (phase-aware)
const getExamDetailsText = (statusData: any, phaseNumber: 1 | 2 = 1): string => {
  const phaseData = getPhaseData(statusData, phaseNumber);

  if (phaseData?.exam_details) return phaseData.exam_details;

  // Fall back to predicted_events
  const examDateEvent = statusData?.predicted_events?.find(
    (e: any) => (e.event_type === "exam_date" || e.event_type === "exam") &&
      (e.phase === phaseNumber || !e.phase)
  );
  if (examDateEvent?.notes) return examDateEvent.notes;

  return "Exam schedule will be announced.";
};

// Helper function to check if admit card is available (phase-aware)
const isAdmitCardAvailable = (statusData: any, phaseNumber: 1 | 2 = 1): boolean => {
  const phaseData = getPhaseData(statusData, phaseNumber);

  // CRITICAL: If explicit flag is FALSE, trust it over everything else and return false immediately
  if (phaseData?.admit_card_available === false) return false;
  if (phaseNumber === 1 && statusData?.admit_card_available === false) return false;

  // CRITICAL: Use strict boolean check - must be explicitly true, not just truthy
  // This prevents false positives when AI returns strings like "February 7 expected"
  if (phaseData?.admit_card_available === true) return true;

  // Text-based keyword matching (matches examStatus.ts logic used by TrendingExamCard)
  // This ensures consistency between Trending page and TrackedJobCard
  const statusText = (statusData?.current_status || "").toLowerCase();
  const summaryText = (statusData?.summary || "").toLowerCase();
  const combinedText = `${statusText} ${summaryText}`;

  const admitReleasedKeywords = [
    // Admit card phrases
    "admit card released", "admit card out now", "admit card declared",
    "admit card issued", "admit card published", "admit card uploaded",
    "admit card activated", "admit card made available", "admit card available",
    "admit card available online", "admit card download started",
    "admit card link available", "admit card link activated",
    "admit card link live", "admit card link working",
    "admit cards released", "admit cards out",
    "admit card out", "e-admit card",
    // Reversed admit card phrases
    "released admit card", "out admit card", "declared admit card",
    "issued admit card", "published admit card", "uploaded admit card",
    "activated admit card", "available admit card", "live admit card",
    "announced admit card", "notified admit card", "download admit card",
    "started admit card download", "active admit card link",
    "live admit card link", "working admit card link",
    // Hall ticket phrases
    "hall ticket released", "hall ticket out", "hall ticket issued",
    "hall ticket download started", "hall ticket available online",
    "hall ticket link activated", "hall ticket available",
    // Reversed hall ticket phrases
    "released hall ticket", "out hall ticket", "issued hall ticket",
    "available hall ticket", "activated hall ticket link",
    "announced hall ticket",
    // Call letter phrases
    "call letter released", "call letter issued", "call letter available",
    "call letter download link", "call letter out now",
    // Reversed call letter phrases
    "released call letter", "issued call letter", "available call letter",
    "download call letter", "published call letter",
  ];

  // Check for exact keyword matches only
  if (admitReleasedKeywords.some(kw => combinedText.includes(kw))) return true;

  // Backward compat for Phase 1 status checks
  if (phaseNumber === 1) {
    const status = statusData?.current_status;
    // Note: Removed "exam_scheduled" - being scheduled doesn't mean admit card is released
    return status === "admit_card_available" ||
      status === "exam_completed" || status === "result_declared";
  }

  return false;
};

// Helper function to get phase name
const getPhaseName = (statusData: any, phaseNumber: 1 | 2): string => {
  const phaseData = getPhaseData(statusData, phaseNumber);
  return phaseData?.name || `Phase ${phaseNumber}`;
};

// Helper function to format exam title with year (avoids duplication)
const formatExamTitle = (examName: string | undefined, attemptYear: number): string => {
  if (!examName) return `Exam ${attemptYear}`;

  // Check if exam name already contains ANY year (20xx pattern)
  const yearPattern = /\b20\d{2}\b/;
  if (yearPattern.test(examName)) {
    // Exam name already has a year, don't append another
    return examName;
  }

  // No year in exam name, append the attempt year
  return `${examName} ${attemptYear}`;
};

// Helper function to validate external URLs
const isValidUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

interface TrackedJobCardProps {
  attempt: ExamAttempt;
  cardIndex?: number;
}

export function TrackedJobCard({ attempt, cardIndex = 0 }: TrackedJobCardProps) {
  const { removeExamAttempt, getExamStatus, decryptPassword } = useExams();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState(1);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0); // Seconds remaining in cooldown
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const passwordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup intervals and timeouts on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
      if (passwordTimeoutRef.current) {
        clearTimeout(passwordTimeoutRef.current);
      }
    };
  }, []);

  // Initialize from cached response in database - no auto-fetch
  const [statusData, setStatusData] = useState<any>(() => {
    return attempt.exams?.ai_cached_response || null;
  });

  const exam = attempt.exams;
  const lastUpdatedAt = attempt.exams?.ai_last_updated_at;

  // Helper to start cooldown timer
  const startCooldown = (seconds: number) => {
    // Clear existing interval
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    setRefreshCooldown(seconds);
    cooldownIntervalRef.current = setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Only called when user clicks "Refresh Status"
  const fetchStatus = async () => {
    if (refreshCooldown > 0) return; // Prevent refresh during cooldown

    setIsLoadingStatus(true);
    try {
      const data = await getExamStatus(attempt.id, true); // Always force refresh
      setStatusData(data);
      toast.success("Status updated successfully");
      // Invalidate query to refresh cached data for all cards
      queryClient.invalidateQueries({ queryKey: ["exam_attempts"] });

      // Start 60-second cooldown after successful refresh
      startCooldown(60);
    } catch (error: any) {
      toast.error(error.message || "Failed to refresh status");
      // Shorter cooldown on error (10 seconds)
      startCooldown(10);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const getProgress = () => {
    if (!statusData) return 0;
    const status = statusData.current_status;
    if (status === "result_declared") return 100;
    if (status === "exam_completed") return 66;
    if (status === "admit_card_available" || status === "exam_scheduled") return 33;
    return 10;
  };

  const getCurrentPhase = () => {
    if (!statusData) return "No Data";
    const status = statusData.current_status;
    if (status === "result_declared") return "Result";
    if (status === "exam_completed") return "Result Awaited";
    if (status === "admit_card_available") return "Admit Card";
    if (status === "exam_scheduled") return "Exam Scheduled";
    return "Application";
  };

  const isPhaseComplete = (phase: string) => {
    if (!statusData) return false;
    const status = statusData.current_status;
    if (phase === "admit_card") {
      // Use the shared isAdmitCardAvailable helper for consistent detection
      return isAdmitCardAvailable(statusData, 1);
    }
    if (phase === "exam") {
      return status === "exam_completed" || status === "result_declared";
    }
    if (phase === "result") {
      return status === "result_declared";
    }
    return false;
  };

  const getStatusBadge = (isReleased: boolean) => {
    return isReleased ? (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">
        Released
      </Badge>
    ) : (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-xs">
        Pending
      </Badge>
    );
  };

  const hasCredentials = attempt.application_number || attempt.roll_number || attempt.password_encrypted;
  const cardVariant = cardIndex % 3;

  const handleTogglePassword = async () => {
    if (showPassword) {
      setShowPassword(false);
      setDecryptedPassword(null);
    } else {
      if (attempt.password_encrypted && !decryptedPassword) {
        setIsDecrypting(true);
        try {
          const password = await decryptPassword(attempt.password_encrypted);
          setDecryptedPassword(password);
          setShowPassword(true);
          // Auto-hide password after 30 seconds for security
          if (passwordTimeoutRef.current) {
            clearTimeout(passwordTimeoutRef.current);
          }
          passwordTimeoutRef.current = setTimeout(() => {
            setShowPassword(false);
            setDecryptedPassword(null);
          }, 30000);
        } catch (error) {
          toast.error("Failed to decrypt password");
        } finally {
          setIsDecrypting(false);
        }
      } else {
        setShowPassword(true);
      }
    }
  };

  return (
    <Card
      className={cn(
        "bg-white dark:bg-card border overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow",
        cardVariant === 0 && "border-sky-100/90 dark:border-sky-900/40 shadow-[0_2px_10px_rgba(14,116,144,0.08)] dark:shadow-[0_2px_12px_rgba(14,116,144,0.18)]",
        cardVariant === 1 && "border-blue-100/90 dark:border-blue-900/40 shadow-[0_2px_10px_rgba(37,99,235,0.08)] dark:shadow-[0_2px_12px_rgba(37,99,235,0.18)]",
        cardVariant === 2 && "border-indigo-100/90 dark:border-indigo-900/40 shadow-[0_2px_10px_rgba(79,70,229,0.08)] dark:shadow-[0_2px_12px_rgba(79,70,229,0.18)]"
      )}
    >
      {/* Clickable Area - Header + Collapsed Summary */}
      <div
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header - Always Visible */}
        <div className="flex items-center justify-between p-5">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {formatExamTitle(exam?.name, attempt.year)}
            </h3>
            {exam?.conducting_body && (
              <p className="text-xs text-muted-foreground mt-0.5">{exam.conducting_body}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Exam?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove "{exam?.name}" from your tracker?
                    This will delete all your saved credentials and notes for this exam.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => removeExamAttempt.mutate(attempt.id)}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Collapsed Summary */}
        {!isExpanded && (
          <div className="px-5 pb-5">
            {isLoadingStatus ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : statusData ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-foreground">{getCurrentPhase()}</span>
                  {getStatusBadge(getProgress() >= 33)}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Phase 1 Progress</span>
                    <span>{getProgress()}%</span>
                  </div>
                  <Progress value={getProgress()} className="h-2.5 bg-muted/50 dark:bg-muted/30 shadow-sm [&>div]:bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Tap to view important dates and news
                </p>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">No status data yet</p>
                <p className="text-xs text-muted-foreground">Expand and click "Refresh Status" to get updates</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Phase Tabs */}
          <div className="flex gap-2">
            <button
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activePhase === 1
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-slate-50/90 dark:bg-card/80 text-muted-foreground border border-slate-200/70 dark:border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20"
              )}
              onClick={() => setActivePhase(1)}
            >
              {getPhaseName(statusData, 1)}
            </button>
            <button
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activePhase === 2
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-slate-50/90 dark:bg-card/80 text-muted-foreground border border-slate-200/70 dark:border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20",
                !isPhase2Available(statusData) && "opacity-50"
              )}
              onClick={() => setActivePhase(2)}
            >
              {getPhaseName(statusData, 2)}
            </button>
          </div>

          {/* Phase 2 Content */}
          {activePhase === 2 && (
            isPhase2Available(statusData) ? (
              <>
                {/* Admit Card Section for Phase 2 */}
                <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Admit Card</span>
                      {isAdmitCardAvailable(statusData, 2) ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">
                          Released
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isAdmitCardAvailable(statusData, 2)
                        ? "Download from the official website."
                        : "Will be available after Phase 1 result."}
                    </p>
                    {isValidUrl(getPhaseData(statusData, 2)?.admit_card_link) && isAdmitCardAvailable(statusData, 2) && (
                      <a
                        href={getPhaseData(statusData, 2).admit_card_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        Download →
                      </a>
                    )}
                  </div>
                </div>

                {/* Exam Date Section for Phase 2 */}
                {(() => {
                  const examDate = getExamDateFromResponse(statusData, 2);
                  const examDetails = getExamDetailsText(statusData, 2);
                  return (
                    <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Exam Date</span>
                          {examDate ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">
                              {examDate}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-0 text-xs">
                              TBD
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {examDetails}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Result Section for Phase 2 */}
                {(() => {
                  const resultInfo = getResultInfoFromResponse(statusData, 2);
                  return (
                    <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Result</span>
                          {resultInfo.isReleased ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">
                              Released
                            </Badge>
                          ) : resultInfo.date ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">
                              {resultInfo.date}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {resultInfo.isReleased
                            ? "Results have been declared."
                            : resultInfo.date
                              ? `Expected on ${resultInfo.date}`
                              : "Result date will be announced."}
                        </p>
                        {isValidUrl(getPhaseData(statusData, 2)?.result_link) && resultInfo.isReleased && (
                          <a
                            href={getPhaseData(statusData, 2).result_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                          >
                            Check Result →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  {statusData?.phases?.phase2?.status === "not_applicable"
                    ? "This exam has only one phase"
                    : "Phase 2 details coming soon"}
                </p>
                <p className="text-xs mt-1">
                  {statusData?.phases?.phase2?.status === "not_applicable"
                    ? "No additional stages for this exam."
                    : "Phase 2 information will be available after Phase 1 completion"}
                </p>
              </div>
            )
          )}

          {activePhase === 1 && isLoadingStatus ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : activePhase === 1 && statusData ? (
            <>
              {/* Admit Card Section */}
              <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Admit Card</span>
                    {getStatusBadge(isPhaseComplete("admit_card"))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPhaseComplete("admit_card")
                      ? "Download from the official website."
                      : "Will be available soon."}
                  </p>
                  {isValidUrl(statusData?.admit_card_link) && isPhaseComplete("admit_card") && (
                    <a
                      href={statusData.admit_card_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Download →
                    </a>
                  )}
                </div>
              </div>

              {/* Exam Date Section */}
              {(() => {
                const examDate = getExamDateFromResponse(statusData);
                const examDetails = getExamDetailsText(statusData);
                return (
                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">Exam Date</span>
                        {examDate ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">
                            {examDate}
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-0 text-xs">
                            TBD
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {examDetails}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Result Section */}
              {(() => {
                const resultInfo = getResultInfoFromResponse(statusData);
                return (
                  <div className="flex items-start gap-3 p-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">Result</span>
                        {resultInfo.isReleased ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">
                            Released
                          </Badge>
                        ) : resultInfo.date ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">
                            {resultInfo.date}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {resultInfo.isReleased
                          ? "Results have been declared."
                          : resultInfo.date
                            ? `Expected on ${resultInfo.date}`
                            : "Result date will be announced."}
                      </p>
                      {isValidUrl(statusData?.result_link) && resultInfo.isReleased && (
                        <a
                          href={statusData.result_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          Check Result →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phase 1 Progress</span>
                  <span className="font-medium text-primary">{getProgress()}%</span>
                </div>
                <Progress value={getProgress()} className="h-3 bg-muted/50 dark:bg-muted/30 shadow-sm [&>div]:bg-primary" />
              </div>

              {/* Recent News Section */}
              {(statusData?.predicted_events?.length > 0 || statusData?.summary) && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-border bg-slate-50/80 dark:bg-card/80 rounded-xl p-3 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Newspaper className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Recent News for {exam?.name}</span>
                  </div>
                  <div className="space-y-2">
                    {statusData?.summary && (
                      <div className="flex items-start gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{statusData.summary}</span>
                      </div>
                    )}
                    {statusData?.predicted_events?.slice(0, 2).map((event: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {event.event_type?.replace(/_/g, " ")} - {event.predicted_date || "Date TBD"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations Section */}
              {statusData?.recommendations?.length > 0 && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-xl p-3 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💡</span>
                    <span className="font-medium text-sm text-amber-800 dark:text-amber-200">AI Recommendations</span>
                  </div>
                  <ul className="space-y-2">
                    {statusData.recommendations.map((recommendation: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="text-amber-900 dark:text-amber-100">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Last Updated Info */}
              {lastUpdatedAt && (
                <p className="text-xs text-muted-foreground text-center">
                  Last updated {formatDistanceToNow(new Date(lastUpdatedAt))} ago
                </p>
              )}
            </>
          ) : activePhase === 1 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm mb-1">No status data available</p>
              <p className="text-xs">Click "Refresh Status" below to fetch latest updates</p>
            </div>
          ) : null}

          {/* My Application Section */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">My Application Credentials</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCredentialsModal(true)}
                className="h-8 px-2 text-xs"
              >
                {hasCredentials ? (
                  <>
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Details
                  </>
                )}
              </Button>
            </div>

            {hasCredentials ? (
              <div className="space-y-2 bg-slate-50/80 dark:bg-card/80 rounded-xl p-3 border border-slate-200/70 dark:border-border">
                {attempt.application_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Application No.</span>
                    <span className="font-medium">{attempt.application_number}</span>
                  </div>
                )}
                {attempt.roll_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Roll Number</span>
                    <span className="font-medium">{attempt.roll_number}</span>
                  </div>
                )}
                {attempt.password_encrypted && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Password</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono">
                        {showPassword && decryptedPassword
                          ? decryptedPassword
                          : "••••••••"}
                      </span>
                      <button
                        onClick={handleTogglePassword}
                        disabled={isDecrypting}
                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {isDecrypting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-3 bg-slate-50/80 dark:bg-card/80 rounded-xl border border-slate-200/70 dark:border-border">
                <p className="text-xs text-muted-foreground">
                  Add your application number, roll number & password
                </p>
              </div>
            )}
          </div>

          {/* Refresh Button - Prominent styling with throttle */}
          <div className="flex justify-center pt-4">
            <Button
              size="default"
              onClick={fetchStatus}
              disabled={isLoadingStatus || refreshCooldown > 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingStatus && "animate-spin")} />
              {refreshCooldown > 0
                ? `Wait ${refreshCooldown}s`
                : "Refresh Status"}
            </Button>
          </div>

          {/* Collapse Button at Bottom Center */}
          <div className="flex justify-center pt-4 border-t border-border mt-4">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          </div>
        </CardContent>
      )}

      {/* Credentials Modal */}
      <ExamCredentialsModal
        open={showCredentialsModal}
        onOpenChange={setShowCredentialsModal}
        attemptId={attempt.id}
        examName={`${exam?.name || "Exam"} ${attempt.year}`}
        existingCredentials={{
          applicationNumber: attempt.application_number,
          rollNumber: attempt.roll_number,
          hasPassword: !!attempt.password_encrypted,
        }}
      />
    </Card>
  );
}
