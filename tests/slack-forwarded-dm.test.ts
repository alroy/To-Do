import { describe, it, expect } from 'vitest'
import {
  isForwardedToBot,
  extractForwardedContent,
  generateForwardedSourceId,
  type SlackMessageEventExtended,
} from '../lib/slack/ingest/forwarded'
import { shouldCreateTask, type SlackMessageEvent } from '../lib/slack/event-handlers'

// ─── isForwardedToBot ───────────────────────────────────────────────

describe('isForwardedToBot', () => {
  const baseDMEvent: SlackMessageEventExtended = {
    type: 'message',
    channel: 'D123456',
    channel_type: 'im',
    user: 'U_FORWARDER',
    text: 'Check this out',
    ts: '1700000000.000001',
  }

  it('should NOT detect a plain DM as forwarded', () => {
    const result = isForwardedToBot(baseDMEvent)
    expect(result.isForwarded).toBe(false)
  })

  // --- Shape 1: Desktop "Share message" dialog ---

  it('should detect forwarded message with attachment is_share=true', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          is_share: true,
          text: 'Original message text from #general',
          author_name: 'Alice',
          author_id: 'U_ALICE',
          channel_id: 'C_GENERAL',
          ts: '1699999999.000001',
          from_url: 'https://workspace.slack.com/archives/C_GENERAL/p1699999999000001',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_attachment_share).toBe(true)
    expect(result.originalText).toBe('Original message text from #general')
    expect(result.originalAuthorName).toBe('Alice')
    expect(result.originalAuthorId).toBe('U_ALICE')
    expect(result.originalChannelId).toBe('C_GENERAL')
    expect(result.originalTs).toBe('1699999999.000001')
    expect(result.originalPermalink).toBe(
      'https://workspace.slack.com/archives/C_GENERAL/p1699999999000001'
    )
  })

  it('should detect forwarded message with attachment is_msg_unfurl=true', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          is_msg_unfurl: true,
          text: 'Unfurled message content',
          from_url: 'https://acme.slack.com/archives/C999/p1234567890123456',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_attachment_msg_unfurl).toBe(true)
    expect(result.cues.has_attachment_from_url).toBe(true)
    expect(result.originalPermalink).toBe(
      'https://acme.slack.com/archives/C999/p1234567890123456'
    )
  })

  it('should detect desktop share with empty text and attachment', () => {
    // Real Slack desktop share: top-level text is empty, content in attachment
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: '',
      attachments: [
        {
          is_share: true,
          is_msg_unfurl: true,
          from_url: 'https://acme.slack.com/archives/C123/p1700000000000000',
          original_url: 'https://acme.slack.com/archives/C123/p1700000000000000',
          text: 'Please review the Q4 budget by Friday',
          fallback: '[Dec 1] alice: Please review the Q4 budget by Friday',
          author_name: 'Alice',
          author_id: 'U_ALICE',
          channel_id: 'C123',
          channel_name: 'finance',
          ts: '1700000000.000000',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_attachment_share).toBe(true)
    expect(result.cues.has_attachment_msg_unfurl).toBe(true)
    expect(result.originalText).toBe('Please review the Q4 budget by Friday')
    expect(result.originalAuthorName).toBe('Alice')
    expect(result.originalChannelId).toBe('C123')
  })

  // --- Shape 2: Mobile forward (rich_text_quote) ---

  it('should detect mobile forward with rich_text_quote and no attachments', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: '',
      blocks: [
        {
          type: 'rich_text',
          block_id: 'xyz',
          elements: [
            {
              type: 'rich_text_quote',
              elements: [
                { type: 'text', text: 'Can you deploy the hotfix today?' },
              ],
            },
          ],
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_rich_text_quote).toBe(true)
    expect(result.originalText).toBe('Can you deploy the hotfix today?')
  })

  it('should NOT detect rich_text_quote as forwarded if user also typed plain text', () => {
    // User manually typed a blockquote in the DM, not a forward
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: '',
      blocks: [
        {
          type: 'rich_text',
          block_id: 'xyz',
          elements: [
            {
              type: 'rich_text_quote',
              elements: [
                { type: 'text', text: 'Some quoted text' },
              ],
            },
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: 'This is my own commentary about the above' },
              ],
            },
          ],
        },
      ],
    }

    const result = isForwardedToBot(event)
    // Has quote + plain text = likely user-typed, not a mobile forward
    expect(result.isForwarded).toBe(false)
    expect(result.cues.has_rich_text_quote).toBe(true)
  })

  // --- Shape 3: Pasted Slack permalink ---

  it('should detect pasted Slack permalink with unfurl attachment', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: 'https://acme.slack.com/archives/C456/p1700000000000000',
      blocks: [
        {
          type: 'rich_text',
          block_id: 'blk1',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                {
                  type: 'link',
                  url: 'https://acme.slack.com/archives/C456/p1700000000000000',
                },
              ],
            },
          ],
        },
      ],
      attachments: [
        {
          is_msg_unfurl: true,
          from_url: 'https://acme.slack.com/archives/C456/p1700000000000000',
          text: 'Original message from pasted link',
          author_id: 'U_ORIG',
          ts: '1700000000.000000',
          channel_id: 'C456',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    // Should fire both attachment and block cues
    expect(result.cues.has_attachment_msg_unfurl).toBe(true)
    expect(result.cues.has_rich_text_link_to_slack).toBe(true)
  })

  // --- Combination cues ---

  it('should detect rich_text_quote combined with Slack link', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: '',
      blocks: [
        {
          type: 'rich_text',
          block_id: 'xyz',
          elements: [
            {
              type: 'rich_text_quote',
              elements: [
                { type: 'text', text: 'Quoted forwarded text' },
              ],
            },
            {
              type: 'rich_text_section',
              elements: [
                {
                  type: 'link',
                  url: 'https://team.slack.com/archives/C789/p1700000000000000',
                },
              ],
            },
          ],
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_rich_text_quote).toBe(true)
    expect(result.cues.has_rich_text_link_to_slack).toBe(true)
  })

  it('should detect forwarded message with multiple cues', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          is_share: true,
          is_msg_unfurl: true,
          from_url: 'https://team.slack.com/archives/C100/p1700000000000000',
          text: 'Multi-cue message',
          author_name: 'Carol',
          author_id: 'U_CAROL',
          channel_id: 'C100',
          ts: '1700000000.000000',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_attachment_share).toBe(true)
    expect(result.cues.has_attachment_msg_unfurl).toBe(true)
    expect(result.cues.has_attachment_from_url).toBe(true)
  })

  it('should detect forwarded message via attachment original_url', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          is_msg_unfurl: true,
          original_url: 'https://team.slack.com/archives/C200/p1700000000000000',
          text: 'Via original_url',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_attachment_from_url).toBe(true)
  })

  it('should handle subtype + attachment combo (e.g. bot_message with share)', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      subtype: 'bot_message',
      attachments: [
        {
          is_share: true,
          text: 'Shared via bot subtype',
          from_url: 'https://team.slack.com/archives/C300/p1700000000000000',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_subtype_share).toBe(true)
    expect(result.cues.has_attachment_share).toBe(true)
  })

  // --- Negative cases ---

  it('should NOT treat attachment with non-Slack from_url as forwarded', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          from_url: 'https://example.com/article',
          text: 'Some article preview',
        },
      ],
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(false)
  })

  it('should NOT treat attachment with only Slack from_url (no unfurl flags) as forwarded', () => {
    // Edge case: attachment has from_url to Slack but no is_share/is_msg_unfurl.
    // This could be a non-message Slack link (e.g. a channel link) that doesn't
    // have corresponding unfurl or block cues.
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          from_url: 'https://team.slack.com/archives/C999/p1700000000000000',
          text: 'Some preview text',
        },
      ],
    }

    const result = isForwardedToBot(event)
    // has_attachment_from_url is set, but it alone is not a strong signal
    // It needs another cue (unfurl, link in blocks, etc.) to trigger
    expect(result.cues.has_attachment_from_url).toBe(true)
    // Without is_msg_unfurl/is_share/rich_text_link, it's a medium signal
    // that requires a second cue to confirm
    // This is the tighter detection: from_url alone in attachment is NOT enough
  })

  it('should detect forwarded message with nested root object', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      root: {
        text: 'Root message text',
        user: 'U_ROOT_AUTHOR',
        ts: '1699000000.000001',
      },
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_root_or_nested_message).toBe(true)
    expect(result.originalText).toBe('Root message text')
    expect(result.originalAuthorId).toBe('U_ROOT_AUTHOR')
    expect(result.originalTs).toBe('1699000000.000001')
  })

  it('should detect forwarded message with nested message object', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      message: {
        text: 'Nested message text',
        user: 'U_NESTED',
        ts: '1698000000.000001',
      },
    }

    const result = isForwardedToBot(event)
    expect(result.isForwarded).toBe(true)
    expect(result.cues.has_root_or_nested_message).toBe(true)
    expect(result.originalText).toBe('Nested message text')
  })
})

