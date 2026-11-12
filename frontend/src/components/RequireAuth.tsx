import { Navigate, Outlet } from 'react-router'
import { authClient } from '../lib/auth-client'

// Wraps pages that need a logged-in user. Not logged in -> go to /login.
export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <p className="p-6 text-center text-stone-500">Loading…</p>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

// The opposite: login/sign-up pages send logged-in users to the app.
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
