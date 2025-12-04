import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface ApplicationFees {
  general: number;
  obc: number;
  sc_st: number;
  female: number;
}

export interface AIJobResult {
  exam_name: string;
  agency: string;
  location: string;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  age_limit: string;
  application_fees: ApplicationFees;
  last_date: string | null;
  exam_date: string | null;
  job_type: string;
  description: string | null;
  highlights: string | null;
  apply_link: string | null;
  confidence: number;
}

export function useAIJobSearch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResults, setAiResults] = useState<AIJobResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<"new" | "exists" | "similar" | "error" | "not_found" | null>(null);
  const [autoSavedJobIds, setAutoSavedJobIds] = useState<Map<string, string>>(new Map());

  // Auto-save job silently (no toast)
  const autoSaveJobSilently = async (job: AIJobResult): Promise<{ id: string } | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-job-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            saveJob: true,
            jobData: job,
            userId: user?.id,
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        console.error("Auto-save error:", result.error);
        return null;
      }

      return result.job;
    } catch (error) {
      console.error("Auto-save error:", error);
      return null;
    }
  };

  const searchWithAI = async (query: string) => {
    setIsSearching(true);
    setAiResults([]);
    setSearchStatus(null);
    setAutoSavedJobIds(new Map());

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-job-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query,
            userId: user?.id,
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        setSearchStatus("error");
        return null;
      }

      if (result.status === "exists" && result.existingJob) {
        toast.info("This job already exists in our database");
        setSearchStatus("exists");
        return result.existingJob;
      }

      if (result.status === "similar" && result.existingJob) {
        toast.info("A similar job was found");
        setSearchStatus("similar");
        return result.existingJob;
      }

      if (result.jobs && result.jobs.length > 0) {
        // Filter only high-confidence results (>= 70%)
        const validJobs = result.jobs.filter((j: AIJobResult) => (j.confidence || 0) >= 0.7);
        
        if (validJobs.length > 0) {
          // Auto-save all high confidence jobs
          const savedIds = new Map<string, string>();
          
          for (const job of validJobs) {
            const savedJob = await autoSaveJobSilently(job);
            if (savedJob?.id) {
              savedIds.set(job.exam_name, savedJob.id);
            }
          }
          
          setAutoSavedJobIds(savedIds);
          setAiResults(validJobs);
          setSearchStatus("new");
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          toast.success(`Found ${validJobs.length} exam(s)! Auto-saved to database.`);
          return validJobs[0];
        } else {
          // No high confidence results - show "not found" message
          setSearchStatus("not_found");
          return null;
        }
      }

      // No results at all
      setSearchStatus("not_found");
      return null;
    } catch (error) {
      console.error("AI search error:", error);
      toast.error("AI search failed");
      setSearchStatus("error");
      return null;
    } finally {
      setIsSearching(false);
    }
  };

  const getSavedJobId = (examName: string): string | undefined => {
    return autoSavedJobIds.get(examName);
  };

  const clearAIResults = () => {
    setAiResults([]);
    setSearchStatus(null);
    setAutoSavedJobIds(new Map());
  };

  const dismissJob = (job: AIJobResult) => {
    setAiResults(prev => prev.filter(j => j.exam_name !== job.exam_name));
    if (aiResults.length <= 1) {
      setSearchStatus(null);
    }
  };

  return {
    isSearching,
    isSaving,
    aiResults,
    searchStatus,
    autoSavedJobIds,
    searchWithAI,
    getSavedJobId,
    clearAIResults,
    dismissJob,
  };
}
