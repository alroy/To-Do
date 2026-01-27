/**
 * Shared type definitions for the Knots application
 */

/**
 * Slack task metadata structure stored in tasks.metadata column
 */
export interface SlackTaskMetadata {
  source: {
    type: 'slack'
    subtype: 'dm' | 'mention'
    team_id: string
    channel_id: string
    message_ts: string
    permalink?: string
    author?: {
      slack_user_id: string
      display_name?: string
    }
  }
  raw: {
    slack_text: string
  }
}

/**
 * Generic task metadata that may include Slack or other sources in the future
 */
export interface TaskMetadata {
  source?: {
    type: string
    subtype?: string
    permalink?: string
    author?: {
      display_name?: string
    }
  }
}

/**
 * Check if metadata is from Slack
 */
export function isSlackMetadata(metadata: TaskMetadata | null | undefined): metadata is SlackTaskMetadata {
  return metadata?.source?.type === 'slack'
}
