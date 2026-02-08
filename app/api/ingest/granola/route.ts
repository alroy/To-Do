import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Granola Task Ingestion API
 *
 * Receives pre-shaped tasks from n8n and creates them with Granola provenance.
 *
 * POST /api/ingest/granola
 * Authorization: Bearer <GRANOLA_API_KEY>
 *
 * Body:
 * {
 *   "slack_team_id": "T12345",            // Used to look up the Knots user
 *   "integration": {
 *     "source_type": "granola",
 *     "source_url": "https://notes.granola.ai/..."
 *   },
 *   "tasks": [
 *     { "title": "...", "description": "...", "due_hint": "...", "priority_hint": "...", "tags": [...] }
 *   ],
 *   "slack_message": { "text": "..." }     // Optional: the notification text posted to Slack
 * }
 */

interface GranolaTask {
  title: string
  description?: string
  owner?: string | null
  due_hint?: string | null
  priority_hint?: string | null
  tags?: string[]
}

interface GranolaIngestPayload {
  slack_team_id: string
  integration: {
    source_type: string
    source_url: string
  }
  tasks: GranolaTask[]
  slack_message?: {
    text: string
  }
}

export async function POST(request: Request) {
  // Verify API key
  const apiKey = process.env.GRANOLA_API_KEY
  if (!apiKey) {
    console.error('GRANOLA_API_KEY not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let payload: GranolaIngestPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate required fields
  if (!payload.slack_team_id) {
    return NextResponse.json({ error: 'Missing slack_team_id' }, { status: 400 })
  }

  if (!payload.integration?.source_url) {
    return NextResponse.json({ error: 'Missing integration.source_url' }, { status: 400 })
  }

  if (!Array.isArray(payload.tasks) || payload.tasks.length === 0) {
    return NextResponse.json({ error: 'Missing or empty tasks array' }, { status: 400 })
  }

  // Validate each task has a title
  for (let i = 0; i < payload.tasks.length; i++) {
    const task = payload.tasks[i]
    if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
      return NextResponse.json({ error: `Task at index ${i} is missing a title` }, { status: 400 })
    }
  }

  const supabase = createAdminClient()

  // Look up user from slack_connections
  const { data: connections, error: connError } = await supabase
    .from('slack_connections')
    .select('user_id')
    .eq('team_id', payload.slack_team_id)
    .is('revoked_at', null)

  if (connError) {
    console.error('Error looking up slack_connections:', connError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'No active Slack connection found for this team' }, { status: 404 })
  }

  const userId = connections[0].user_id
  const granolaUrl = payload.integration.source_url
  const createdTaskIds: string[] = []
  const errors: string[] = []

  for (const task of payload.tasks) {
    const title = task.title.trim()

    // Build description with source link
    let description = task.description?.trim() || ''
    if (granolaUrl && !description.includes(granolaUrl)) {
      description = description
        ? `${description}\n\nSource: ${granolaUrl}`
        : `Source: ${granolaUrl}`
    }

    // Source ID for deduplication: granola:<url>:<title_hash>
    // Use a simple hash of the title to distinguish multiple tasks from the same meeting
    const titleHash = simpleHash(title)
    const sourceId = `granola:${granolaUrl}:${titleHash}`

    // Build metadata
    const metadata = {
      source: {
        type: 'granola' as const,
        granola_url: granolaUrl,
        slack_team_id: payload.slack_team_id,
        ...(task.due_hint ? { due_hint: task.due_hint } : {}),
        ...(task.priority_hint ? { priority_hint: task.priority_hint } : {}),
        ...(task.tags && task.tags.length > 0 ? { tags: task.tags } : {}),
      },
      raw: {
        slack_text: payload.slack_message?.text || '',
      },
    }

    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        status: 'active',
        user_id: userId,
        position: 0,
        source_type: 'granola',
        source_id: sourceId,
        source_url: granolaUrl,
        ingest_trigger: 'granola',
        metadata,
      })
      .select('id')
      .single()

    // Unique constraint violation → deduplicated, skip
    if (taskError?.code === '23505') {
      continue
    }

    if (taskError) {
      console.error(`Error creating Granola task "${title}":`, taskError)
      errors.push(`Failed to create "${title}": ${taskError.message}`)
      continue
    }

    createdTaskIds.push(newTask.id)
  }

  return NextResponse.json({
    ok: true,
    created: createdTaskIds.length,
    task_ids: createdTaskIds,
    skipped: payload.tasks.length - createdTaskIds.length - errors.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * Simple string hash for deduplication source IDs.
 * Not cryptographic — just needs to be deterministic.
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
