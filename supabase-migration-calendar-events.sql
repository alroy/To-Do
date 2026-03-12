-- Run this in Supabase SQL Editor to add the calendar_events table
-- Used by Zapier Google Calendar integration to store events for morning brief context

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees TEXT[] DEFAULT '{}',
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  meeting_link TEXT DEFAULT '',
  calendar_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_date_idx
  ON calendar_events(user_id, start_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (admin client) needs full access for Zapier webhook upserts
CREATE POLICY "Service can manage events" ON calendar_events
  FOR ALL USING (true);
