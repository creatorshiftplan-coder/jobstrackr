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
  const [searchStatus, setSearchStatus] = useState<"new" | "exists" | "similar" | "error" | null>(null);

  const searchWithAI = async (query: string) => {
    setIsSearching(true);
    setAiResults([]);
    setSearchStatus(null);

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
        if (result.jobs && result.jobs.length > 0) {
          setAiResults(result.jobs);
        }
        return result.existingJob;
      }

      if (result.jobs && result.jobs.length > 0) {
        setAiResults(result.jobs);
        setSearchStatus("new");
        toast.success(`Found ${result.jobs.length} job(s) via AI search!`);
        return result.jobs[0];
      }

      setSearchStatus("error");
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

  const saveAIJob = async (jobToSave?: AIJobResult) => {
    const job = jobToSave || aiResults[0];
    if (!job) return null;

    setIsSaving(true);

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
        toast.error(result.error);
        return null;
      }

      toast.success("Job saved to database!");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      
      // Remove saved job from results
      setAiResults(prev => prev.filter(j => j.exam_name !== job.exam_name));
      if (aiResults.length <= 1) {
        setSearchStatus(null);
      }
      
      return result.job;
    } catch (error) {
      console.error("Save job error:", error);
      toast.error("Failed to save job");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const clearAIResults = () => {
    setAiResults([]);
    setSearchStatus(null);
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
    searchWithAI,
    saveAIJob,
    clearAIResults,
    dismissJob,
  };
}
