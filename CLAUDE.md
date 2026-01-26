# Knots - To-Do App Project Context

## Project Overview
This is a Next.js 14 to-do app called "Knots" with Supabase database integration, drag-and-drop functionality, and a refined design system using oklch color space.

**Live URL:** https://v0-knots-taker.vercel.app/
**Repository:** https://github.com/alroy/To-Do

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS with custom oklch color palette
- **Drag-and-Drop:** @dnd-kit libraries
- **Deployment:** Vercel (auto-deploys from main branch)

## Database Schema (Supabase)
Table: `tasks`
- `id` (uuid, primary key)
- `title` (text)
- `description` (text, nullable)
- `status` ('active' | 'completed')
- `position` (integer) - For persistent ordering, 0 = top
- `created_at` (timestamp)
- `completed_at` (timestamp, nullable)

**Required for cross-tab sync:** Run `supabase-migration-cross-tab-sync.sql` to add `position` column and set `REPLICA IDENTITY FULL`.

**Required for Slack integration:** Run `supabase-migration-slack.sql` to add Slack tables.

Table: `slack_connections`
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `team_id` (text) - Slack workspace ID
- `team_name` (text, nullable)
- `bot_user_id` (text, nullable)
- `slack_user_id` (text) - Slack user who connected
- `access_token` (text) - Bot OAuth token
- `created_at` (timestamp)
- `revoked_at` (timestamp, nullable) - Soft delete

Table: `slack_event_ingest`
- `id` (uuid, primary key)
- `team_id` (text)
- `event_id` (text) - Slack event ID for deduplication
- `event_type` (text)
- `payload` (jsonb) - Raw event data
- `status` (text) - received|processed|ignored|failed
- `task_id` (uuid, nullable) - Created task reference
- `error_message` (text, nullable)
- `created_at` (timestamp)

## Design System

### Color Palette
Uses oklch color space with warm gray-blue hue (240):
- **Primary:** oklch(0.55 0.06 240) - Main interactive color
- **Accent:** oklch(0.94 0.008 240) - Card backgrounds
- **Accent Hover:** oklch(0.97 0.004 240) - Card hover states
- **Accent Subtle:** oklch(0.96 0.004 240) - Completed card backgrounds
- **Muted Foreground:** oklch(0.55 0.015 240) - Secondary text
- **Border:** oklch(0.90 0.008 240) - Borders and dividers

All colors defined in `app/globals.css` with dark mode variants.

### Typography
System fonts for optimal native appearance:
- Sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'
- Mono: ui-monospace, 'SF Mono', 'Cascadia Code', 'Consolas', 'Liberation Mono', 'Menlo'

## Key Components

### `/app/page.tsx`
Main page with Supabase integration:
- Loads knots from database on mount
- Implements CRUD operations with optimistic updates
- Error rollback on database failures
- Drag-and-drop reordering
- Real-time sync via Supabase Realtime (changes appear instantly across devices)
- Hamburger menu at top-right for user profile/sign out
- KnotForm FAB at bottom-right for adding new tasks

### `/components/knot-form.tsx`
Floating Action Button (FAB) with modal form:
- FAB fixed at bottom-right corner (56px circular button)
- Opens centered modal form on click with backdrop overlay
- Form contains title input and optional description
- Closes on submit/cancel or backdrop click
- Custom KnotIcon SVG component

### `/components/hamburger-menu.tsx`
Hamburger menu with slide-out drawer:
- Hamburger icon button (3 lines) at top-right
- Opens slide-out drawer from right side
- Contains user avatar, email, and "Sign out" button
- Semi-transparent backdrop overlay
- Uses `useAuth()` hook for user data and sign out

### `/components/sortable-knot-list.tsx`
Drag-and-drop list using @dnd-kit:
- SortableContext for reordering
- Handles drag events and animations
- Integrates with knot card components

