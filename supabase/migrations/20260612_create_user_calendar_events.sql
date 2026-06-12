-- Migration: Personal (user-added) calendar events
-- ==============================================================================
-- Lets a user add their own dates to the Exam Calendar (e.g. an exam date or a
-- form fill-up / application deadline) alongside the dates derived from tracked
-- exams and saved jobs. Idempotent and safe to run more than once.
--
-- event_type is constrained to the types the calendar already renders
-- (see EVENT_TYPE_CONFIG in src/lib/calendarEvents.ts) so colours/filters work.

CREATE TABLE IF NOT EXISTS public.user_calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'exam_date'
        CHECK (event_type IN ('exam_date', 'apply_end', 'admit_card', 'result')),
    event_date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_events_user_date
    ON public.user_calendar_events (user_id, event_date);

ALTER TABLE public.user_calendar_events ENABLE ROW LEVEL SECURITY;

-- Each user can only see and manage their own personal dates.
DROP POLICY IF EXISTS "Users can view their own calendar events" ON public.user_calendar_events;
CREATE POLICY "Users can view their own calendar events" ON public.user_calendar_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar events" ON public.user_calendar_events;
CREATE POLICY "Users can insert their own calendar events" ON public.user_calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar events" ON public.user_calendar_events;
CREATE POLICY "Users can update their own calendar events" ON public.user_calendar_events
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar events" ON public.user_calendar_events;
CREATE POLICY "Users can delete their own calendar events" ON public.user_calendar_events
    FOR DELETE USING (auth.uid() = user_id);
