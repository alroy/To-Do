/**
 * Slack Web API helpers for resolving user information
 */

export interface SlackUserInfo {
  id: string
  name: string
  real_name?: string
  display_name?: string
}

export interface SlackUserMap {
  [userId: string]: string // userId -> display name
}

interface SlackApiResponse {
  ok: boolean
  error?: string
}

interface SlackUsersInfoResponse extends SlackApiResponse {
  user?: {
    id: string
    name: string
    real_name?: string
    profile?: {
      display_name?: string
      real_name?: string
    }
  }
}

/**
 * Fetch user info from Slack API
 */
export async function fetchSlackUser(
  accessToken: string,
  userId: string
): Promise<SlackUserInfo | null> {
  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const data: SlackUsersInfoResponse = await response.json()

    if (!data.ok || !data.user) {
      console.error('Failed to fetch Slack user:', data.error)
      return null
    }

    const displayName =
      data.user.profile?.display_name ||
      data.user.profile?.real_name ||
      data.user.real_name ||
      data.user.name

    return {
      id: data.user.id,
      name: data.user.name,
      real_name: data.user.real_name,
      display_name: displayName,
    }
  } catch (error) {
    console.error('Error fetching Slack user:', error)
    return null
  }
}

/**
 * Extract user IDs from Slack message text
 * Matches patterns like <@U123ABC>
 */
export function extractUserIdsFromText(text: string): string[] {
  const matches = text.match(/<@([A-Z0-9]+)>/gi) || []
  return [...new Set(matches.map((m) => m.slice(2, -1)))]
}

/**
 * Resolve multiple user IDs to a user map
 * Returns a map of userId -> display name
 */
export async function resolveUserMentions(
  accessToken: string,
  text: string
): Promise<SlackUserMap> {
  const userIds = extractUserIdsFromText(text)
  const userMap: SlackUserMap = {}

  // Fetch all users in parallel (with a reasonable limit)
  const fetchPromises = userIds.slice(0, 10).map(async (userId) => {
    const user = await fetchSlackUser(accessToken, userId)
    if (user && user.display_name) {
      userMap[userId] = user.display_name
    }
  })

  await Promise.all(fetchPromises)
  return userMap
}

/**
 * DM channel info from conversations.list
 */
export interface SlackDMChannel {
  id: string
  user: string // The other person's user ID
}

/**
 * Message from conversations.history
 */
export interface SlackHistoryMessage {
  type: string
  subtype?: string
  user?: string
  text?: string
  ts: string
  bot_id?: string
}

/**
 * List user's DM channels using their user token
 * Returns all IM (1:1 DM) channels
 */
export async function listUserDMChannels(
  userToken: string
): Promise<SlackDMChannel[]> {
  const channels: SlackDMChannel[] = []
  let cursor: string | undefined

  try {
    do {
      const params = new URLSearchParams({
        types: 'im',
        limit: '200',
        exclude_archived: 'true',
      })
      if (cursor) params.set('cursor', cursor)

      const response = await fetch(
        `https://slack.com/api/conversations.list?${params}`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      )
      const data = await response.json()

      if (!data.ok) {
        console.error('Failed to list DM channels:', data.error)
        break
      }

      for (const ch of data.channels || []) {
        if (ch.id && ch.user) {
          channels.push({ id: ch.id, user: ch.user })
        }
      }

      cursor = data.response_metadata?.next_cursor || undefined
    } while (cursor)
  } catch (error) {
    console.error('Error listing DM channels:', error)
  }

  return channels
}

/**
 * Fetch recent messages from a DM channel using user token
 * @param oldest - Unix timestamp string; only messages after this time
 * @param limit - Max messages to fetch (default 50)
 */
export async function fetchDMHistory(
  userToken: string,
  channelId: string,
  oldest?: string,
  limit = 50
): Promise<SlackHistoryMessage[]> {
  try {
    const params = new URLSearchParams({
      channel: channelId,
      limit: String(limit),
    })
    if (oldest) params.set('oldest', oldest)

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    )
    const data = await response.json()

    if (!data.ok) {
      console.error(`Failed to fetch DM history for ${channelId}:`, data.error)
      return []
    }

    return data.messages || []
  } catch (error) {
    console.error(`Error fetching DM history for ${channelId}:`, error)
    return []
  }
}

/**
 * Fetch permalink for a Slack message using bot token
 */
export async function fetchPermalink(
  botToken: string,
  channelId: string,
  messageTs: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      channel: channelId,
      message_ts: messageTs,
    })
    const response = await fetch(
      `https://slack.com/api/chat.getPermalink?${params}`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    )
    const data = await response.json()
    return data.ok ? data.permalink : null
  } catch {
    return null
  }
}
