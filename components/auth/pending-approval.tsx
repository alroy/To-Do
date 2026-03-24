"use client"

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { SetupInstructionCard } from '@/components/ui/setup-instruction-card'
import { createClient } from '@/lib/supabase-browser'

export function PendingApproval() {
  const { signOut, user } = useAuth()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const hasAcceptedTerms = user?.user_metadata?.has_accepted_terms === true

  async function handleAccept() {
    setAccepting(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      data: { has_accepted_terms: true },
    })
    if (updateError) {
      setError('Something went wrong. Please try again.')
      setAccepting(false)
      return
    }
    setAccepting(false)
  }

  if (!hasAcceptedTerms) {
    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl">
          <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8">
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 max-w-md w-full mx-auto text-center">
              <div className="mb-6 flex justify-center">
                <img
                  src="/welcome.svg"
                  alt="Welcome"
                  className="h-14 w-14"
                />
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-gray-900">Welcome to Knots</h1>
              <p className="mb-8 text-sm leading-relaxed text-gray-500">
                Before we continue, please review and accept our{' '}
                <a href="https://knots.bot/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="https://knots.bot/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Privacy Policy
                </a>
                .
              </p>

              {error && (
                <p className="mb-4 text-center text-sm text-red-600">{error}</p>
              )}

              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Accepting…' : 'I Accept'}
              </Button>
            </div>

            <div className="flex flex-col items-center gap-2">
              {user?.email && (
                <p className="text-sm text-muted-foreground">
                  Signed in as: <span className="font-medium">{user.email}</span>
                </p>
              )}
              <button
                onClick={signOut}
                className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <img
                src="/lock.svg"
                alt="Pending Approval"
                className="h-16 w-16 opacity-75"
              />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">Registration Pending</h1>
            <p className="mb-4 text-muted-foreground">
              Your account is waiting for admin approval. In the meantime, get ready to put your inbox on autopilot.
            </p>
          </div>

          <SetupInstructionCard />

          <div className="flex flex-col items-center gap-2 pt-2">
            {user?.email && (
              <p className="text-sm text-muted-foreground">
                Signed in as: <span className="font-medium">{user.email}</span>
              </p>
            )}
            <Button onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
