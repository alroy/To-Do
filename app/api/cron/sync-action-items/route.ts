import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchMondayItems } from '@/lib/monday/sync'

/**
 * Cron endpoint: Sync action items from Monday.com board
 *
 * Runs every 30 minutes via Vercel Cron.
 * Fetches new items from the Monday.com board and inserts them
 * into the action_items table, deduplicating by message_link.
 */
export async function GET(request: Request) {
  // Verify cron authorization (Vercel sends CRON_SECRET automatically)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = process.env.AUTH_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'AUTH_USER_ID not configured' }, { status: 500 })
  }

  try {
    const mondayItems = await fetchMondayItems()

    if (mondayItems.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, skipped: 0, message: 'No items on board' })
    }

    const supabase = createAdminClient()
    const { data: existing, error: fetchError } = await supabase
      .from('action_items')
      .select('message_link')
      .eq('user_id', userId)
      .not('message_link', 'is', null)

    if (fetchError) throw fetchError

    const existingLinks = new Set((existing || []).map(r => r.message_link))

    const newItems = mondayItems.filter(item =>
      item.messageLink && !existingLinks.has(item.messageLink)
    )
    const noLinkItems = mondayItems.filter(item => !item.messageLink)
    const toInsert = [...newItems, ...noLinkItems]

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, skipped: mondayItems.length })
    }

    const rows = toInsert.map(item => ({
      user_id: userId,
      action_item: item.actionItem,
      source: item.source,
      source_channel: item.sourceChannel,
      message_from: item.messageFrom,
      message_link: item.messageLink,
      message_timestamp: item.messageTimestamp,
      status: item.status,
      raw_context: item.rawContext,
      scan_timestamp: item.scanTimestamp || new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from('action_items')
      .insert(rows)

    if (insertError) throw insertError

    return NextResponse.json({ ok: true, synced: toInsert.length, skipped: mondayItems.length - toInsert.length })
  } catch (error) {
    console.error('Action items cron sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
