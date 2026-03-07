import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  getSlackOAuthConfig,
  verifyOAuthState,
  exchangeCodeForToken,
} from '@/lib/slack/oauth'

/**
 * Handle Slack OAuth callback
 *
 * 1. Verify state parameter
 * 2. Exchange code for access token
 * 3. Store connection in database
 * 4. Redirect back to app with success/error
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  // Check feature flag
  if (process.env.SLACK_FEATURE_ENABLED !== 'true') {
    return NextResponse.redirect(`${siteUrl}/?error=slack_disabled`)
  }

  // Get OAuth config
  const config = getSlackOAuthConfig()
  if (!config) {
    return NextResponse.redirect(`${siteUrl}/?error=slack_not_configured`)
  }

  // Get signing secret for state verification
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    return NextResponse.redirect(`${siteUrl}/?error=server_error`)
  }

  // Check for Slack error
  const slackError = searchParams.get('error')
  if (slackError) {
    console.error('Slack OAuth error:', slackError)
    return NextResponse.redirect(`${siteUrl}/?slack_error=${encodeURIComponent(slackError)}`)
  }

  // Get code and state
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/?error=missing_oauth_params`)
  }

  // Verify state
  const stateResult = verifyOAuthState(state, signingSecret)
  if (!stateResult.valid || !stateResult.userId) {
    return NextResponse.redirect(`${siteUrl}/?error=invalid_state`)
  }

  const userId = stateResult.userId

  // Exchange code for token
  let tokenResponse
  try {
    tokenResponse = await exchangeCodeForToken(config, code)
  } catch (error) {
    console.error('Failed to exchange code:', error)
    return NextResponse.redirect(`${siteUrl}/?error=token_exchange_failed`)
  }

  if (!tokenResponse.ok || !tokenResponse.access_token) {
    console.error('Slack token error:', tokenResponse.error)
    return NextResponse.redirect(`${siteUrl}/?slack_error=${encodeURIComponent(tokenResponse.error || 'unknown')}`)
  }

  // Store connection in database
  const supabase = createAdminClient()

  // Check if connection already exists for this user+team
  const { data: existing } = await supabase
    .from('slack_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('team_id', tokenResponse.team?.id || '')
    .single()

  if (existing) {
    // Update existing connection (re-authorization)
    const { error: updateError } = await supabase
      .from('slack_connections')
      .update({
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        scope: tokenResponse.scope,
        bot_user_id: tokenResponse.bot_user_id,
        slack_user_id: tokenResponse.authed_user?.id,
        team_name: tokenResponse.team?.name,
        user_access_token: tokenResponse.authed_user?.access_token || null,
        user_scope: tokenResponse.authed_user?.scope || null,
        revoked_at: null, // Clear revocation if re-connecting
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error('Failed to update Slack connection:', updateError)
      return NextResponse.redirect(`${siteUrl}/?error=save_failed`)
    }
  } else {
    // Insert new connection
    const { error: insertError } = await supabase
      .from('slack_connections')
      .insert({
        user_id: userId,
        team_id: tokenResponse.team?.id || '',
        team_name: tokenResponse.team?.name,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        scope: tokenResponse.scope,
        bot_user_id: tokenResponse.bot_user_id,
        slack_user_id: tokenResponse.authed_user?.id || '',
        user_access_token: tokenResponse.authed_user?.access_token || null,
        user_scope: tokenResponse.authed_user?.scope || null,
      })

    if (insertError) {
      console.error('Failed to save Slack connection:', insertError)
      return NextResponse.redirect(`${siteUrl}/?error=save_failed`)
    }
  }

  // Success - redirect back to app
  return NextResponse.redirect(`${siteUrl}/?slack_connected=true`)
}