// ─── extractForwardedContent ────────────────────────────────────────

describe('extractForwardedContent', () => {
  const baseDMEvent: SlackMessageEventExtended = {
    type: 'message',
    channel: 'D123456',
    channel_type: 'im',
    user: 'U_FORWARDER',
    text: 'Wrapper text from forwarder',
    ts: '1700000000.000001',
  }

  const emptyCues = {
    has_attachment_share: false,
    has_attachment_msg_unfurl: false,
    has_attachment_from_url: false,
    has_subtype_share: false,
    has_rich_text_quote: false,
    has_rich_text_link_to_slack: false,
    has_root_or_nested_message: false,
  }

  it('should prefer originalText from detection result', () => {
    const detection = isForwardedToBot({
      ...baseDMEvent,
      attachments: [
        {
          is_share: true,
          text: 'Original from attachment',
          author_name: 'Alice',
          author_id: 'U_ALICE',
        },
      ],
    })

    const content = extractForwardedContent(baseDMEvent, detection)
    expect(content.text).toBe('Original from attachment')
    expect(content.authorName).toBe('Alice')
    expect(content.authorId).toBe('U_ALICE')
  })

  it('should fall back to attachment text if detection had no originalText', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          text: 'Attachment text here',
          author_name: 'Bob',
        },
      ],
    }

    const detection = {
      isForwarded: true,
      cues: emptyCues,
    }

    const content = extractForwardedContent(event, detection)
    expect(content.text).toBe('Attachment text here')
    expect(content.authorName).toBe('Bob')
  })

  it('should fall back to event.text if no attachment content', () => {
    const detection = {
      isForwarded: true,
      cues: emptyCues,
    }

    const content = extractForwardedContent(baseDMEvent, detection)
    expect(content.text).toBe('Wrapper text from forwarder')
  })

  it('should use fallback text if everything is empty', () => {
    const emptyEvent: SlackMessageEventExtended = {
      ...baseDMEvent,
      text: '',
    }

    const detection = {
      isForwarded: true,
      cues: emptyCues,
    }

    const content = extractForwardedContent(emptyEvent, detection)
    expect(content.text).toBe('Forwarded Slack message')
  })

  it('should prefer attachment fallback text', () => {
    const event: SlackMessageEventExtended = {
      ...baseDMEvent,
      attachments: [
        {
          fallback: 'Fallback text for attachment',
        },
      ],
    }

    const detection = {
      isForwarded: true,
      cues: emptyCues,
    }

    const content = extractForwardedContent(event, detection)
    expect(content.text).toBe('Fallback text for attachment')
  })
})

