-- Migration: Create tables, triggers, and RLS policies for Telegram user notification system
-- ==============================================================================

-- 1. Create telegram_connections table
CREATE TABLE IF NOT EXISTS public.telegram_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user/chat lookups
CREATE INDEX IF NOT EXISTS idx_telegram_connections_user_id ON public.telegram_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_connections_chat_id ON public.telegram_connections(telegram_chat_id);

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    
    -- Job Categories
    ssc BOOLEAN DEFAULT FALSE NOT NULL,
    upsc BOOLEAN DEFAULT FALSE NOT NULL,
    railway BOOLEAN DEFAULT FALSE NOT NULL,
    banking BOOLEAN DEFAULT FALSE NOT NULL,
    defence BOOLEAN DEFAULT FALSE NOT NULL,
    psu BOOLEAN DEFAULT FALSE NOT NULL,
    state_psc BOOLEAN DEFAULT FALSE NOT NULL,
    healthcare BOOLEAN DEFAULT FALSE NOT NULL,
    teaching BOOLEAN DEFAULT FALSE NOT NULL,
    judiciary BOOLEAN DEFAULT FALSE NOT NULL,
    stenographer BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Alert Types
    job_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    admit_card_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    result_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    answer_key_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Location Preferences
    preferred_states TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    preferred_regions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    
    -- Qualification Preferences
    tenth_pass BOOLEAN DEFAULT FALSE NOT NULL,
    twelfth_pass BOOLEAN DEFAULT FALSE NOT NULL,
    graduate BOOLEAN DEFAULT FALSE NOT NULL,
    postgraduate BOOLEAN DEFAULT FALSE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create telegram_notifications_queue table for tracking and rate-limiting
CREATE TABLE IF NOT EXISTS public.telegram_notifications_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id TEXT NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    update_id UUID REFERENCES public.exam_updates(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'sent', 'failed'
    retry_count INT DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMPTZ,
    
    CONSTRAINT job_or_update_present CHECK (
        (job_id IS NOT NULL AND update_id IS NULL) OR 
        (job_id IS NULL AND update_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_telegram_queue_status_created ON public.telegram_notifications_queue(status, created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notifications_queue ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Telegram Connections Policies
CREATE POLICY "Users can view their own Telegram connections" ON public.telegram_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Telegram connections" ON public.telegram_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Telegram connections" ON public.telegram_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Telegram connections" ON public.telegram_connections
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all Telegram connections" ON public.telegram_connections
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Notification Preferences Policies
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences" ON public.notification_preferences
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Queue policies
CREATE POLICY "Users can view their own queued notifications" ON public.telegram_notifications_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins/Service can view all queued notifications" ON public.telegram_notifications_queue
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'data_entry'))
    );

-- 6. Trigger: Auto-create notification_preferences row on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_created_preferences ON public.profiles;
CREATE TRIGGER on_profile_created_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_preferences();

-- 7. Backfill existing users
INSERT INTO public.notification_preferences (user_id)
SELECT user_id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
