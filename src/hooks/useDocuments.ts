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

  // Helper to get signed URL from storage path
  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    // Extract bucket and path from stored path (e.g., "documents/user-id/timestamp.ext")
    const pathParts = storagePath.split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 900); // 15 min expiry
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  };

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
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL (15 min expiry) since bucket is now private
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 900); // 15 minutes

      if (signedUrlError) throw signedUrlError;

      // Store the file path (not signed URL) for later signed URL generation
      const storagePath = `documents/${filePath}`;

      // Create document record with storage path
      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          document_type: documentType,
          file_url: storagePath, // Store path, not signed URL
          file_name: file.name,
          ocr_status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, signedUrl: signedUrlData.signedUrl };
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
    getSignedUrl,
  };
}
