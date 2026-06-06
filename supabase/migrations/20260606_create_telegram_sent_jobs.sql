-- Migration: Create telegram_sent_jobs table for tracking and preventing duplicates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.telegram_sent_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    update_id UUID REFERENCES public.exam_updates(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    CONSTRAINT job_or_update_present CHECK (
        (job_id IS NOT NULL AND update_id IS NULL) OR 
        (job_id IS NULL AND update_id IS NOT NULL)
    ),
    CONSTRAINT unique_job_per_channel UNIQUE(job_id, channel_id),
    CONSTRAINT unique_update_per_channel UNIQUE(update_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.telegram_sent_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: only admins and data_entry can view/manage telegram logs
CREATE POLICY "Admins can view telegram_sent_jobs" ON public.telegram_sent_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can insert telegram_sent_jobs" ON public.telegram_sent_jobs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can delete telegram_sent_jobs" ON public.telegram_sent_jobs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
