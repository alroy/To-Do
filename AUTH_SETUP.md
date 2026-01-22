# Authentication Setup Instructions

## 1. Run Database Migration

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-migration.sql`
4. Run the migration

This will:
- Add `user_id` column to the `tasks` table
- Enable Row Level Security (RLS)
- Create policies so users can only see their own tasks
- Set up automatic user_id assignment

## 2. Configure Authentication Providers

### Google OAuth Setup

1. Go to your Supabase dashboard → Authentication → Providers
2. Enable Google provider
3. Configure Google OAuth:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase
4. Save the configuration

### Email Magic Link Setup

1. Go to your Supabase dashboard → Authentication → Providers
2. Email provider should be enabled by default
3. Configure email templates if needed:
   - Navigate to Authentication → Email Templates
   - Customize the "Magic Link" template (optional)

## 3. Update Site URL

1. Go to Authentication → URL Configuration
2. Set Site URL to your production URL: `https://v0-knots-taker.vercel.app`
3. Add to Redirect URLs:
   - `https://v0-knots-taker.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local development)

## 4. Test the Authentication Flow

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to `/login`
4. Test both authentication methods:
   - Click "Continue with Google" to test OAuth
   - Enter an email and click "Send magic link" to test email auth

## 5. Deploy to Production

Once authentication is working locally:

1. Commit and push your changes
2. Vercel will automatically deploy
3. Test the production authentication flow at `https://v0-knots-taker.vercel.app`

## Troubleshooting

### "User not found" or similar errors
- Make sure you've run the database migration
- Check that RLS policies are enabled in Supabase

### OAuth redirect errors
- Verify the redirect URLs are correctly configured
- Check that the Site URL matches your domain

### Magic link not arriving
- Check spam folder
- Verify email provider is enabled in Supabase
- Check Supabase logs for email delivery errors
