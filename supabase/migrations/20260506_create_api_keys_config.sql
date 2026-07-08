-- API Keys Configuration table for multi-provider key rotation
CREATE TABLE IF NOT EXISTS public.api_keys_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'gemini',
  model_name text NOT NULL DEFAULT 'gemini-3.5-flash',
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  label text,
  last_used_at timestamptz,
  last_error text,
  total_calls integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only admins should read/write this table
ALTER TABLE public.api_keys_config ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role full access" ON public.api_keys_config
  FOR ALL USING (true) WITH CHECK (true);

-- Allow admins to manage keys via the client
CREATE POLICY "Admins can manage api keys" ON public.api_keys_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'data_entry')
    )
  );

-- Index for active key lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_active_priority
  ON public.api_keys_config (is_active, priority)
  WHERE is_active = true;
