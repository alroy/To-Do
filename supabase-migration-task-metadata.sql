-- Task Metadata Migration
-- Adds JSONB metadata column to tasks table for storing Slack context
-- Run this in Supabase SQL Editor

-- ============================================
-- Step 1: Add metadata column
-- ============================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================
-- Step 2: Add index for querying by source type
-- This allows efficient queries like: WHERE metadata->'source'->>'type' = 'slack'
-- ============================================
CREATE INDEX IF NOT EXISTS tasks_metadata_source_type_idx
  ON tasks ((metadata->'source'->>'type'))
  WHERE metadata IS NOT NULL;

-- ============================================
-- Step 3: Add comment documenting the schema
-- ============================================
COMMENT ON COLUMN tasks.metadata IS 'Optional JSON metadata. Schema for Slack tasks:
{
  "source": {
    "type": "slack",
    "subtype": "dm" | "mention",
    "team_id": "T123...",
    "channel_id": "C123...",
    "message_ts": "1700000000.0000",
    "permalink": "https://slack.com/...",
    "author": {
      "slack_user_id": "U123...",
      "display_name": "Name"
    }
  },
  "raw": {
    "slack_text": "original message"
  }
}';

-- ============================================
-- Verification query (run after migration)
-- ============================================
-- SELECT
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name = 'metadata';

-- Expected output:
-- column_name | data_type | is_nullable
-- ------------+-----------+------------
-- metadata    | jsonb     | YES
