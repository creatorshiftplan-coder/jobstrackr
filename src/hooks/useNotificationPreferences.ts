import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface NotificationPreferences {
  user_id: string;
  ssc: boolean;
  upsc: boolean;
  railway: boolean;
  banking: boolean;
  defence: boolean;
  psu: boolean;
  state_psc: boolean;
  healthcare: boolean;
  job_notifications: boolean;
  admit_card_notifications: boolean;
  result_notifications: boolean;
  answer_key_notifications: boolean;
  preferred_states: string[];
  preferred_regions: string[];
  tenth_pass: boolean;
  twelfth_pass: boolean;
  graduate: boolean;
  postgraduate: boolean;
}

export interface TelegramConnection {
  id: string;
  user_id: string;
  telegram_chat_id: string;
  is_active: boolean;
  connected_at: string;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch Notification Preferences
  const preferencesQuery = useQuery({
    queryKey: ["notification_preferences", user?.id],
    queryFn: async (): Promise<NotificationPreferences | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // 2. Fetch Telegram Connection status
  const connectionQuery = useQuery({
    queryKey: ["telegram_connection", user?.id],
    queryFn: async (): Promise<TelegramConnection | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("telegram_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // 3. Update Preferences Mutation
  const updatePreferences = useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_preferences", user?.id] });
      toast.success("Notification preferences updated");
    },
    onError: (error) => {
      console.error("Failed to update preferences:", error);
      toast.error("Failed to save notification preferences");
    },
  });

  // 4. Toggle Telegram Active status Mutation
  const toggleTelegramActive = useMutation({
    mutationFn: async (active: boolean) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("telegram_connections")
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram_connection", user?.id] });
      toast.success("Telegram alerts settings updated");
    },
    onError: (error) => {
      console.error("Failed to toggle connection:", error);
      toast.error("Failed to update Telegram settings");
    },
  });

  // 5. Disconnect Telegram Connection
  const disconnectTelegram = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("telegram_connections")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram_connection", user?.id] });
      toast.success("Telegram account disconnected");
    },
    onError: (error) => {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to disconnect Telegram account");
    },
  });

  return {
    preferences: preferencesQuery.data,
    connection: connectionQuery.data,
    isLoading: preferencesQuery.isLoading || connectionQuery.isLoading,
    updatePreferences,
    toggleTelegramActive,
    disconnectTelegram,
  };
}
