# Slack Integration Setup

This guide explains how to configure the Slack integration for Knots to auto-create tasks from DMs and @mentions.

## Overview

The Slack integration allows users to automatically create tasks when they receive:
- Direct messages (DMs)
- @mentions in channels

Tasks are created with the message content and a reference back to the Slack message.

## Prerequisites

1. A Supabase project with the Knots database
2. A deployed Knots application (or local development with ngrok)
3. Admin access to a Slack workspace

## Step 1: Run Database Migration

Apply the Slack migration to your Supabase database:

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-migration-slack.sql`
4. Run the migration

This creates two tables:
- `slack_connections` - Stores OAuth tokens and workspace info
- `slack_event_ingest` - Stores processed events for deduplication

## Step 2: Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Enter:
   - **App Name**: Knots
   - **Workspace**: Select your workspace
4. Click **Create App**

## Step 3: Configure OAuth & Permissions

1. In your Slack app settings, go to **OAuth & Permissions**
2. Under **Redirect URLs**, add:
   ```
   https://your-domain.com/api/slack/oauth/callback
   ```
   For local development with ngrok:
   ```
   https://your-ngrok-subdomain.ngrok.io/api/slack/oauth/callback
   ```

3. Under **Bot Token Scopes**, add these scopes:
   | Scope | Purpose |
   |-------|---------|
   | `im:history` | Read DM messages |
   | `im:read` | Access DM channel metadata |
   | `channels:history` | Read public channel messages (for mentions) |
   | `groups:history` | Read private channel messages (for mentions) |
   | `mpim:history` | Read group DM messages (for mentions) |
   | `users:read` | Resolve user display names |

4. Under **User Token Scopes**, add:
   | Scope | Purpose |
   |-------|---------|
   | `identify` | Get user identity |

## Step 4: Enable Event Subscriptions

1. Go to **Event Subscriptions**
2. Toggle **Enable Events** to **On**
3. Enter your **Request URL**:
   ```
   https://your-domain.com/api/slack/events
   ```
   Slack will verify this URL. Make sure your app is deployed with `SLACK_FEATURE_ENABLED=true` before this step.

4. Under **Subscribe to bot events**, add:
   | Event | Description |
   |-------|-------------|
   | `message.im` | DM messages |
   | `message.channels` | Public channel messages |
   | `message.groups` | Private channel messages |
   | `message.mpim` | Multi-party DM messages |

5. Click **Save Changes**

## Step 5: Get App Credentials

1. Go to **Basic Information**
2. Note down these values:
   - **Client ID**
   - **Client Secret**
   - **Signing Secret**

## Step 6: Configure Environment Variables

Add these to your `.env.local` (local) or deployment environment:

```bash
# Enable the Slack feature
SLACK_FEATURE_ENABLED=true

# Slack App credentials (from Basic Information)
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret

# Site URL (must match OAuth redirect URL domain)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase Service Role Key (for webhook processing)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 7: Install the App to Your Workspace

1. In your Slack app settings, go to **Install App**
2. Click **Install to Workspace**
3. Review permissions and click **Allow**

## Step 8: Connect Slack in Knots

1. Open your Knots app
2. Click the hamburger menu (top-right)
3. Scroll down to **Integrations**
4. Click **Connect** next to Slack
5. Authorize the app in the Slack OAuth flow

## Testing

### Test DM Task Creation

1. Have someone send you a DM in Slack
2. Verify a new task appears in Knots with the message content

### Test Mention Task Creation

1. Have someone @mention you in a channel
2. Verify a new task appears in Knots

### Test Idempotency

1. Check `slack_event_ingest` table in Supabase
2. Same `event_id` should not create duplicate tasks

## Troubleshooting

### "Slack integration disabled" error
- Ensure `SLACK_FEATURE_ENABLED=true` in your environment
- Restart your application after changing env vars

### OAuth callback fails
- Check that `NEXT_PUBLIC_SITE_URL` matches your OAuth redirect URL
- Verify `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are correct

### Events not creating tasks
1. Check the `slack_event_ingest` table for event records
2. Look at the `status` and `error_message` columns
3. Ensure the Slack user who installed the app has a Knots account

### Signature verification fails
- Ensure `SLACK_SIGNING_SECRET` matches your app's signing secret
- Check that the clock on your server is accurate (±5 minutes)

## Local Development with ngrok

1. Install ngrok: `npm install -g ngrok`
2. Start your app: `npm run dev`
3. Start ngrok: `ngrok http 3000`
4. Use the ngrok HTTPS URL for:
   - OAuth redirect URL in Slack app settings
   - Event subscription request URL
   - `NEXT_PUBLIC_SITE_URL` environment variable

Note: ngrok free tier generates new URLs each session, requiring reconfiguration.

## Security Notes

- Never commit `.env.local` or expose Slack secrets
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - use only in server-side code
- Slack signing secret is used to verify webhook authenticity
- OAuth state parameter prevents CSRF attacks

## Sample Slack Event Payload

For testing, here's a sample event payload:

```json
{
  "type": "event_callback",
  "team_id": "T12345",
  "api_app_id": "A12345",
  "event": {
    "type": "message",
    "channel": "D12345",
    "channel_type": "im",
    "user": "U12345",
    "text": "Remember to review the PR",
    "ts": "1234567890.123456"
  },
  "event_id": "Ev12345",
  "event_time": 1234567890
}
```
