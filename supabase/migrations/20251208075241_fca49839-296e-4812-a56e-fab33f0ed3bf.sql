-- Fix pgcrypto extension and encryption functions
-- Drop existing functions first
DROP FUNCTION IF EXISTS public.encrypt_sensitive_field(text, uuid);
DROP FUNCTION IF EXISTS public.decrypt_sensitive_field(text, uuid);
DROP FUNCTION IF EXISTS public.encrypt_profile_sensitive_fields() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_decrypted_profile();

-- Enable pgcrypto properly in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate encryption function using extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(field_value text, owner_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only data owner can encrypt';
  END IF;
  
  IF field_value IS NULL OR field_value = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := owner_id::TEXT || '_lovable_secure_salt_2024';
  
  RETURN encode(
    extensions.pgp_sym_encrypt(field_value, encryption_key),
    'base64'
  );
END;
$function$;

-- Recreate decryption function
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_field(encrypted_value text, owner_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Only data owner can decrypt';
  END IF;
  
  IF encrypted_value IS NULL OR encrypted_value = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := owner_id::TEXT || '_lovable_secure_salt_2024';
  
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_value, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

-- Recreate trigger function
CREATE OR REPLACE FUNCTION public.encrypt_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := NEW.user_id::TEXT || '_lovable_secure_salt_2024';
  
  IF NEW.aadhar_number IS NOT NULL AND NEW.aadhar_number != '' AND LEFT(NEW.aadhar_number, 4) != '****' THEN
    NEW.aadhar_number_encrypted := encode(
      extensions.pgp_sym_encrypt(NEW.aadhar_number, encryption_key),
      'base64'
    );
    NEW.aadhar_number := '****' || RIGHT(NEW.aadhar_number, 4);
  END IF;
  
  IF NEW.pan_number IS NOT NULL AND NEW.pan_number != '' AND LENGTH(NEW.pan_number) > 4 AND LEFT(NEW.pan_number, 4) != '****' THEN
    NEW.pan_number_encrypted := encode(
      extensions.pgp_sym_encrypt(NEW.pan_number, encryption_key),
      'base64'
    );
    NEW.pan_number := '****' || RIGHT(NEW.pan_number, 4);
  END IF;
  
  IF NEW.passport_number IS NOT NULL AND NEW.passport_number != '' AND LENGTH(NEW.passport_number) > 4 AND LEFT(NEW.passport_number, 4) != '****' THEN
    NEW.passport_number_encrypted := encode(
      extensions.pgp_sym_encrypt(NEW.passport_number, encryption_key),
      'base64'
    );
    NEW.passport_number := '****' || RIGHT(NEW.passport_number, 4);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate get_my_decrypted_profile function
CREATE OR REPLACE FUNCTION public.get_my_decrypted_profile()
 RETURNS TABLE(id uuid, user_id uuid, full_name text, aadhar_number_decrypted text, pan_number_decrypted text, passport_number_decrypted text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        extensions.pgp_sym_decrypt(decode(p.aadhar_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS aadhar_number_decrypted,
    CASE 
      WHEN p.pan_number_encrypted IS NOT NULL THEN 
        extensions.pgp_sym_decrypt(decode(p.pan_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS pan_number_decrypted,
    CASE 
      WHEN p.passport_number_encrypted IS NOT NULL THEN 
        extensions.pgp_sym_decrypt(decode(p.passport_number_encrypted, 'base64'), encryption_key)
      ELSE NULL
    END AS passport_number_decrypted
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$function$;

-- Recreate triggers on profiles table
DROP TRIGGER IF EXISTS encrypt_sensitive_on_insert ON public.profiles;
DROP TRIGGER IF EXISTS encrypt_sensitive_on_update ON public.profiles;

CREATE TRIGGER encrypt_sensitive_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_profile_sensitive_fields();

CREATE TRIGGER encrypt_sensitive_on_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_profile_sensitive_fields();

-- Change education date_of_passing to TEXT for flexible format
ALTER TABLE public.education_qualifications 
ALTER COLUMN date_of_passing TYPE TEXT USING date_of_passing::TEXT;

-- Add passing_year for sorting
ALTER TABLE public.education_qualifications 
ADD COLUMN IF NOT EXISTS passing_year INTEGER;