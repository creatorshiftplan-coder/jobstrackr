-- ==============================================================================
-- Migration: Suggestions and Grievance Support System
-- ==============================================================================

-- 1. Create suggestions_grievances table
CREATE TABLE IF NOT EXISTS public.suggestions_grievances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT, -- Nullable to allow anonymous submissions
    type TEXT NOT NULL CONSTRAINT check_feedback_type CHECK (type IN ('suggestion', 'grievance')),
    message TEXT NOT NULL CONSTRAINT max_feedback_length CHECK (char_length(message) <= 500),
    status TEXT NOT NULL DEFAULT 'pending' CONSTRAINT check_feedback_status CHECK (status IN ('pending', 'resolved')),
    ip_hash TEXT, -- MD5 hash of submitter IP address for rate-limiting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure ip_hash column exists in case the table was created without it in a previous run
ALTER TABLE public.suggestions_grievances ADD COLUMN IF NOT EXISTS ip_hash TEXT;

-- 2. Enable Row-Level Security
ALTER TABLE public.suggestions_grievances ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Anyone can insert suggestions/grievances" ON public.suggestions_grievances;
CREATE POLICY "Anyone can insert suggestions/grievances" ON public.suggestions_grievances
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view suggestions/grievances" ON public.suggestions_grievances;
CREATE POLICY "Admins can view suggestions/grievances" ON public.suggestions_grievances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update suggestions/grievances" ON public.suggestions_grievances;
CREATE POLICY "Admins can update suggestions/grievances" ON public.suggestions_grievances
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- 4. Create Rate Limiting Trigger
CREATE OR REPLACE FUNCTION public.check_feedback_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    client_ip TEXT;
    client_ip_hash TEXT;
    recent_count INT;
BEGIN
    -- Extract client IP address from request headers safely
    BEGIN
        client_ip := coalesce(
            current_setting('request.headers', true)::json->>'x-forwarded-for',
            current_setting('request.headers', true)::json->>'cf-connecting-ip',
            'unknown'
        );
    EXCEPTION WHEN OTHERS THEN
        client_ip := 'unknown';
    END;
    
    client_ip_hash := md5(client_ip);
    
    -- Assign the IP hash to the new row so we can count it
    NEW.ip_hash := client_ip_hash;

    -- Rate Limit 1: Max 5 submissions per hour per user_id (if authenticated)
    IF NEW.user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO recent_count
        FROM public.suggestions_grievances
        WHERE user_id = NEW.user_id
          AND created_at > now() - INTERVAL '1 hour';
          
        IF recent_count >= 5 THEN
            RAISE EXCEPTION 'Rate limit exceeded. You can only submit feedback 5 times per hour.';
        END IF;
    END IF;

    -- Rate Limit 2: Max 5 submissions per hour per connection/IP (except unknown IPs)
    IF client_ip_hash <> md5('unknown') THEN
        SELECT COUNT(*) INTO recent_count
        FROM public.suggestions_grievances
        WHERE ip_hash = client_ip_hash
          AND created_at > now() - INTERVAL '1 hour';
          
        IF recent_count >= 5 THEN
            RAISE EXCEPTION 'Rate limit exceeded. Too many feedback messages from your connection. Please try again later.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS feedback_rate_limit_trigger ON public.suggestions_grievances;
CREATE TRIGGER feedback_rate_limit_trigger
    BEFORE INSERT ON public.suggestions_grievances
    FOR EACH ROW
    EXECUTE FUNCTION public.check_feedback_rate_limit();
