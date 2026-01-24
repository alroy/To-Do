import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  console.log('[Auth Callback] ==========================================')
  console.log('[Auth Callback] Processing OAuth callback')
  console.log('[Auth Callback] Has code:', !!code)
  console.log('[Auth Callback] Origin:', origin)

  if (!code) {
    console.error('[Auth Callback] ✗ No code provided in callback')
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  // Use placeholder values during build if env vars are missing
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  console.log('[Auth Callback] Supabase URL:', url)

  // CRITICAL: Create response FIRST, then set cookies on it during exchangeCodeForSession
  let response = NextResponse.redirect(`${origin}/`)

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[Auth Callback] Setting', cookiesToSet.length, 'cookies on response object')
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log('[Auth Callback]   - Setting cookie:', name)
            console.log('[Auth Callback]     - maxAge:', options?.maxAge)
            console.log('[Auth Callback]     - path:', options?.path)
            console.log('[Auth Callback]     - domain:', options?.domain)
            console.log('[Auth Callback]     - sameSite:', options?.sameSite)

            // Set cookie on BOTH request and response to ensure it persists
            request.cookies.set(name, value)
            response.cookies.set(name, value, {
              ...options,
              // Force these settings for maximum compatibility
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax'
            })
          })
        },
      },
    }
  )

  try {
    console.log('[Auth Callback] Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] ✗ Error exchanging code:', error.message)
      console.error('[Auth Callback] ✗ Error details:', error)
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`)
    }

    if (!data.session) {
      console.error('[Auth Callback] ✗ No session returned after code exchange')
      return NextResponse.redirect(`${origin}/?error=no_session`)
    }

    console.log('[Auth Callback] ✓ Session exchanged successfully!')
    console.log('[Auth Callback] ✓ User email:', data.user?.email)
    console.log('[Auth Callback] ✓ Access token (first 20 chars):', data.session.access_token.substring(0, 20))
    console.log('[Auth Callback] ✓ Refresh token exists:', !!data.session.refresh_token)
    console.log('[Auth Callback] ✓ Session expires:', new Date(data.session.expires_at! * 1000).toISOString())

    // Log all cookies that will be sent
    const responseCookies = response.cookies.getAll()
    console.log('[Auth Callback] ✓ Total cookies on response:', responseCookies.length)
    responseCookies.forEach(cookie => {
      console.log('[Auth Callback]   - Response cookie:', cookie.name, 'length:', cookie.value.length)
    })

    console.log('[Auth Callback] ✓ Redirecting to home page')
    console.log('[Auth Callback] ==========================================')

    return response
  } catch (err) {
    console.error('[Auth Callback] ✗ Unexpected error:', err)
    return NextResponse.redirect(`${origin}/?error=unexpected_error`)
  }
}
