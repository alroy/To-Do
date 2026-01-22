"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleGoogleLogin = async () => {
    setLoading(true)
    setMessage("")

    try {
      const { createClient } = await import("@/lib/supabase-browser")
      const supabase = createClient()

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
      }
    } catch (error) {
      setMessage("Failed to initialize authentication")
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setMessage("Please enter your email")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const { createClient } = await import("@/lib/supabase-browser")
      const supabase = createClient()

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage("Check your email for the login link")
      }
    } catch (error) {
      setMessage("Failed to send magic link")
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Knots</h1>
          <p className="mt-2 text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              Send magic link
            </Button>
          </form>

          {message && (
            <p className={`text-sm text-center ${
              message.includes("Check your email")
                ? "text-muted-foreground"
                : "text-destructive-foreground"
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
