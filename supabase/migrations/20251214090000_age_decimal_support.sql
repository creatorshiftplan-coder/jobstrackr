-- Change age_min and age_max from INTEGER to NUMERIC to support decimal values
ALTER TABLE jobs ALTER COLUMN age_min TYPE NUMERIC(4,1);
ALTER TABLE jobs ALTER COLUMN age_max TYPE NUMERIC(4,1);
