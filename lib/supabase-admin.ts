import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using service role key.
 * This client bypasses RLS and should only be used in server-side code
 * for operations that need elevated privileges (e.g., webhook processing).
 *
 * IMPORTANT: Never expose or log the service role key.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin configuration')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
