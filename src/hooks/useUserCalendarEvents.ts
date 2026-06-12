import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CalendarEventType } from "@/lib/calendarEvents";

/** The subset of calendar event types a user can pick for their own dates. */
export type UserCalendarEventType = Extract<
  CalendarEventType,
  "exam_date" | "apply_end" | "admit_card" | "result"
>;

export interface UserCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  event_type: UserCalendarEventType;
  event_date: string; // 'YYYY-MM-DD'
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewUserCalendarEvent {
  title: string;
  event_type: UserCalendarEventType;
  event_date: string; // 'YYYY-MM-DD'
  note?: string | null;
}

export function useUserCalendarEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["user_calendar_events", user?.id];

  const eventsQuery = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async (): Promise<UserCalendarEvent[]> => {
      // Table not yet in generated Supabase types — cast required.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("user_calendar_events")
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserCalendarEvent[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const addEvent = useMutation({
    mutationFn: async (event: NewUserCalendarEvent) => {
      if (!user?.id) throw new Error("Not authenticated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("user_calendar_events")
        .insert({
          user_id: user.id,
          title: event.title.trim(),
          event_type: event.event_type,
          event_date: event.event_date,
          note: event.note?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as UserCalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Date added to your calendar");
    },
    onError: (error: Error) => {
      toast.error("Failed to add date: " + error.message);
    },
  });

  const removeEvent = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("user_calendar_events")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Date removed");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove date: " + error.message);
    },
  });

  return {
    userEvents: eventsQuery.data ?? [],
    isLoading: eventsQuery.isLoading,
    addEvent,
    removeEvent,
  };
}
