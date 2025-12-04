import { Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedJobs, useSaveJob, useUnsaveJob } from "@/hooks/useSavedJobs";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SaveJobButtonProps {
  jobId: string;
  className?: string;
}

export function SaveJobButton({ jobId, className }: SaveJobButtonProps) {
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

  return (
    <button
      className={cn(
        "p-2 rounded-full hover:bg-secondary transition-colors",
        className
      )}
      onClick={handleClick}
      aria-label={isSaved ? "Unsave job" : "Save job"}
    >
      <Bookmark
        className={cn(
          "h-5 w-5 transition-colors",
          isSaved ? "fill-primary text-primary" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
