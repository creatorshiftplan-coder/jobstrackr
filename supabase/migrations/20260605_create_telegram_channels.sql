-- Migration: Create telegram_channels table for admin panel
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.telegram_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    sector TEXT NOT NULL DEFAULT 'All Jobs',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

-- Policies: only admins can manage/view telegram channels
CREATE POLICY "Admins can view telegram_channels" ON public.telegram_channels
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can insert telegram_channels" ON public.telegram_channels
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update telegram_channels" ON public.telegram_channels
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete telegram_channels" ON public.telegram_channels
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
