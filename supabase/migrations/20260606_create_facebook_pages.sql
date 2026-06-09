-- Migration: Create facebook_pages and facebook_sent_jobs tables for Facebook posting system
-- =========================================================================================

CREATE TABLE IF NOT EXISTS public.facebook_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    access_token TEXT NOT NULL,
    page_id TEXT NOT NULL,
    sector TEXT NOT NULL DEFAULT 'All Jobs',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.facebook_sent_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    update_id UUID REFERENCES public.exam_updates(id) ON DELETE CASCADE,
    page_id UUID REFERENCES public.facebook_pages(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    CONSTRAINT fb_job_or_update_present CHECK (
        (job_id IS NOT NULL AND update_id IS NULL) OR 
        (job_id IS NULL AND update_id IS NOT NULL)
    ),
    CONSTRAINT unique_job_per_fb_page UNIQUE(job_id, page_id),
    CONSTRAINT unique_update_per_fb_page UNIQUE(update_id, page_id)
);

-- Enable RLS
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_sent_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for facebook_pages
CREATE POLICY "Admins can view facebook_pages" ON public.facebook_pages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can insert facebook_pages" ON public.facebook_pages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update facebook_pages" ON public.facebook_pages
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete facebook_pages" ON public.facebook_pages
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Policies for facebook_sent_jobs
CREATE POLICY "Admins can view facebook_sent_jobs" ON public.facebook_sent_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can insert facebook_sent_jobs" ON public.facebook_sent_jobs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

CREATE POLICY "Admins can delete facebook_sent_jobs" ON public.facebook_sent_jobs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
