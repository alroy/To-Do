-- Migration to add user authentication to tasks table
-- Run this in your Supabase SQL Editor

-- 1. Add user_id column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- 5. Create RLS policies
-- Users can only view their own tasks
CREATE POLICY "Users can view their own tasks"
ON tasks FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert tasks with their own user_id
CREATE POLICY "Users can insert their own tasks"
ON tasks FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own tasks
CREATE POLICY "Users can update their own tasks"
ON tasks FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own tasks
CREATE POLICY "Users can delete their own tasks"
ON tasks FOR DELETE
USING (auth.uid() = user_id);

-- 6. Create function to automatically set user_id
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger to automatically set user_id on insert
DROP TRIGGER IF EXISTS set_user_id_trigger ON tasks;
CREATE TRIGGER set_user_id_trigger
BEFORE INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_user_id();

-- Optional: Update existing rows to set user_id to the first user (if any exists)
-- Uncomment and modify if needed:
-- UPDATE tasks SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
