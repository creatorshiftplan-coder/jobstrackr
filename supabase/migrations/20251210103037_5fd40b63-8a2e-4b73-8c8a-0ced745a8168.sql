-- Update check_user_rate_limit function to include per-minute limit
CREATE OR REPLACE FUNCTION public.check_user_rate_limit(_user_id uuid, _daily_limit integer, _minute_limit integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _used INTEGER;
  _reset_time TIMESTAMPTZ;
  _minute_ago TIMESTAMPTZ;
  _requests_last_minute INTEGER;
BEGIN
  -- Get IST reset time (00:01 IST)
  _reset_time := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '1 minute';
  _minute_ago := now() - interval '1 minute';
  
  -- Count today's API calls
  SELECT COUNT(*) INTO _used
  FROM public.update_logs
  WHERE user_id = _user_id
    AND created_at >= _reset_time;
  
  -- Count requests in last minute
  SELECT COUNT(*) INTO _requests_last_minute
  FROM public.update_logs
  WHERE user_id = _user_id
    AND created_at >= _minute_ago;
  
  -- Check both limits
  RETURN jsonb_build_object(
    'allowed', _used < _daily_limit AND _requests_last_minute < _minute_limit,
    'used', _used,
    'limit', _daily_limit,
    'minute_used', _requests_last_minute,
    'minute_limit', _minute_limit,
    'rate_limited', _requests_last_minute >= _minute_limit,
    'resets_at', _reset_time + interval '1 day'
  );
END;
$function$;