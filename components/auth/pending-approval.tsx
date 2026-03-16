"use client"

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'

export function PendingApproval() {
  const { signOut, user, recheckApproval } = useAuth()
  const [checking, setChecking] = useState(false)

  const avatarUrl = user?.user_metadata?.avatar_url

  const handleCheckAgain = async () => {
    setChecking(true)
    await recheckApproval()
    setChecking(false)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-foreground">Pending Approval</h1>
            <p className="mb-4 text-muted-foreground">
              Your account is awaiting approval from an administrator.
            </p>
            {user?.email && (
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleCheckAgain} disabled={checking}>
              {checking ? 'Checking...' : 'Check again'}
            </Button>
            <Button onClick={signOut} variant="ghost">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
