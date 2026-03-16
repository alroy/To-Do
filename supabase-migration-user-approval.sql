-- Migration: Add user approval system
-- New users require manual approval from admin before they can use the app.
-- Only the super admin (gil.alroy@gmail.com) is auto-approved.

-- 1. Add approved column to user_profile
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Approve all existing users (they were previously whitelisted)
UPDATE user_profile SET approved = TRUE;

-- 3. Update the auto-profile trigger to auto-approve the super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, name, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.email = 'gil.alroy@gmail.com' THEN TRUE ELSE FALSE END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
