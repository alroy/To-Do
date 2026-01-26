import { describe, it, expect } from 'vitest'
import {
  shouldCreateTask,
  extractTaskTitle,
  formatTaskDescription,
  isUrlVerification,
  isEventCallback,
  type SlackMessageEvent,
  type SlackEventCallback,
  type SlackUrlVerification,
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

  it('should remove user mentions', () => {
    expect(extractTaskTitle('<@U123> please review this')).toBe('please review this')
  })

  it('should remove multiple user mentions', () => {
    expect(extractTaskTitle('<@U123> and <@U456> check this')).toBe('and check this')
  })

  it('should truncate long text', () => {
    const longText = 'A'.repeat(200)
    const result = extractTaskTitle(longText, 120)
    expect(result.length).toBe(120)
    expect(result.endsWith('...')).toBe(true)
  })

  it('should return default for empty text after removing mentions', () => {
    expect(extractTaskTitle('<@U123>')).toBe('Slack message')
  })
})

describe('formatTaskDescription', () => {
  it('should include message text', () => {
    const result = formatTaskDescription('Hello world', undefined, 'dm')
    expect(result).toContain('Hello world')
  })

  it('should include sender name when provided', () => {
    const result = formatTaskDescription('Hello', 'John Doe', 'dm')
    expect(result).toContain('From: John Doe')
  })

  it('should indicate DM source', () => {
    const result = formatTaskDescription('Hello', undefined, 'dm')
    expect(result).toContain('Source: Slack DM')
  })

  it('should indicate mention source', () => {
    const result = formatTaskDescription('Hello', undefined, 'mention')
    expect(result).toContain('Source: Slack mention')
  })

  it('should include permalink when provided', () => {
    const result = formatTaskDescription('Hello', undefined, 'dm', 'https://slack.com/link')
    expect(result).toContain('Link: https://slack.com/link')
  })

  it('should truncate very long text', () => {
    const longText = 'A'.repeat(3000)
    const result = formatTaskDescription(longText, undefined, 'dm')
    expect(result.length).toBeLessThan(3000)
    expect(result).toContain('...')
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
