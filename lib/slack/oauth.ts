import crypto from 'crypto'

/**
 * Slack OAuth configuration
 */
export interface SlackOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Get OAuth config from environment
 */
export function getSlackOAuthConfig(): SlackOAuthConfig | null {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!clientId || !clientSecret || !siteUrl) {
    return null
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl}/api/slack/oauth/callback`,
  }
}

/**
 * Slack bot scopes required for the integration
 */
export const SLACK_BOT_SCOPES = [
  'im:history',      // Read DM messages
  'im:read',         // Access DM channel metadata
  'channels:history', // Read public channel messages (for mentions)
  'groups:history',   // Read private channel messages (for mentions)
  'mpim:history',     // Read group DM messages (for mentions)
  'users:read',       // Resolve user display names
].join(',')

/**
 * Slack user scopes (for identifying the installing user)
 */
export const SLACK_USER_SCOPES = [
  'identify',    // Get user identity
  'im:history',  // Read DM message history (for polling)
  'im:read',     // List DM channels (for polling)
].join(',')

/**
 * Generate OAuth state parameter with HMAC signature
 * State format: userId:nonce:signature
 */
export function generateOAuthState(userId: string, secret: string): string {
  const nonce = crypto.randomBytes(16).toString('hex')
  const data = `${userId}:${nonce}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .substring(0, 16) // Truncate for shorter URL

  return `${data}:${signature}`
}

/**
 * Verify and parse OAuth state parameter
 */
export function verifyOAuthState(
  state: string,
  secret: string
): { valid: boolean; userId?: string } {
  const parts = state.split(':')
  if (parts.length !== 3) {
    return { valid: false }
  }

  const [userId, nonce, signature] = parts
  const data = `${userId}:${nonce}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .substring(0, 16)

  // Constant-time comparison
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    )
    return { valid: isValid, userId: isValid ? userId : undefined }
  } catch {
    return { valid: false }
  }
}

/**
 * Build Slack OAuth authorization URL
 */
export function buildAuthUrl(config: SlackOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: SLACK_BOT_SCOPES,
    user_scope: SLACK_USER_SCOPES,
    redirect_uri: config.redirectUri,
    state,
  })

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

/**
 * Exchange OAuth code for access token
 */
export interface SlackOAuthResponse {
  ok: boolean
  error?: string
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: {
    id: string
    name: string
  }
  authed_user?: {
    id: string
    scope?: string
    access_token?: string
    token_type?: string
  }
}

export async function exchangeCodeForToken(
  config: SlackOAuthConfig,
  code: string
): Promise<SlackOAuthResponse> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  })

  return response.json()
}
