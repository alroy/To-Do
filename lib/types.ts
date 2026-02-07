/**
 * Shared type definitions for the Knots application
 */

/**
 * Map of Slack user IDs to display names
 */
export type SlackUserMap = Record<string, string>

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
    /** Original message author (for forwarded messages, this is the original author, not the forwarder) */
    author?: {
      slack_user_id: string
      display_name?: string
    }
    /** Who forwarded the message to the bot DM (only present for forwarded messages) */
    forwarded_by?: {
      slack_user_id: string
      display_name?: string
    }
  }
  raw: {
    slack_text: string
  }
  /** Map of Slack user IDs to display names for rendering mentions */
  user_map?: SlackUserMap
}

/**
 * Granola task metadata structure stored in tasks.metadata column
 * Used for tasks originating from Granola via n8n automation
 */
export interface GranolaTaskMetadata {
  source: {
    type: 'granola'
    granola_url: string
    /** Slack delivery info (the DM channel through which the task arrived) */
    slack_team_id: string
    slack_channel_id: string
    slack_message_ts: string
    slack_permalink?: string
    author?: {
      display_name?: string
      granola_author_id?: string
    }
  }
  raw: {
    slack_text: string
  }
  user_map?: SlackUserMap
}

/**
 * Generic task metadata that may include Slack, Granola, or other sources
 */
export interface TaskMetadata {
  source?: {
    type: string
    subtype?: string
    permalink?: string
    granola_url?: string
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

/**
 * Check if metadata is from Granola
 */
export function isGranolaMetadata(metadata: TaskMetadata | null | undefined): metadata is GranolaTaskMetadata {
  return metadata?.source?.type === 'granola'
}
