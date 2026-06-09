import { Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs, useSaveJob, useUnsaveJob } from "@/hooks/useSavedJobs";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuthRequired } from "@/components/AuthRequiredDialog";

interface SaveJobButtonProps {
  jobId: string;
  className?: string;
  variant?: "default" | "light";
}

export function SaveJobButton({ jobId, className, variant = "default" }: SaveJobButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: savedJobs } = useSavedJobs();
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();
  const { trackJobSaved } = useAnalytics();
  const { showAuthRequired } = useAuthRequired();

  const isSaved = savedJobs?.some((saved) => saved.job_id === jobId) ?? false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      showAuthRequired("Login to save jobs and track your applications");
      return;
    }

    if (isSaved) {
      unsaveJob.mutate(jobId);
    } else {
      saveJob.mutate(jobId);
      trackJobSaved(jobId, ""); // Note: job title not available in this component
    }
  };

  const iconStyles = variant === "light"
    ? isSaved
      ? "fill-white text-white"
      : "fill-white/30 text-white"
    : isSaved
      ? "fill-primary text-primary"
      : "text-muted-foreground";

  return (
    <button
      className={cn(
        "p-2 rounded-full transition-colors",
        variant === "light" ? "hover:bg-white/20" : "hover:bg-secondary",
        className
      )}
      onClick={handleClick}
      aria-label={isSaved ? "Unsave job" : "Save job"}
    >
      <Bookmark
        className={cn(
          "h-5 w-5 transition-colors",
          iconStyles
        )}
      />
    </button>
  );
}
