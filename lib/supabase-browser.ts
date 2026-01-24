import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!url || url === 'undefined') {
    console.error('[Browser Client] Missing NEXT_PUBLIC_SUPABASE_URL')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!key || key === 'undefined') {
    console.error('[Browser Client] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  console.log('[Browser Client] Creating client with URL:', url)
  return createBrowserClient(url, key)
}