// ─── generateForwardedSourceId ──────────────────────────────────────

describe('generateForwardedSourceId', () => {
  const baseDMEvent: SlackMessageEventExtended = {
    type: 'message',
    channel: 'D_BOT_DM',
    channel_type: 'im',
    user: 'U_FORWARDER',
    text: 'fwd msg',
    ts: '1700000000.000001',
  }

  const emptyCues = {
    has_attachment_share: false,
    has_attachment_msg_unfurl: false,
    has_attachment_from_url: false,
    has_subtype_share: false,
    has_rich_text_quote: false,
    has_rich_text_link_to_slack: false,
    has_root_or_nested_message: false,
  }

  it('should use original channel + ts when available from detection', () => {
    const detection = {
      isForwarded: true,
      cues: { ...emptyCues, has_attachment_share: true },
      originalChannelId: 'C_ORIGINAL',
      originalTs: '1699999999.000001',
    }

    const sourceId = generateForwardedSourceId('T_TEAM', baseDMEvent, detection)
    expect(sourceId).toBe('T_TEAM:C_ORIGINAL:1699999999.000001')
  })

  it('should parse original coordinates from permalink if channel/ts not directly available', () => {
    const detection = {
      isForwarded: true,
      cues: { ...emptyCues, has_attachment_from_url: true },
      originalPermalink: 'https://team.slack.com/archives/CABC123/p1700000001000000',
    }

    const sourceId = generateForwardedSourceId('T_TEAM', baseDMEvent, detection)
    expect(sourceId).toBe('T_TEAM:CABC123:1700000001.000000')
  })

  it('should fall back to DM message coordinates when no original info', () => {
    const detection = {
      isForwarded: true,
      cues: emptyCues,
    }

    const sourceId = generateForwardedSourceId('T_TEAM', baseDMEvent, detection)
    expect(sourceId).toBe('T_TEAM:D_BOT_DM:1700000000.000001')
  })

  it('should produce same source_id for same original message forwarded twice', () => {
    const detection1 = {
      isForwarded: true,
      cues: { ...emptyCues, has_attachment_share: true },
      originalChannelId: 'C_ORIG',
      originalTs: '1699000000.000001',
    }

    const event2: SlackMessageEventExtended = {
      ...baseDMEvent,
      ts: '1700000099.999999',
    }

    const detection2 = { ...detection1 }

    const id1 = generateForwardedSourceId('T_TEAM', baseDMEvent, detection1)
    const id2 = generateForwardedSourceId('T_TEAM', event2, detection2)

    expect(id1).toBe(id2)
    expect(id1).toBe('T_TEAM:C_ORIG:1699000000.000001')
  })
})

