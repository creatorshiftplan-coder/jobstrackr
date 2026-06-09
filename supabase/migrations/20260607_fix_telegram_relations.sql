-- Add direct foreign key constraints to allow PostgREST to resolve relationships in the public schema

-- 1. Ensure notification_preferences.user_id references profiles.user_id
ALTER TABLE public.notification_preferences
DROP CONSTRAINT IF EXISTS fk_notification_preferences_profile;

ALTER TABLE public.notification_preferences
ADD CONSTRAINT fk_notification_preferences_profile
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 2. Ensure telegram_connections.user_id references notification_preferences.user_id
ALTER TABLE public.telegram_connections
DROP CONSTRAINT IF EXISTS fk_telegram_connections_preferences;

ALTER TABLE public.telegram_connections
ADD CONSTRAINT fk_telegram_connections_preferences
FOREIGN KEY (user_id) REFERENCES public.notification_preferences(user_id) ON DELETE CASCADE;
