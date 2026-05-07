import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ApiKeyEntry {
  id: string;
  provider: string;
  model_name: string;
  api_key: string;
  is_active: boolean;
  priority: number;
  label: string | null;
  last_used_at: string | null;
  last_error: string | null;
  total_calls: number;
  total_errors: number;
  created_at: string;
  updated_at: string;
}

export type NewApiKeyEntry = {
  provider: string;
  model_name: string;
  api_key: string;
  is_active?: boolean;
  priority?: number;
  label?: string;
};

const PROVIDER_PRESETS: Record<string, { baseUrl: string; models: string[] }> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash-exp:free",
      "google/gemini-pro",
      "meta-llama/llama-3.1-70b-instruct",
      "anthropic/claude-3.5-sonnet",
      "mistralai/mistral-large",
      "deepseek/deepseek-chat",
    ],
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    models: [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
};

export { PROVIDER_PRESETS };

export function useApiKeys() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["api-keys-config"],
    queryFn: async (): Promise<ApiKeyEntry[]> => {
      const { data, error } = await (supabase.from as any)("api_keys_config")
        .select("*")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ApiKeyEntry[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const addKey = useMutation({
    mutationFn: async (entry: NewApiKeyEntry) => {
      const { data, error } = await (supabase.from as any)("api_keys_config")
        .insert({
          provider: entry.provider,
          model_name: entry.model_name,
          api_key: entry.api_key,
          is_active: entry.is_active ?? true,
          priority: entry.priority ?? 0,
          label: entry.label || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ApiKeyEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys-config"] });
      toast({ title: "API key added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add API key", description: err.message, variant: "destructive" });
    },
  });

  const updateKey = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ApiKeyEntry> & { id: string }) => {
      const { error } = await (supabase.from as any)("api_keys_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys-config"] });
      toast({ title: "API key updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("api_keys_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys-config"] });
      toast({ title: "API key deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from as any)("api_keys_config")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys-config"] });
    },
  });

  return {
    keys: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    addKey,
    updateKey,
    deleteKey,
    toggleActive,
    refetch: query.refetch,
  };
}