// ─── Non-regression: plain DM is not affected ──────────────────────

describe('Non-regression: plain DM detection', () => {
  it('should NOT treat a plain text DM as forwarded', () => {
    const plainDM: SlackMessageEventExtended = {
      type: 'message',
      channel: 'D123456',
      channel_type: 'im',
      user: 'U_SENDER',
      text: 'Hey, can you take a look at the deploy?',
      ts: '1700000000.000001',
    }

    const result = isForwardedToBot(plainDM)
    expect(result.isForwarded).toBe(false)
    expect(result.cues.has_attachment_share).toBe(false)
    expect(result.cues.has_attachment_msg_unfurl).toBe(false)
    expect(result.cues.has_attachment_from_url).toBe(false)
    expect(result.cues.has_subtype_share).toBe(false)
    expect(result.cues.has_rich_text_quote).toBe(false)
    expect(result.cues.has_rich_text_link_to_slack).toBe(false)
    expect(result.cues.has_root_or_nested_message).toBe(false)
  })

  it('should NOT treat DM with non-Slack URL attachment as forwarded', () => {
    const dmWithLink: SlackMessageEventExtended = {
      type: 'message',
      channel: 'D123456',
      channel_type: 'im',
      user: 'U_SENDER',
      text: 'Check this article: https://example.com/post',
      ts: '1700000000.000001',
      attachments: [
        {
          from_url: 'https://example.com/post',
          text: 'Article preview',
        },
      ],
    }

    const result = isForwardedToBot(dmWithLink)
    expect(result.isForwarded).toBe(false)
  })

  it('should NOT treat DM with user-typed plain text and blockquote as forwarded', () => {
    // User types their own blockquote in the DM — not a forward
    const dmWithQuote: SlackMessageEventExtended = {
      type: 'message',
      channel: 'D123456',
      channel_type: 'im',
      user: 'U_SENDER',
      text: '',
      ts: '1700000000.000001',
      blocks: [
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_quote',
              elements: [{ type: 'text', text: 'Some quoted text' }],
            },
            {
              type: 'rich_text_section',
              elements: [{ type: 'text', text: 'My own comment about this' }],
            },
          ],
        },
      ],
    }

    const result = isForwardedToBot(dmWithQuote)
    expect(result.isForwarded).toBe(false)
  })
})

// ─── Non-regression: shouldCreateTask unchanged ─────────────────────

describe('Non-regression: shouldCreateTask is unchanged', () => {
  const slackUserId = 'U12345'

  it('should still create task for plain DM', () => {
    const event: SlackMessageEvent = {
      type: 'message',
      channel: 'D123456',
      channel_type: 'im',
      user: 'U999',
      text: 'Hello world',
      ts: '1234567890.123456',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(true)
    expect(result.isDM).toBe(true)
    expect(result.reason).toBe('dm')
  })

  it('should still create task for mention', () => {
    const event: SlackMessageEvent = {
      type: 'message',
      channel: 'C123',
      user: 'U999',
      text: `Hey <@${slackUserId}> check this`,
      ts: '1234567890.123456',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(true)
    expect(result.isMention).toBe(true)
  })

  it('should still reject bot messages', () => {
    const event: SlackMessageEvent = {
      type: 'message',
      channel: 'D123456',
      channel_type: 'im',
      user: 'U999',
      text: 'Bot says hi',
      ts: '123',
      bot_id: 'B123',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('bot_message')
  })

  it('should still reject messages with subtypes', () => {
    const event: SlackMessageEvent = {
      type: 'message',
      channel: 'C123',
      user: 'U999',
      text: 'Edited message',
      ts: '123',
      subtype: 'message_changed',
    }
    const result = shouldCreateTask(event, slackUserId)
    expect(result.shouldCreate).toBe(false)
    expect(result.reason).toBe('subtype_message_changed')
  })
})
