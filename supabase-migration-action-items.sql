-- Migration: Upgrade existing action_items table
-- Adds user_id column, RLS policies, indexes, and realtime support.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE where possible).

-- 1. Add user_id column (nullable first so existing rows aren't rejected)
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. Backfill user_id for existing rows (set to the single app user)
-- Replace the UUID below with your actual Supabase user ID, or run:
--   SELECT id FROM auth.users LIMIT 1;
-- and paste the result here.
-- UPDATE action_items SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;

-- 3. After backfilling, make user_id NOT NULL
-- (Uncomment after running the UPDATE above)
-- ALTER TABLE action_items ALTER COLUMN user_id SET NOT NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_scan ON action_items(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_action_items_source ON action_items(source);
CREATE INDEX IF NOT EXISTS idx_action_items_message_link ON action_items(message_link);
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);

-- 5. Enable RLS
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies (drop first to avoid "already exists" errors)
DROP POLICY IF EXISTS "Users can view their own action items" ON action_items;
CREATE POLICY "Users can view their own action items"
  ON action_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own action items" ON action_items;
CREATE POLICY "Users can update their own action items"
  ON action_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert action items" ON action_items;
CREATE POLICY "Service role can insert action items"
  ON action_items FOR INSERT
  WITH CHECK (true);

-- 7. Enable realtime for cross-tab sync
ALTER TABLE action_items REPLICA IDENTITY FULL;
