import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { Job } from "@/types/job";

export interface SavedJob {
  job_id: string;
  created_at: string;
  jobs: Job | null;
}

export function useSavedJobs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["saved-jobs", user?.id],
    queryFn: async (): Promise<SavedJob[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("job_id, created_at, jobs(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SavedJob[];
    },
    enabled: !!user,
  });
}

export function useSaveJob() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!user) throw new Error("Please login to save jobs");

      const { error } = await supabase
        .from("saved_jobs")
        .insert({ job_id: jobId, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
      toast({ title: "Job saved!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUnsaveJob() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!user) throw new Error("Please login first");

      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("job_id", jobId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
      toast({ title: "Job removed from saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useIsJobSaved(jobId: string) {
  const { data: savedJobs } = useSavedJobs();
  return savedJobs?.some((saved) => saved.job_id === jobId) ?? false;
}