### `/components/ui/`
Reusable UI components:
- `button.tsx` - Size variants: default, sm, lg, icon
- `input.tsx` - Text input with consistent styling
- `textarea.tsx` - Multi-line text input
- `label.tsx` - Form labels

### `/lib/supabase.ts`
Supabase client configuration for database operations.

### `/lib/supabase-admin.ts`
Service role client for webhook processing (bypasses RLS).

### `/lib/slack/`
Slack integration utilities:
- `verify-signature.ts` - HMAC-SHA256 request signature verification
- `event-handlers.ts` - Event processing, DM/mention detection, task creation
- `oauth.ts` - OAuth URL building and token exchange

### `/components/settings/slack-settings.tsx`
Slack connection UI in hamburger menu:
- Shows connection status
- Connect/Disconnect buttons
- Displays connected workspace name

## Development Workflow

### Git Branches
- `main` - Production branch (auto-deploys to Vercel)
- `claude/todo-app-integrations-Cfwcq` - Current feature branch for integrations
- Branch naming: `claude/*-Cfwcq` format required for push access

### Commit & Push
Always use:
```bash
git push -u origin <branch-name>
```
Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) on network failures.

### Creating Pull Requests
1. Push changes to feature branch
2. Create PR via GitHub: `https://github.com/alroy/To-Do/compare/main...<branch-name>`
3. Merge to main triggers auto-deployment to Vercel

## Current State
- ✅ Supabase integration complete (CRUD operations)
- ✅ Real-time sync across devices via Supabase Realtime (create, update, delete, reorder)
- ✅ Cross-tab sync for all operations including reorder
- ✅ KnotForm as FAB with modal overlay
- ✅ Hamburger menu with slide-out drawer for user profile
- ✅ Drag-and-drop functionality with persistent ordering
- ✅ Refined oklch color palette with hover states
- ✅ Optimistic UI updates with error handling
- ✅ All CSS variables defined for card styling
- ✅ Unit tests for cross-tab sync state updates
- ✅ Slack integration for auto-creating tasks from DMs and @mentions

## Important Notes
- Always use optimistic updates for better UX
- Include error rollback on database failures
- Real-time sync uses Supabase Realtime subscriptions (listens to INSERT, UPDATE, DELETE)
- Cross-tab sync works by persisting position to database and receiving UPDATE events
- REPLICA IDENTITY FULL is required for DELETE events to include user_id for filtering
- Maintain oklch color consistency across components
- Button component supports size prop for different variants
- Focus states use 1px ring with 20% opacity
- Cards use accent-hover and accent-subtle variables for states

## Slack Integration

### Overview
Auto-creates tasks when the connected user receives:
- Direct messages (DMs) in Slack
- @mentions in channels

### Environment Variables
```bash
SLACK_FEATURE_ENABLED=true|false  # Feature flag
SLACK_CLIENT_ID=                  # From Slack app settings
SLACK_CLIENT_SECRET=              # From Slack app settings
SLACK_SIGNING_SECRET=             # For webhook verification
SUPABASE_SERVICE_ROLE_KEY=        # For admin database operations
NEXT_PUBLIC_SITE_URL=             # For OAuth redirects
```

### API Routes
- `POST /api/slack/events` - Webhook for Slack Events API
- `GET /api/slack/oauth/start` - Initiates OAuth flow
- `GET /api/slack/oauth/callback` - Handles OAuth callback

### How It Works
1. User connects Slack via hamburger menu → Settings
2. OAuth flow stores credentials in `slack_connections`
3. Slack sends events to `/api/slack/events` webhook
4. Webhook verifies signature, dedupes via `slack_event_ingest`
5. If DM or mention detected, creates task for the user

### Setup
See `docs/SLACK_SETUP.md` for full setup instructions.

## Testing
Run tests with: `npm test`
Tests include:
- Cross-tab sync state updates for INSERT, UPDATE, DELETE events
- Reorder operations and position management
- Rapid sequential operations handling
- Slack signature verification (13 tests)
- Slack event processing and filtering (25 tests)
