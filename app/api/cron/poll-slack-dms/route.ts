import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  listUserDMChannels,
  fetchDMHistory,
  fetchPermalink,
  fetchSlackUser,
  type SlackHistoryMessage,
} from '@/lib/slack/api'
import {
  computeActionabilityScore,
  shouldCallLLM,
  getRequiredConfidence,
  classifySlackMention,
  shapeDMMessage,
  createDMFallback,
  createTaskFromSource,
  generateSourceId,
  linkTaskToGoal,
  type SlackIngestMessage,
  type TaskFromSourceInput,
} from '@/lib/slack/ingest'

/**
 * Cron endpoint: Poll user Slack DMs for actionable messages
 *
 * Runs hourly via Vercel Cron. For each user with a stored user_access_token:
 * 1. Lists their DM channels
 * 2. Fetches messages since last poll
 * 3. Filters through actionability heuristic + LLM
 * 4. Creates tasks for actionable messages
 */
export async function GET(request: Request) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const apiKey = process.env.ANTHROPIC_API_KEY

  // Fetch all active connections that have a user token
  const { data: connections, error: connError } = await supabase
    .from('slack_connections')
    .select('id, user_id, team_id, slack_user_id, access_token, user_access_token, last_dm_poll_at')
    .not('user_access_token', 'is', null)
    .is('revoked_at', null)

  if (connError || !connections?.length) {
    return NextResponse.json({
      message: 'No connections with user tokens',
      error: connError?.message,
    })
  }

  const results: Array<{
    userId: string
    channelsPolled: number
    messagesChecked: number
    tasksCreated: number
    errors: string[]
  }> = []

  // Process each connection sequentially (rate limit friendly)
  for (const conn of connections) {
    const result = {
      userId: conn.user_id,
      channelsPolled: 0,
      messagesChecked: 0,
      tasksCreated: 0,
      errors: [] as string[],
    }

    try {
      // List user's DM channels
      const dmChannels = await listUserDMChannels(conn.user_access_token)
      result.channelsPolled = dmChannels.length

      // Calculate oldest timestamp for history fetch
      // Default to 2 hours ago if never polled (first run catches recent messages)
      const oldest = conn.last_dm_poll_at
        ? String(new Date(conn.last_dm_poll_at).getTime() / 1000)
        : String((Date.now() - 2 * 60 * 60 * 1000) / 1000)

      // Process DM channels in batches of 5 to respect rate limits
      for (let i = 0; i < dmChannels.length; i += 5) {
        const batch = dmChannels.slice(i, i + 5)
        const batchResults = await Promise.all(
          batch.map(async (channel) => {
            try {
              const messages = await fetchDMHistory(
                conn.user_access_token,
                channel.id,
                oldest,
                50
              )

              // Filter: only messages FROM the other person, not by the user themselves
              const candidates = messages.filter(
                (msg: SlackHistoryMessage) =>
                  msg.user && // Has a user
                  msg.user !== conn.slack_user_id && // Not from the Knots user
                  !msg.bot_id && // Not a bot
                  !msg.subtype && // No subtypes (edits, joins, etc.)
                  msg.text && msg.text.trim() // Has text
              )

              return { channel, candidates }
            } catch (err: any) {
              result.errors.push(`Channel ${channel.id}: ${err.message}`)
              return { channel, candidates: [] as SlackHistoryMessage[] }
            }
          })
        )

        // Process candidates through the actionability pipeline
        for (const { channel, candidates } of batchResults) {
          for (const msg of candidates) {
            result.messagesChecked++

            // Build a SlackIngestMessage for the pipeline
            const ingestMsg: SlackIngestMessage = {
              team_id: conn.team_id,
              channel_id: channel.id,
              message_ts: msg.ts,
              user_id: msg.user!,
              text: msg.text!,
              permalink: '', // Will fetch if needed
              mentioned_user_ids: [conn.slack_user_id], // Treat as if user is mentioned
              trigger: 'dm_poll',
              ingested_at: new Date().toISOString(),
            }

            // Step 1: Actionability scoring
            const actionResult = computeActionabilityScore(ingestMsg)

            if (!shouldCallLLM(actionResult.score)) {
              continue // Too low actionability, skip
            }

            // Step 2: LLM classification (if API key available)
            if (!apiKey) continue

            const classification = await classifySlackMention(ingestMsg)

            if (!classification.success || !classification.classification) {
              continue
            }

            const llmResult = classification.classification
            if (!llmResult.is_task) continue

            // Step 3: Confidence check
            const requiredConfidence = getRequiredConfidence(actionResult.score)
            if (llmResult.confidence < requiredConfidence) {
              continue
            }

            // Step 4: Shape the message into a task
            // Resolve sender name for better task titles
            const senderInfo = await fetchSlackUser(conn.access_token, msg.user!)
            const senderName = senderInfo?.display_name || senderInfo?.real_name

            const shaped = await shapeDMMessage(msg.text!, senderName)
            const taskShape = shaped || createDMFallback(msg.text!)

            // Step 5: Fetch permalink for source tracking
            const permalink = await fetchPermalink(conn.access_token, channel.id, msg.ts)
            ingestMsg.permalink = permalink || ''

            // Step 6: Build task input and create
            const sourceId = generateSourceId(ingestMsg)
            let description = taskShape.description || ''
            if (permalink) {
              if (description) description += '\n\n'
              description += `Source: ${permalink}`
            }

            const taskInput: TaskFromSourceInput = {
              user_id: conn.user_id,
              title: taskShape.title,
              description,
              source_type: 'slack',
              source_id: sourceId,
              source_url: permalink || '',
              llm_confidence: taskShape.confidence,
              llm_why: taskShape.why || 'dm_poll',
              ingest_trigger: 'dm_poll',
            }

            const createResult = await createTaskFromSource(supabase, taskInput)

            if (createResult.success && !createResult.deduped && createResult.taskId) {
              result.tasksCreated++

              // Fire-and-forget goal linking
              linkTaskToGoal(supabase, conn.user_id, createResult.taskId, taskShape.title, description).catch(() => {})
            }
          }
        }
      }

      // Update last poll timestamp
      await supabase
        .from('slack_connections')
        .update({ last_dm_poll_at: new Date().toISOString() })
        .eq('id', conn.id)
    } catch (err: any) {
      result.errors.push(`Connection error: ${err.message}`)
    }

    results.push(result)
  }

  const totalCreated = results.reduce((sum, r) => sum + r.tasksCreated, 0)
  const totalChecked = results.reduce((sum, r) => sum + r.messagesChecked, 0)

  return NextResponse.json({
    message: `Polled ${connections.length} connection(s). Checked ${totalChecked} messages, created ${totalCreated} tasks.`,
    results,
  })
}
