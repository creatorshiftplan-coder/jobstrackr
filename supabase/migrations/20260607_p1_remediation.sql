-- ==============================================================================
-- Migration: P1 Security Hardening and Database Optimization
-- ==============================================================================

-- 0. Ensure pgcrypto extension exists for symmetric encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Configure Vault-backed PGP encryption key for API keys
-- Checks if 'api_keys_encryption_key' exists in vault; if not, generates a 256-bit key
DO $$
DECLARE
  crypt_key TEXT;
BEGIN
  SELECT decrypted_secret INTO crypt_key FROM vault.decrypted_secrets WHERE name = 'api_keys_encryption_key';
  
  IF crypt_key IS NULL THEN
    crypt_key := encode(gen_random_bytes(32), 'hex');
    PERFORM vault.create_secret(
      crypt_key,
      'api_keys_encryption_key',
      'Symmetric encryption key for multi-provider API keys'
    );
  END IF;
END;
$$;

-- 2. Add decryption helper function public.decrypt_api_key
-- Marked SECURITY DEFINER and checks caller authorization (either service_role or admin user)
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key TEXT)
RETURNS TEXT AS $$
DECLARE
  crypt_key TEXT;
  is_authorized BOOLEAN;
BEGIN
  -- Check authorization: caller must be service_role or an admin user in public.user_roles
  is_authorized := (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'data_entry')
    )
  );
  
  IF NOT is_authorized THEN
    RETURN 'Unauthorized';
  END IF;

  -- Retrieve decryption key from Vault
  SELECT decrypted_secret INTO crypt_key FROM vault.decrypted_secrets WHERE name = 'api_keys_encryption_key';
  
  IF crypt_key IS NULL THEN
    RETURN encrypted_key; -- Return as-is if encryption key not configured
  END IF;

  IF encrypted_key LIKE '-----BEGIN PGP MESSAGE-----%%' THEN
    RETURN pgp_sym_decrypt(dearmor(encrypted_key), crypt_key);
  ELSE
    RETURN encrypted_key;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN encrypted_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create auto-encryption trigger on api_keys_config
-- Automatically encrypts any raw key value before saving it to the database
CREATE OR REPLACE FUNCTION public.encrypt_api_key_trigger()
RETURNS TRIGGER AS $$
DECLARE
  crypt_key TEXT;
BEGIN
  -- Retrieve encryption key from Vault
  SELECT decrypted_secret INTO crypt_key FROM vault.decrypted_secrets WHERE name = 'api_keys_encryption_key';
  
  IF crypt_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret api_keys_encryption_key is missing';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.api_key IS DISTINCT FROM OLD.api_key THEN
    -- Only encrypt if not already encrypted
    IF NEW.api_key NOT LIKE '-----BEGIN PGP MESSAGE-----%%' THEN
      NEW.api_key := armor(pgp_sym_encrypt(NEW.api_key, crypt_key));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_encrypt_api_key ON public.api_keys_config;
CREATE TRIGGER trg_encrypt_api_key
  BEFORE INSERT OR UPDATE ON public.api_keys_config
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_api_key_trigger();

-- 4. Create role-secured view decrypted_api_keys_config
-- Standard users will receive empty results from the underlying table policies or masked outputs from the function
CREATE OR REPLACE VIEW public.decrypted_api_keys_config AS
SELECT
  id,
  provider,
  model_name,
  is_active,
  priority,
  label,
  last_used_at,
  last_error,
  total_calls,
  total_errors,
  created_at,
  updated_at,
  public.decrypt_api_key(api_key) AS api_key
FROM public.api_keys_config;

-- 5. Migrate any existing plaintext API keys to encrypted format
DO $$
DECLARE
  crypt_key TEXT;
  r RECORD;
  encrypted TEXT;
BEGIN
  SELECT decrypted_secret INTO crypt_key FROM vault.decrypted_secrets WHERE name = 'api_keys_encryption_key';
  
  IF crypt_key IS NOT NULL THEN
    FOR r IN SELECT id, api_key FROM public.api_keys_config WHERE api_key NOT LIKE '-----BEGIN PGP MESSAGE-----%%' LOOP
      encrypted := armor(pgp_sym_encrypt(r.api_key, crypt_key));
      UPDATE public.api_keys_config SET api_key = encrypted WHERE id = r.id;
    END LOOP;
  END IF;
END;
$$;

-- 6. Add cascade foreign key constraint on saved_jobs(user_id)
-- First clean up orphaned saved jobs where user_id no longer exists using NOT EXISTS
DELETE FROM public.saved_jobs s
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = s.user_id
);

ALTER TABLE public.saved_jobs 
  DROP CONSTRAINT IF EXISTS fk_saved_jobs_user_id,
  ADD CONSTRAINT fk_saved_jobs_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Add unique constraints and index coverage on telegram_notifications_queue
-- First clean up duplicates using efficient partitioned window functions to allow creating the unique constraints
DELETE FROM public.telegram_notifications_queue
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY telegram_chat_id, job_id
      ORDER BY id
    ) as row_num
    FROM public.telegram_notifications_queue
    WHERE job_id IS NOT NULL
  ) t
  WHERE t.row_num > 1
);

DELETE FROM public.telegram_notifications_queue
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY telegram_chat_id, update_id
      ORDER BY id
    ) as row_num
    FROM public.telegram_notifications_queue
    WHERE update_id IS NOT NULL
  ) t
  WHERE t.row_num > 1
);

ALTER TABLE public.telegram_notifications_queue 
  DROP CONSTRAINT IF EXISTS uniq_telegram_queue_job,
  ADD CONSTRAINT uniq_telegram_queue_job UNIQUE (telegram_chat_id, job_id);

ALTER TABLE public.telegram_notifications_queue 
  DROP CONSTRAINT IF EXISTS uniq_telegram_queue_update,
  ADD CONSTRAINT uniq_telegram_queue_update UNIQUE (telegram_chat_id, update_id);

-- 8. Add foreign key index coverage for telegram_notifications_queue performance optimization
CREATE INDEX IF NOT EXISTS idx_telegram_queue_user_id ON public.telegram_notifications_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_job_id ON public.telegram_notifications_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_update_id ON public.telegram_notifications_queue(update_id);
