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

  // Get cookies store
  const cookieStore = await cookies()

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[Auth Callback] Setting', cookiesToSet.length, 'cookies')
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log('[Auth Callback]   -', name)
            cookieStore.set(name, value, options)
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

  // Return HTML that redirects client-side AFTER cookies are available
  const redirectUrl = `${origin}${next}`
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Redirecting...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: oklch(0.98 0.004 240);
            color: oklch(0.35 0.015 240);
          }
          .loader {
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            margin: 0 auto 16px;
            border: 3px solid oklch(0.90 0.008 240);
            border-top-color: oklch(0.55 0.06 240);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <script>
          console.log('[Auth Callback HTML] Cookies should now be set');
          console.log('[Auth Callback HTML] Redirecting to:', '${redirectUrl}');
          // Give browser time to process cookies, then redirect
          setTimeout(() => {
            window.location.replace('${redirectUrl}');
          }, 100);
        </script>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <p>Signing you in...</p>
        </div>
      </body>
    </html>
  `

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
