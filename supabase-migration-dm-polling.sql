-- Migration: Add columns for user DM polling
-- Stores user OAuth token (separate from bot token) and poll watermark

ALTER TABLE slack_connections
  ADD COLUMN IF NOT EXISTS user_access_token TEXT,
  ADD COLUMN IF NOT EXISTS user_scope TEXT,
  ADD COLUMN IF NOT EXISTS last_dm_poll_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN slack_connections.user_access_token IS 'User OAuth token for reading DMs (requires im:history, im:read scopes)';
COMMENT ON COLUMN slack_connections.last_dm_poll_at IS 'Watermark timestamp for DM polling - only fetch messages after this time';
