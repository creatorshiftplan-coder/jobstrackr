import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamAttempt, useExams } from "@/hooks/useExams";
import {
  Calendar,
  ExternalLink,
  RefreshCw,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ExamCardProps {
  attempt: ExamAttempt;
}

export function ExamCard({ attempt }: ExamCardProps) {
  const { removeExamAttempt, getExamStatus } = useExams();
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);

  const exam = attempt.exams;

  const fetchStatus = async (forceRefresh = false) => {
    setIsLoadingStatus(true);
    try {
      const data = await getExamStatus(attempt.id, forceRefresh);
      setStatusData(data);
      if (data.from_cache) {
        toast.info(`Using cached data (${data.cache_age_hours}h old)`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch status");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "result_declared":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "admit_card_available":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "exam_scheduled":
      case "exam_completed":
        return <Calendar className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{exam?.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{exam?.conducting_body}</p>
          </div>
          <Badge variant="outline">{attempt.year}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {exam?.category && (
          <Badge variant="secondary" className="text-xs">
            {exam.category}
          </Badge>
        )}

        {statusData && (
          <div className="p-3 rounded-lg bg-secondary space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(statusData.current_status)}
              <span className="text-sm font-medium">
                {getStatusLabel(statusData.current_status)}
              </span>
              {statusData.from_cache && (
                <Badge variant="outline" className="text-xs">
                  Cached
                </Badge>
              )}
            </div>

            {statusData.summary && (
              <p className="text-sm text-muted-foreground">{statusData.summary}</p>
            )}

            {statusData.admit_card_available && statusData.admit_card_link && (
              <Button size="sm" variant="default" asChild>
                <a href={statusData.admit_card_link} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-1" />
                  Download Admit Card
                </a>
              </Button>
            )}

            {statusData.result_available && statusData.result_link && (
              <Button size="sm" variant="default" asChild>
                <a href={statusData.result_link} target="_blank" rel="noopener noreferrer">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Check Result
                </a>
              </Button>
            )}

            {statusData.predicted_events && statusData.predicted_events.length > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs font-medium">Upcoming Events:</p>
                {statusData.predicted_events
                  .filter((e: any) => e.predicted_date)
                  .slice(0, 3)
                  .map((event: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      <span>{event.predicted_date}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {isLoadingStatus && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchStatus(false)}
            disabled={isLoadingStatus}
          >
            {isLoadingStatus ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">{statusData ? "Refresh" : "Get Status"}</span>
          </Button>

          {statusData && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchStatus(true)}
              disabled={isLoadingStatus}
            >
              Force Refresh
            </Button>
          )}

          {exam?.official_website && (
            <Button size="sm" variant="ghost" asChild>
              <a href={exam.official_website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeExamAttempt.mutate(attempt.id)}
            className="ml-auto text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
