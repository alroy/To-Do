import { describe, it, expect } from 'vitest'
import {
  shouldCreateTask,
  extractTaskTitle,
  formatTaskDescription,
  buildSlackMetadata,
  isUrlVerification,
  isEventCallback,
  type SlackMessageEvent,
  type SlackEventCallback,
  type SlackUrlVerification,
  type SlackTaskMetadata,
} from '../lib/slack/event-handlers'

describe('shouldCreateTask', () => {
  const slackUserId = 'U12345'

  const baseEvent: SlackMessageEvent = {
    type: 'message',
    channel: 'C123',
    user: 'U999',
    text: 'Hello world',
    ts: '1234567890.123456',
  }

  it('should create task for DM (channel_type = im)', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      channel_type: 'im',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(true)
    expect(result.isDM).toBe(true)
    expect(result.reason).toBe('dm')
  })

  it('should create task for DM (channel starts with D)', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      channel: 'D123456',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(true)
    expect(result.isDM).toBe(true)
  })

  it('should create task for mention', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      text: `Hey <@${slackUserId}> check this out`,
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(true)
    expect(result.isMention).toBe(true)
    expect(result.reason).toBe('mention')
  })

  it('should NOT create task for bot messages', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      bot_id: 'B123',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('bot_message')
  })

  it('should NOT create task for message with subtype', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      subtype: 'message_changed',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('subtype_message_changed')
  })

  it('should NOT create task for empty text', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      text: '',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('empty_text')
  })

  it('should NOT create task for whitespace-only text', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      text: '   ',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('empty_text')
  })

  it('should NOT create task for regular channel message without mention', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      channel: 'C123',
      channel_type: 'channel',
      text: 'Hello everyone',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('no_dm_or_mention')
  })

  it('should NOT create task when different user is mentioned', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      text: 'Hey <@U99999> check this out',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('no_dm_or_mention')
  })
})

describe('extractTaskTitle', () => {
  it('should return trimmed text', () => {
    expect(extractTaskTitle('  Hello world  ')).toBe('Hello world')
  })

  it('should collapse multiple spaces', () => {
    expect(extractTaskTitle('Hello    world')).toBe('Hello world')
  })

  it('should normalize user mentions to @user', () => {
    // normalizeSlackText converts <@U123> to @user
    expect(extractTaskTitle('<@U123> please review this')).toBe('@user please review this')
  })

  it('should normalize multiple user mentions', () => {
    expect(extractTaskTitle('<@U123> and <@U456> check this')).toBe('@user and @user check this')
  })

  it('should truncate long text', () => {
    const longText = 'A'.repeat(200)
    const result = extractTaskTitle(longText, 120)
    expect(result.length).toBeLessThanOrEqual(120)
    expect(result.endsWith('...')).toBe(true)
  })

  it('should return fallback for mention-only text', () => {
    // After normalization, <@U123> becomes @user which triggers fallback
    expect(extractTaskTitle('<@U123>')).toBe('Slack message')
  })

  it('should return fallback for empty text', () => {
    expect(extractTaskTitle('')).toBe('Slack message')
  })

  it('should extract first sentence for long messages', () => {
    const text = 'Please review this PR. It contains the new feature implementation.'
    expect(extractTaskTitle(text)).toBe('Please review this PR.')
  })
})

describe('formatTaskDescription', () => {
  it('should return normalized message text', () => {
    const result = formatTaskDescription('Hello world')
    expect(result).toBe('Hello world')
  })

  it('should normalize Slack user mentions', () => {
    const result = formatTaskDescription('<@U123> please review this')
    expect(result).toBe('@user please review this')
  })

  it('should normalize Slack URL tokens', () => {
    const result = formatTaskDescription('Check <https://example.com|this link>')
    expect(result).toBe('Check this link')
  })

  it('should truncate very long text', () => {
    const longText = 'A'.repeat(3000)
    const result = formatTaskDescription(longText)
    expect(result.length).toBeLessThanOrEqual(2000)
    expect(result).toContain('...')
  })

  it('should handle empty text', () => {
    const result = formatTaskDescription('')
    expect(result).toBe('')
  })
})

