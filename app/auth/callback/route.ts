import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('[Auth Callback] Processing OAuth callback')
  console.log('[Auth Callback] Has code:', !!code)

  if (!code) {
    console.error('[Auth Callback] ✗ No code provided')
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  const redirectUrl = `${origin}${next}`
  const response = NextResponse.redirect(redirectUrl)

  // Get cookies store
  const cookieStore = await cookies()

  // Create Supabase client that sets cookies on BOTH the store AND the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[Auth Callback] Setting', cookiesToSet.length, 'cookies')
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log('[Auth Callback]   -', name, '(maxAge:', options?.maxAge, 's)')
            // BELT: Set on cookie store
            try {
              cookieStore.set(name, value, options)
            } catch (e) {
              console.error('[Auth Callback] Failed to set cookie on store:', name, e)
            }
            // SUSPENDERS: Set on response object
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  console.log('[Auth Callback] Exchanging code for session...')
  const { error, data } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] ✗ Error:', error.message)
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`)
  }

  console.log('[Auth Callback] ✓ Session exchanged!')
  console.log('[Auth Callback] ✓ User:', data.user?.email)

  // Verify cookies on response
  const responseCookies = response.cookies.getAll()
  console.log('[Auth Callback] ✓ Response has', responseCookies.length, 'cookies')

  return response
}
