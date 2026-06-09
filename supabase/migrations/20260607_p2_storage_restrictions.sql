-- ==============================================================================
-- Migration: P2 Storage Upload Restrictions and Hardening
-- ==============================================================================

-- 1. Redefine upload (INSERT) policy with size and type constraints
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  -- Limit maximum file size to 10MB (10485760 bytes)
  AND (
    (metadata->>'size')::bigint <= 10485760
  )
  -- Allow only trusted MIME types (JPEG, PNG, WebP images, and PDF files)
  AND (
    metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);

-- 2. Redefine update (UPDATE) policy with size and type constraints
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  -- Limit maximum file size to 10MB (10485760 bytes)
  AND (
    (metadata->>'size')::bigint <= 10485760
  )
  -- Allow only trusted MIME types (JPEG, PNG, WebP images, and PDF files)
  AND (
    metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);
