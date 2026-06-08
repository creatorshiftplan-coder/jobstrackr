-- Migration: Add stuck queue recovery helper function
-- ==============================================================================

-- Function to release notifications stuck in 'processing' state (e.g. worker timeouts)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_telegram_notifications()
RETURNS void AS $$
BEGIN
  UPDATE public.telegram_notifications_queue
  SET status = 'pending', processed_at = NULL
  WHERE status = 'processing' AND processed_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
