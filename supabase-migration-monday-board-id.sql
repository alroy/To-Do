-- Migration: Ensure monday_connections table has the board_id column.
-- Safe to run multiple times.

-- Add board_id if missing
ALTER TABLE monday_connections ADD COLUMN IF NOT EXISTS board_id text;

-- Reload PostgREST schema cache so the column is immediately usable
NOTIFY pgrst, 'reload schema';
