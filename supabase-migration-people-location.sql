-- Add optional location column to people table
-- Allowed values: 'Tel Aviv', 'London', 'New York', 'Vancouver', or NULL

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL
  CHECK (location IS NULL OR location IN ('Tel Aviv', 'London', 'New York', 'Vancouver'));
