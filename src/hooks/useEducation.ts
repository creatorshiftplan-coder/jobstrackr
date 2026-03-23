import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UseEducationOptions {
  enabled?: boolean;
}

export interface EducationQualification {
  id: string;
  user_id: string;
  qualification_type: string;
  qualification_name: string | null;
  board_university: string | null;
  institute_name: string | null;
  date_of_passing: string | null;
  marks_obtained: number | null;
  maximum_marks: number | null;
  percentage: number | null;
  cgpa: number | null;
  roll_number: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export function useEducation(options: UseEducationOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["education", user?.id],
    queryFn: async (): Promise<EducationQualification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("education_qualifications")
        .select("*")
        .eq("user_id", user.id)
        .order("date_of_passing", { ascending: false });

      if (error) throw error;
      return (data || []) as EducationQualification[];
    },
    enabled: enabled && !!user?.id,
  });

  const addEducation = useMutation({
    mutationFn: async (education: Partial<EducationQualification>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("education_qualifications")
        .insert({ ...education, user_id: user.id } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education", user?.id] });
      toast.success("Education added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add education: " + error.message);
    },
  });

  const updateEducation = useMutation({
    mutationFn: async ({ id, ...education }: Partial<EducationQualification> & { id: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("education_qualifications")
        .update(education)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education", user?.id] });
      toast.success("Education updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update education: " + error.message);
    },
  });

  const deleteEducation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("education_qualifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education", user?.id] });
      toast.success("Education deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete education: " + error.message);
    },
  });

  return {
    education: query.data || [],
    isLoading: query.isLoading,
    addEducation,
    updateEducation,
    deleteEducation,
  };
}
