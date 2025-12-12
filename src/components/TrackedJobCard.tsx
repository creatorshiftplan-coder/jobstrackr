import { useState } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { ExamCredentialsModal } from "@/components/ExamCredentialsModal";

interface TrackedJobCardProps {
  attempt: ExamAttempt;
}

export function TrackedJobCard({ attempt }: TrackedJobCardProps) {
  const { removeExamAttempt, getExamStatus, decryptPassword } = useExams();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState(1);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Initialize from cached response in database - no auto-fetch
  const [statusData, setStatusData] = useState<any>(() => {
    return attempt.exams?.ai_cached_response || null;
  });

  const exam = attempt.exams;
  const lastUpdatedAt = attempt.exams?.ai_last_updated_at;

  // Only called when user clicks "Refresh Status"
  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await getExamStatus(attempt.id, true); // Always force refresh
      setStatusData(data);
      toast.success("Status updated successfully");
      // Invalidate query to refresh cached data for all cards
      queryClient.invalidateQueries({ queryKey: ["exam_attempts"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to refresh status");
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
      return status === "admit_card_available" || status === "exam_scheduled" ||
        status === "exam_completed" || status === "result_declared";
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
    <Card className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30 border-blue-200/50 dark:border-blue-800/30 overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      {/* Clickable Area - Header + Collapsed Summary */}
      <div
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header - Always Visible */}
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {exam?.name} {attempt.year}
            </h3>
            {exam?.conducting_body && (
              <p className="text-xs text-muted-foreground mt-0.5">{exam.conducting_body}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                removeExamAttempt.mutate(attempt.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Collapsed Summary */}
        {!isExpanded && (
          <div className="px-4 pb-4">
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
                  <Progress value={getProgress()} className="h-2.5 bg-white/50 shadow-sm [&>div]:bg-primary" />
                </div>
                {lastUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated {formatDistanceToNow(new Date(lastUpdatedAt))} ago
                  </p>
                )}
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
                  : "bg-white text-muted-foreground border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20"
              )}
              onClick={() => setActivePhase(1)}
            >
              Phase 1
            </button>
            <button
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activePhase === 2
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-white text-muted-foreground border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20"
              )}
              onClick={() => setActivePhase(2)}
            >
              Phase 2
            </button>
          </div>

          {/* Phase 2 Content Placeholder */}
          {activePhase === 2 && (
            <div className="text-center py-8 text-muted-foreground bg-white rounded-lg border border-border">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Phase 2 details coming soon</p>
              <p className="text-xs mt-1">Phase 2 information will be available after Phase 1 completion</p>
            </div>
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
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-border">
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
                  {statusData?.admit_card_link && isPhaseComplete("admit_card") && (
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
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Exam Date</span>
                    {statusData?.exam_dates ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">
                        {statusData.exam_dates}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-0 text-xs">
                        TBD
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statusData?.exam_details || "Exam schedule will be announced."}
                  </p>
                </div>
              </div>

              {/* Result Section */}
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-border">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Result</span>
                    {getStatusBadge(isPhaseComplete("result"))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPhaseComplete("result")
                      ? "Results have been declared."
                      : statusData?.expected_result_date
                        ? `Expected in ${statusData.expected_result_date}`
                        : "Result date will be announced."}
                  </p>
                  {statusData?.result_link && isPhaseComplete("result") && (
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

              {/* Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phase 1 Progress</span>
                  <span className="font-medium text-primary">{getProgress()}%</span>
                </div>
                <Progress value={getProgress()} className="h-3 bg-white/50 shadow-sm [&>div]:bg-primary" />
              </div>

              {/* Recent News Section */}
              {(statusData?.predicted_events?.length > 0 || statusData?.summary) && (
                <div className="pt-2 border-t border-border bg-white rounded-lg p-3 mt-2">
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
              <div className="space-y-2 bg-white rounded-lg p-3 border border-border">
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
              <div className="text-center py-3 bg-white rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  Add your application number, roll number & password
                </p>
              </div>
            )}
          </div>

          {/* Refresh Button - Prominent styling */}
          <div className="flex justify-center pt-4">
            <Button
              size="default"
              onClick={fetchStatus}
              disabled={isLoadingStatus}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingStatus && "animate-spin")} />
              Refresh Status
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
