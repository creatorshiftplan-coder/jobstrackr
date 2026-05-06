import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UseProfileOptions {
  enabled?: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  father_name: string | null;
  mother_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  aadhar_number: string | null;
  pan_number: string | null;
  passport_number: string | null;
  category: string | null;
  caste_name: string | null;
  caste_certificate_number: string | null;
  photo_url: string | null;
  signature_url: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  marital_status: string | null;
  pincode: string | null;
  ews_certificate_number: string | null;
  ews_issuing_authority: string | null;
  sub_category: string | null;
  disability_type: string | null;
  disability_certificate_number: string | null;
  caste_issuing_authority: string | null;
  caste_issue_date: string | null;
  current_status: string | null;
  left_thumb_url: string | null;
  preferred_sectors: string[] | null;
  // Decrypted sensitive fields (for display in FormMate)
  decrypted_aadhar_number?: string | null;
  decrypted_pan_number?: string | null;
  decrypted_passport_number?: string | null;
}

export function useProfile(options: UseProfileOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!user?.id,
  });

  const upsertProfile = useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .insert({ ...profileData, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    upsertProfile,
  };
}

/**
 * Separate hook for decrypted sensitive fields (Aadhar, PAN, Passport).
 * Only call this on pages that actually need decrypted values (e.g. FormMate).
 * This avoids a sequential RPC call on every page that uses useProfile.
 */
export function useDecryptedProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["decrypted-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: decryptedData } = await supabase
        .rpc("get_my_decrypted_profile");

      if (decryptedData && decryptedData.length > 0) {
        return {
          decrypted_aadhar_number: decryptedData[0].aadhar_number_decrypted,
          decrypted_pan_number: decryptedData[0].pan_number_decrypted,
          decrypted_passport_number: decryptedData[0].passport_number_decrypted,
        };
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}
