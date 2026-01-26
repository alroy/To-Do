import { NextResponse } from 'next/server'
import { verifySlackSignature, getSlackHeaders } from '@/lib/slack/verify-signature'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  isUrlVerification,
  isEventCallback,
  processSlackEvent,
  type SlackEvent,
} from '@/lib/slack/event-handlers'

/**
 * Slack Events API endpoint
 *
 * Handles:
 * 1. URL verification challenge (Slack app setup)
 * 2. Event callbacks (messages, mentions)
 *
 * Security:
 * - Verifies Slack request signature
 * - Feature flag check
 * - Idempotent via unique constraint on event_id
 */
export async function POST(request: Request) {
  // Check feature flag
  if (process.env.SLACK_FEATURE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Slack integration disabled' }, { status: 404 })
  }

  // Get signing secret
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Get headers and body for verification
  const { signature, timestamp } = getSlackHeaders(request.headers)

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing Slack headers' }, { status: 401 })
  }

  // Clone request to read body (request can only be read once)
  const body = await request.text()

  // Verify signature
  const isValid = verifySlackSignature(signingSecret, signature, timestamp, body)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse payload
  let payload: SlackEvent
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle URL verification challenge
  if (isUrlVerification(payload)) {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Handle event callback
  if (isEventCallback(payload)) {
    // Return 200 immediately to satisfy Slack's 3-second timeout
    // Process event in the background (Next.js will wait for the promise)

    // Only process message events
    if (payload.event.type !== 'message') {
      return NextResponse.json({ ok: true, skipped: 'not_message_event' })
    }

    try {
      const supabase = createAdminClient()
      const result = await processSlackEvent(supabase, payload)

      return NextResponse.json({
        ok: true,
        status: result.status,
        taskId: result.taskId,
        reason: result.reason,
      })
    } catch (error) {
      console.error('Error processing Slack event:', error)
      // Still return 200 to prevent Slack retries for server errors
      // The event is logged in slack_event_ingest for manual review
      return NextResponse.json({
        ok: false,
        error: 'Processing error',
      })
    }
  }

  // Unknown event type
  return NextResponse.json({ ok: true, skipped: 'unknown_event_type' })
}

// Reject other methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
