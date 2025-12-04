import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Document {
  id: string;
  user_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  ocr_status: string | null;
  ocr_result: any;
  created_at: string;
  updated_at: string;
}

export function useDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: async (): Promise<Document[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          document_type: documentType,
          file_url: publicUrl,
          file_name: file.name,
          ocr_status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", user?.id] });
      toast.success("Document uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload document: " + error.message);
    },
  });

  const processOCR = useMutation({
    mutationFn: async ({ documentId, documentType, fileUrl }: { documentId: string; documentType: string; fileUrl: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            document_id: documentId,
            document_type: documentType,
            file_url: fileUrl,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", user?.id] });
      toast.success("OCR processing completed");
    },
    onError: (error) => {
      toast.error("OCR processing failed: " + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", user?.id] });
      toast.success("Document deleted");
    },
  });

  return {
    documents: query.data || [],
    isLoading: query.isLoading,
    uploadDocument,
    processOCR,
    deleteDocument,
  };
}
