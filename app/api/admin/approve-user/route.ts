import { NextResponse, type NextRequest } from 'next/server'
import createClient from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gil.alroy@gmail.com'

export async function POST(request: NextRequest) {
  // Verify the caller is the admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('user_profile')
    .update({ approved: true })
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
