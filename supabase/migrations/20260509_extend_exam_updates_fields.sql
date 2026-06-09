-- Migration: Add extended article fields to exam_updates
-- These fields are populated by article_scraper.py and needed for full fidelity storage
ALTER TABLE exam_updates
    ADD COLUMN IF NOT EXISTS full_text        TEXT,
    ADD COLUMN IF NOT EXISTS vacancy_table    JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fee_table        JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS eligibility_table JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cutoff_table     JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS official_links   JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS related_links    JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS images           JSONB DEFAULT '[]'::jsonb;
