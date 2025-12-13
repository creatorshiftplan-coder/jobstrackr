import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Exam {
  id: string;
  name: string;
  conducting_body: string | null;
  category: string | null;
  description: string | null;
  official_website: string | null;
  is_active: boolean;
  ai_last_updated_at: string | null;
  ai_cached_response: any;
  created_at: string;
  updated_at: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  exam_id: string;
  year: number;
  status: string | null;
  notes: string | null;
  application_number: string | null;
  roll_number: string | null;
  password_encrypted: string | null;
  created_at: string;
  updated_at: string;
  exams?: Exam;
}

export interface ExamCredentials {
  applicationNumber: string;
  rollNumber: string;
  password: string;
}

export function useExams() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: async (): Promise<Exam[]> => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const userExamsQuery = useQuery({
    queryKey: ["exam_attempts", user?.id],
    queryFn: async (): Promise<ExamAttempt[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exams(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addExamAttempt = useMutation({
    mutationFn: async ({ examId, year }: { examId: string; year: number }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("exam_attempts")
        .insert({
          user_id: user.id,
          exam_id: examId,
          year,
          status: "tracking",
        })
        .select("*, exams(*)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam_attempts", user?.id] });
      toast.success("Exam added to tracker");
    },
    onError: (error) => {
      toast.error("Failed to add exam: " + error.message);
    },
  });

  const removeExamAttempt = useMutation({
    mutationFn: async (attemptId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("exam_attempts")
        .delete()
        .eq("id", attemptId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam_attempts", user?.id] });
      toast.success("Exam removed from tracker");
    },
    onError: (error) => {
      toast.error("Failed to remove exam: " + error.message);
    },
  });

  const updateExamCredentials = useMutation({
    mutationFn: async ({ attemptId, credentials }: { attemptId: string; credentials: ExamCredentials }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Encrypt password if provided
      let encryptedPassword: string | null = null;
      if (credentials.password) {
        const { data: encrypted, error: encryptError } = await supabase.rpc(
          "encrypt_sensitive_field",
          { field_value: credentials.password, owner_id: user.id }
        );
        if (encryptError) throw encryptError;
        encryptedPassword = encrypted;
      }

      const { data, error } = await supabase
        .from("exam_attempts")
        .update({
          application_number: credentials.applicationNumber || null,
          roll_number: credentials.rollNumber || null,
          password_encrypted: encryptedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .select("*, exams(*)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam_attempts", user?.id] });
      toast.success("Application details saved");
    },
    onError: (error) => {
      toast.error("Failed to save details: " + error.message);
    },
  });

  const decryptPassword = async (encryptedPassword: string): Promise<string> => {
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase.rpc("decrypt_sensitive_field", {
      encrypted_value: encryptedPassword,
      owner_id: user.id,
    });

    if (error) throw error;
    return data || "";
  };

  const createExam = useMutation({
    mutationFn: async (examData: { name: string; conducting_body?: string; category?: string; description?: string; official_website?: string }) => {
      const { data, error } = await supabase
        .from("exams")
        .insert({
          name: examData.name,
          conducting_body: examData.conducting_body || null,
          category: examData.category || null,
          description: examData.description || null,
          official_website: examData.official_website || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam created");
    },
    onError: (error) => {
      toast.error("Failed to create exam: " + error.message);
    },
  });

  const getExamStatus = async (attemptId: string, forceRefresh = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "status_update",
            exam_attempt_id: attemptId,
            force_refresh: forceRefresh,
          }),
        }
      );

      if (!response.ok) {
        // Handle rate limiting with user-friendly message
        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        }
        throw new Error(`Request failed: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Unknown error");
      return result.data;
    } catch (error) {
      throw error instanceof Error ? error : new Error("Network error. Please check your connection.");
    }
  };

  return {
    exams: examsQuery.data || [],
    userExams: userExamsQuery.data || [],
    isLoading: examsQuery.isLoading || userExamsQuery.isLoading,
    addExamAttempt,
    removeExamAttempt,
    updateExamCredentials,
    decryptPassword,
    createExam,
    getExamStatus,
  };
}

