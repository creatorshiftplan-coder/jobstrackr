-- Migration: Create queue claimer database function for concurrency safety
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.claim_next_notifications_batch(batch_size INT)
RETURNS SETOF public.telegram_notifications_queue AS $$
DECLARE
  claimed_ids UUID[];
BEGIN
  -- Select IDs to claim using FOR UPDATE SKIP LOCKED to prevent duplicate processing
  SELECT COALESCE(array_agg(id), '{}'::UUID[]) INTO claimed_ids FROM (
    SELECT id 
    FROM public.telegram_notifications_queue
    WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ) sub;
  
  IF cardinality(claimed_ids) = 0 THEN
    RETURN;
  END IF;

  -- Mark them as processing to protect them from other cron runs/invocations
  RETURN QUERY
  UPDATE public.telegram_notifications_queue
  SET status = 'processing', processed_at = NOW()
  WHERE id = ANY(claimed_ids)
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
