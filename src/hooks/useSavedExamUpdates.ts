import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * User-bookmarked exam_updates that power the personal "My Wall" on /countdown.
 * Reads/writes go straight through the Supabase client (RLS-scoped to the user)
 * — no Vercel serverless function involved, mirroring the saved_jobs pattern.
 */
export interface SavedExamUpdateRow {
  update_id: string;
  created_at: string;
}

function savedKey(userId: string | undefined) {
  return ["saved-exam-updates", userId];
}

export function useSavedExamUpdates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: savedKey(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<SavedExamUpdateRow[]> => {
      if (!user?.id) return [];
      // Table not yet in generated Supabase types — cast required.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("saved_exam_updates")
        .select("update_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedExamUpdateRow[];
    },
  });
}

/** Set of bookmarked update_ids for O(1) "is this saved?" checks. */
export function useSavedExamUpdateIds(): Set<string> {
  const { data } = useSavedExamUpdates();
  return new Set((data ?? []).map((r) => r.update_id));
}

export function useToggleSavedExamUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updateId, save }: { updateId: string; save: boolean }) => {
      if (!user?.id) throw new Error("Please login to bookmark exams");

      if (save) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from as any)("saved_exam_updates")
          .insert({ user_id: user.id, update_id: updateId });
        // Ignore duplicate-bookmark races (composite PK conflict).
        if (error && error.code !== "23505") throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from as any)("saved_exam_updates")
          .delete()
          .eq("update_id", updateId)
          .eq("user_id", user.id);
        if (error) throw error;
      }
      return { updateId, save };
    },
    // Optimistic toggle so the bookmark icon flips instantly.
    onMutate: async ({ updateId, save }) => {
      const key = savedKey(user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedExamUpdateRow[]>(key);
      queryClient.setQueryData<SavedExamUpdateRow[]>(key, (old = []) =>
        save
          ? [{ update_id: updateId, created_at: new Date().toISOString() }, ...old]
          : old.filter((r) => r.update_id !== updateId)
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(savedKey(user?.id), ctx.previous);
      toast.error(err.message || "Couldn't update bookmark");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: savedKey(user?.id) });
    },
  });
}
