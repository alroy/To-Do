"use client"

import { ExternalLink } from "lucide-react"

interface SlackBadgeProps {
  subtype?: 'dm' | 'mention' | string
  authorName?: string
  permalink?: string
  className?: string
}

/**
 * Compact badge/metadata line for Slack-origin tasks
 * Shows source type and optional "View in Slack" link
 */
export function SlackBadge({ subtype, authorName, permalink, className }: SlackBadgeProps) {
  const sourceLabel = subtype === 'dm' ? 'Slack DM' : 'Slack mention'

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground/70 ${className || ''}`}>
      {/* Slack icon (simplified) */}
      <svg
        className="h-3 w-3 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.52v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.52 2.521h-6.313z" />
      </svg>

      {/* Source info */}
      <span>
        {authorName ? `From ${authorName} · ${sourceLabel}` : sourceLabel}
      </span>

      {/* View in Slack link */}
      {permalink && (
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary/70 hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  )
}
