import { Navigate, Outlet } from 'react-router'
import { authClient } from '../lib/auth-client'
import { Skeleton } from './ui'

// Wraps pages that need a logged-in user. Not logged in -> go to /login.
export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    // Same shape as the dashboard, so the screen doesn't jump when it loads.
    return (
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-6">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-52" />
        <Skeleton className="h-14" />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

// The opposite: login/sign-up pages send logged-in users to the app.
// Guests stay allowed, so they can create an account or log in.
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null
  if (session && !session.user.isAnonymous) return <Navigate to="/" replace />
  return <Outlet />
}
