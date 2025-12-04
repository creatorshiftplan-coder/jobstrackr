import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface AIJobResult {
  title: string;
  department: string;
  location: string;
  qualification: string;
  experience: string | null;
  eligibility: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  age_min: number | null;
  age_max: number | null;
  application_fee: number | null;
  vacancies: number | null;
  last_date: string | null;
  apply_link: string | null;
  confidence: number;
}

export function useAIJobSearch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSearching, setIsSearching] = useState(false);
  const [aiResult, setAiResult] = useState<AIJobResult | null>(null);
  const [searchStatus, setSearchStatus] = useState<"new" | "exists" | "similar" | "error" | null>(null);

  const searchWithAI = async (query: string) => {
    setIsSearching(true);
    setAiResult(null);
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
        setAiResult(result.job);
        return result.existingJob;
      }

      if (result.job) {
        setAiResult(result.job);
        setSearchStatus("new");
        toast.success("Job found via AI search!");
        return result.job;
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

  const saveAIJob = async () => {
    if (!aiResult) return null;

    try {
      const { data, error } = await supabase.from("jobs").insert({
        title: aiResult.title,
        department: aiResult.department,
        location: aiResult.location,
        qualification: aiResult.qualification,
        experience: aiResult.experience,
        eligibility: aiResult.eligibility,
        description: aiResult.description,
        salary_min: aiResult.salary_min,
        salary_max: aiResult.salary_max,
        age_min: aiResult.age_min || 18,
        age_max: aiResult.age_max || 65,
        application_fee: aiResult.application_fee || 0,
        vacancies: aiResult.vacancies || 1,
        last_date: aiResult.last_date || new Date().toISOString().split("T")[0],
        apply_link: aiResult.apply_link,
        is_featured: false,
      }).select().single();

      if (error) throw error;

      toast.success("Job saved to database!");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setAiResult(null);
      setSearchStatus(null);
      return data;
    } catch (error) {
      console.error("Save job error:", error);
      toast.error("Failed to save job");
      return null;
    }
  };

  const clearAIResult = () => {
    setAiResult(null);
    setSearchStatus(null);
  };

  return {
    isSearching,
    aiResult,
    searchStatus,
    searchWithAI,
    saveAIJob,
    clearAIResult,
  };
}
