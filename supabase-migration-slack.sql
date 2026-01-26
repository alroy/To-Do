-- Slack Integration Migration
-- Run this in Supabase SQL Editor to enable Slack integration

-- ============================================
-- Table: slack_connections
-- Stores Slack OAuth tokens linked to Knots users
-- ============================================
CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT,
  bot_user_id TEXT,
  slack_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id, team_id)
);

-- Index for looking up connections by team
CREATE INDEX IF NOT EXISTS slack_connections_team_id_idx ON slack_connections(team_id);

-- Index for looking up active connections
CREATE INDEX IF NOT EXISTS slack_connections_active_idx ON slack_connections(team_id, slack_user_id) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connections
CREATE POLICY "Users can view own slack connections" ON slack_connections
  FOR SELECT USING (auth.uid() = user_id);

-- Users can soft-delete (revoke) their own connections
CREATE POLICY "Users can update own slack connections" ON slack_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for OAuth callback)
CREATE POLICY "Service role full access to slack connections" ON slack_connections
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Table: slack_event_ingest
-- Stores raw Slack events for audit and deduplication
-- ============================================
CREATE TABLE IF NOT EXISTS slack_event_ingest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_time BIGINT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, event_id)
);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS slack_event_ingest_status_idx ON slack_event_ingest(status);

-- Index for recent events
CREATE INDEX IF NOT EXISTS slack_event_ingest_created_at_idx ON slack_event_ingest(created_at DESC);

-- Enable RLS - service role only for security
ALTER TABLE slack_event_ingest ENABLE ROW LEVEL SECURITY;

-- Only service role can access event ingest table
CREATE POLICY "Service role only access to slack events" ON slack_event_ingest
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Verification query (run after migration)
-- ============================================
-- SELECT
--   table_name,
--   (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
-- FROM information_schema.tables t
-- WHERE table_name IN ('slack_connections', 'slack_event_ingest');
