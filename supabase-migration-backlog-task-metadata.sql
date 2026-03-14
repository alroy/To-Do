-- Add task metadata columns to backlog table for analytics tracking
-- When tasks are completed and moved to backlog, these columns preserve
-- the original source, goal link, and creation time.

ALTER TABLE backlog ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE backlog ADD COLUMN IF NOT EXISTS goal_id UUID DEFAULT NULL REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE backlog ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ DEFAULT NULL;
