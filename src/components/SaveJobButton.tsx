import { Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs, useSaveJob, useUnsaveJob } from "@/hooks/useSavedJobs";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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

  const isSaved = savedJobs?.some((saved) => saved.job_id === jobId) ?? false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate("/auth");
      return;
    }

    if (isSaved) {
      unsaveJob.mutate(jobId);
    } else {
      saveJob.mutate(jobId);
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
