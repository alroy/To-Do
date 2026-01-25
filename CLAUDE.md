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
- `created_at` (timestamp)
- `completed_at` (timestamp, nullable)

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

### `/components/knot-form.tsx`
Collapsible form with custom UX:
- Starts as circular icon button with knot SVG
- Expands to full form on click
- Collapses on submit/cancel
- Custom KnotIcon SVG component

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
- ✅ Real-time sync across devices via Supabase Realtime
- ✅ Collapsible form with knot icon button
- ✅ Drag-and-drop functionality
- ✅ Refined oklch color palette with hover states
- ✅ Optimistic UI updates with error handling
- ✅ All CSS variables defined for card styling
- ✅ Authentication: Email/password login + Magic link
- ⚠️ Password reset flow has issues (see Known Issues below)

## Authentication System

### Overview
The app uses Supabase Auth with multiple login methods:
- **Email/password** (default) - Standard login
- **Magic link** - Passwordless email link
- **Password reset** - Email-based password recovery

### Key Files
- `/contexts/auth-context.tsx` - Auth state management, login methods
- `/components/auth/sign-in.tsx` - Login UI (email/password + magic link toggle)
- `/components/auth/reset-password.tsx` - Password reset form
- `/app/auth/callback/route.ts` - Server-side auth callback handler
- `/lib/supabase-browser.ts` - Browser Supabase client
- `/lib/supabase-server.ts` - Server Supabase client

### Auth Flow
1. User enters email/password OR requests magic link
2. For magic link: Supabase sends email, user clicks link
3. Link redirects to app with tokens in URL hash or query params
4. `auth-context.tsx` extracts tokens and establishes session
5. `onAuthStateChange` fires, user state updates

### Email Whitelist
Only `gil.alroy@gmail.com` is authorized (hardcoded in `auth-context.tsx`).

### Page Render Order (`page.tsx`)
```
1. if (authLoading) → Loading spinner
2. if (!user) → SignIn page
3. if (isPasswordRecovery) → ResetPassword form
4. if (!isAuthorized) → Unauthorized page
5. else → Main app (Knots)
```

## Known Issues

### Password Reset Flow (CRITICAL)
**Problem:** When user clicks password reset link from Supabase email, they see the login page instead of the password reset form.

**Reset Link Format:**
```
https://[supabase-project].supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://v0-knots-taker.vercel.app
```

After Supabase verifies, redirects to:
```
https://v0-knots-taker.vercel.app#access_token=...&refresh_token=...&type=recovery
```

**Root Cause Analysis:**
The issue is timing/order of operations:
1. Page loads with `#access_token=...&type=recovery` in URL hash
2. `auth-context.tsx` useEffect runs:
   - Extracts tokens from hash
   - Sets `isPasswordRecovery = true`
   - Calls `supabase.auth.setSession()` to establish session
3. But `page.tsx` checks `!user` BEFORE `isPasswordRecovery`
4. If session isn't established yet, shows SignIn instead of ResetPassword

**Attempted Solutions:**
1. ❌ Check URL hash synchronously in useState - SSR hydration mismatch
2. ❌ Use `pendingRecovery` state - Race conditions
3. ❌ Rely on `onAuthStateChange` PASSWORD_RECOVERY event - Fires too late
4. ⚠️ Manually set session from hash tokens - Current approach, still has timing issues

**Potential Fix Directions:**
1. Change page.tsx render order: check `isPasswordRecovery` BEFORE `!user`
2. Create dedicated `/reset-password` route that only handles recovery
3. Use URL-based state (e.g., `?mode=recovery`) that persists across renders
4. Keep `loading=true` until BOTH session AND recovery state are resolved

## Important Notes
- Always use optimistic updates for better UX
- Include error rollback on database failures
- Real-time sync uses Supabase Realtime subscriptions (listens to INSERT, UPDATE, DELETE)
- Maintain oklch color consistency across components
- Button component supports size prop for different variants
- Focus states use 1px ring with 20% opacity
- Cards use accent-hover and accent-subtle variables for states
