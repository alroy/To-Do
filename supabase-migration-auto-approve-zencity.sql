-- Migration: Auto-approve @zencity.io users + onboarding tracking
-- Zencity employees should skip the "Registration Pending" wait.
-- New users must complete onboarding before accessing the app.

-- 1. Add onboarded column (defaults TRUE so existing users are grandfathered in)
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Update the trigger to auto-approve @zencity.io emails and mark new users as not onboarded
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, name, approved, onboarded)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.email = 'gil.alroy@gmail.com' THEN TRUE
      WHEN NEW.email LIKE '%@zencity.io' THEN TRUE
      ELSE FALSE
    END,
    FALSE
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Retroactively approve any existing @zencity.io users still pending
UPDATE user_profile SET approved = TRUE
WHERE approved = FALSE
  AND user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%@zencity.io'
  );
