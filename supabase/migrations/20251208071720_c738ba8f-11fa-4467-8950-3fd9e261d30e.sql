-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure encryption key in vault (if vault extension available)
-- We'll use a combination of user_id and a master key for per-user encryption

-- Create function to encrypt sensitive data (only owner can encrypt their data)
CREATE OR REPLACE FUNCTION encrypt_sensitive_field(field_value TEXT, owner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Only allow the owner to encrypt their data
  IF auth.uid() IS NULL OR auth.uid() != owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only data owner can encrypt';
  END IF;
  
  IF field_value IS NULL OR field_value = '' THEN
    RETURN NULL;
  END IF;
  
  -- Create a unique key per user using their ID + a salt
  encryption_key := owner_id::TEXT || '_lovable_secure_salt_2024';
  
  -- Encrypt using AES with the derived key
  RETURN encode(
    pgp_sym_encrypt(field_value, encryption_key),
    'base64'
  );
END;
$$;

-- Create function to decrypt sensitive data (only owner can decrypt their data)
CREATE OR REPLACE FUNCTION decrypt_sensitive_field(encrypted_value TEXT, owner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Only allow the owner to decrypt their data
  IF auth.uid() IS NULL OR auth.uid() != owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only data owner can decrypt';
  END IF;
  
  IF encrypted_value IS NULL OR encrypted_value = '' THEN
    RETURN NULL;
  END IF;
  
  -- Create the same unique key
  encryption_key := owner_id::TEXT || '_lovable_secure_salt_2024';
  
  -- Decrypt
  RETURN pgp_sym_decrypt(
    decode(encrypted_value, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if decryption fails (e.g., data wasn't encrypted)
    RETURN NULL;
END;
$$;

-- Add encrypted columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS aadhar_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS pan_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS passport_number_encrypted TEXT;

-- Create trigger function to auto-encrypt on insert/update
CREATE OR REPLACE FUNCTION encrypt_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Generate encryption key for this user
  encryption_key := NEW.user_id::TEXT || '_lovable_secure_salt_2024';
  
  -- Encrypt aadhar_number if provided
  IF NEW.aadhar_number IS NOT NULL AND NEW.aadhar_number != '' THEN
    NEW.aadhar_number_encrypted := encode(
      pgp_sym_encrypt(NEW.aadhar_number, encryption_key),
      'base64'
    );
    -- Clear the plain text field
    NEW.aadhar_number := '****' || RIGHT(NEW.aadhar_number, 4);
  END IF;
  
  -- Encrypt pan_number if provided
  IF NEW.pan_number IS NOT NULL AND NEW.pan_number != '' AND LENGTH(NEW.pan_number) > 4 THEN
    NEW.pan_number_encrypted := encode(
      pgp_sym_encrypt(NEW.pan_number, encryption_key),
      'base64'
    );
    -- Clear the plain text field (keep last 4 chars for display)
    NEW.pan_number := '****' || RIGHT(NEW.pan_number, 4);
  END IF;
  
  -- Encrypt passport_number if provided
  IF NEW.passport_number IS NOT NULL AND NEW.passport_number != '' AND LENGTH(NEW.passport_number) > 4 THEN
    NEW.passport_number_encrypted := encode(
      pgp_sym_encrypt(NEW.passport_number, encryption_key),
      'base64'
    );
    -- Clear the plain text field (keep last 4 chars for display)
    NEW.passport_number := '****' || RIGHT(NEW.passport_number, 4);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for insert and update
DROP TRIGGER IF EXISTS encrypt_sensitive_on_insert ON public.profiles;
CREATE TRIGGER encrypt_sensitive_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_profile_sensitive_fields();

DROP TRIGGER IF EXISTS encrypt_sensitive_on_update ON public.profiles;
CREATE TRIGGER encrypt_sensitive_on_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_profile_sensitive_fields();

-- Create a view function for the owner to get decrypted values
CREATE OR REPLACE FUNCTION get_my_decrypted_profile()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  aadhar_number_decrypted TEXT,
  pan_number_decrypted TEXT,
  passport_number_decrypted TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  encryption_key := auth.uid()::TEXT || '_lovable_secure_salt_2024';
  
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    CASE 
      WHEN p.aadhar_number_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(decode(p.aadhar_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS aadhar_number_decrypted,
    CASE 
      WHEN p.pan_number_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(decode(p.pan_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS pan_number_decrypted,
    CASE 
      WHEN p.passport_number_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(decode(p.passport_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS passport_number_decrypted
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;