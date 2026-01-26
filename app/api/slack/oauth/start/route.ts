import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  getSlackOAuthConfig,
  generateOAuthState,
  buildAuthUrl,
} from '@/lib/slack/oauth'

/**
 * Start Slack OAuth flow
 *
 * 1. Validates user is authenticated
 * 2. Generates signed state parameter
 * 3. Redirects to Slack authorization page
 */
export async function GET() {
  // Check feature flag
  if (process.env.SLACK_FEATURE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Slack integration disabled' }, { status: 404 })
  }

  // Get OAuth config
  const config = getSlackOAuthConfig()
  if (!config) {
    console.error('Slack OAuth not configured')
    return NextResponse.json({ error: 'Slack not configured' }, { status: 500 })
  }

  // Get signing secret for state
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Get current user session
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    // Redirect to home page if not authenticated
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    return NextResponse.redirect(`${siteUrl}/?error=not_authenticated`)
  }

  // Generate signed state
  const state = generateOAuthState(user.id, signingSecret)

  // Build and redirect to Slack auth URL
  const authUrl = buildAuthUrl(config, state)

  return NextResponse.redirect(authUrl)
}
