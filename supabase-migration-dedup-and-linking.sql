-- Dedup & Linking Migration
-- Adds goal_id FK on tasks for task-to-goal linking
-- Adds morning_brief table for caching daily AI briefs

-- ============================================
-- Add goal_id to tasks table
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_goal_id_idx ON tasks(goal_id) WHERE goal_id IS NOT NULL;

-- ============================================
-- Morning Brief cache table
-- ============================================

CREATE TABLE IF NOT EXISTS morning_brief (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT morning_brief_user_date_unique UNIQUE (user_id, brief_date)
);

-- RLS
ALTER TABLE morning_brief ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefs" ON morning_brief
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own briefs" ON morning_brief
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own briefs" ON morning_brief
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own briefs" ON morning_brief
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Verification
-- ============================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name = 'goal_id';
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'morning_brief';
