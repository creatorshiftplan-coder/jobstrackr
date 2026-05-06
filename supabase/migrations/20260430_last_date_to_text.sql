-- Change last_date from DATE to TEXT to allow raw scraped date strings
ALTER TABLE public.jobs ALTER COLUMN last_date TYPE TEXT USING last_date::TEXT;