describe('buildSlackMetadata', () => {
  const baseEvent: SlackMessageEvent = {
    type: 'message',
    channel: 'C123456',
    user: 'U999',
    text: 'Hello world',
    ts: '1234567890.123456',
  }

  it('should build metadata for DM', () => {
    const metadata = buildSlackMetadata(baseEvent, 'T123', 'dm')

    expect(metadata.source.type).toBe('slack')
    expect(metadata.source.subtype).toBe('dm')
    expect(metadata.source.team_id).toBe('T123')
    expect(metadata.source.channel_id).toBe('C123456')
    expect(metadata.source.message_ts).toBe('1234567890.123456')
    expect(metadata.raw.slack_text).toBe('Hello world')
  })

  it('should build metadata for mention', () => {
    const metadata = buildSlackMetadata(baseEvent, 'T123', 'mention')

    expect(metadata.source.subtype).toBe('mention')
  })

  it('should include permalink when provided', () => {
    const metadata = buildSlackMetadata(
      baseEvent,
      'T123',
      'dm',
      undefined,
      undefined,
      'https://slack.com/archives/C123/p456'
    )

    expect(metadata.source.permalink).toBe('https://slack.com/archives/C123/p456')
  })

  it('should include author info when provided', () => {
    const metadata = buildSlackMetadata(
      baseEvent,
      'T123',
      'dm',
      'U999',
      'John Doe'
    )

    expect(metadata.source.author?.slack_user_id).toBe('U999')
    expect(metadata.source.author?.display_name).toBe('John Doe')
  })

  it('should include author user ID without display name', () => {
    const metadata = buildSlackMetadata(
      baseEvent,
      'T123',
      'dm',
      'U999'
    )

    expect(metadata.source.author?.slack_user_id).toBe('U999')
    expect(metadata.source.author?.display_name).toBeUndefined()
  })

  it('should not include author when not provided', () => {
    const metadata = buildSlackMetadata(baseEvent, 'T123', 'dm')

    expect(metadata.source.author).toBeUndefined()
  })

  it('should store raw slack text in metadata', () => {
    const event: SlackMessageEvent = {
      ...baseEvent,
      text: '<@U123> check this <https://example.com|link>',
    }
    const metadata = buildSlackMetadata(event, 'T123', 'mention')

    // Raw text should be preserved with original Slack tokens
    expect(metadata.raw.slack_text).toBe('<@U123> check this <https://example.com|link>')
  })
})

describe('isUrlVerification', () => {
  it('should return true for url_verification type', () => {
    const event: SlackUrlVerification = {
      type: 'url_verification',
      token: 'test',
      challenge: 'challenge123',
    }
    expect(isUrlVerification(event)).toBe(true)
  })

  it('should return false for event_callback type', () => {
    const event: SlackEventCallback = {
      type: 'event_callback',
      token: 'test',
      team_id: 'T123',
      api_app_id: 'A123',
      event: { type: 'message', channel: 'C123', ts: '123', text: 'hi' },
      event_id: 'E123',
      event_time: 12345,
    }
    expect(isUrlVerification(event)).toBe(false)
  })
})

describe('isEventCallback', () => {
  it('should return true for event_callback type', () => {
    const event: SlackEventCallback = {
      type: 'event_callback',
      token: 'test',
      team_id: 'T123',
      api_app_id: 'A123',
      event: { type: 'message', channel: 'C123', ts: '123', text: 'hi' },
      event_id: 'E123',
      event_time: 12345,
    }
    expect(isEventCallback(event)).toBe(true)
  })

  it('should return false for url_verification type', () => {
    const event: SlackUrlVerification = {
      type: 'url_verification',
      token: 'test',
      challenge: 'challenge123',
    }
    expect(isEventCallback(event)).toBe(false)
  })
})
