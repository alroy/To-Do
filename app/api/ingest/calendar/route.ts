import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

interface CalendarPayload {
  event_id: string
  title: string
  start_time: string
  end_time: string
  attendees?: string[]
  location?: string
  description?: string
  meeting_link?: string
  calendar_name?: string
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const webhookSecret = process.env.ZAPIER_WEBHOOK_SECRET
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = process.env.ZAPIER_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'ZAPIER_USER_ID not configured' }, { status: 500 })
  }

  try {
    const body: CalendarPayload = await request.json()

    if (!body.event_id || !body.title || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: 'event_id, title, start_time, and end_time are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('calendar_events')
      .upsert({
        user_id: userId,
        event_id: body.event_id,
        title: body.title,
        start_time: body.start_time,
        end_time: body.end_time,
        attendees: body.attendees || [],
        location: body.location || '',
        description: body.description || '',
        meeting_link: body.meeting_link || '',
        calendar_name: body.calendar_name || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,event_id' })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      event_id: body.event_id,
      id: data.id,
    })
  } catch (error) {
    console.error('Calendar ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
