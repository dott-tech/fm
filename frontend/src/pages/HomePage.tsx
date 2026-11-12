import { useNavigate } from 'react-router'
import { authClient } from '../lib/auth-client'

const ROLE_LABEL = { cab_driver: 'Cab driver', delivery_rider: 'Delivery rider' } as const

// Placeholder until the dashboard step: proves the session works end to end.
export function HomePage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const user = session?.user

  async function handleLogout() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Hi {user?.name}</h1>
      <p className="mt-1 text-stone-600">
        {user ? ROLE_LABEL[user.role] : ''} · {user?.currency ?? 'IQD'}
      </p>
      <p className="mt-8 rounded-xl bg-white p-4 text-stone-600 shadow-sm">Your dashboard is coming next.</p>
      <button onClick={handleLogout} className="mt-8 h-12 w-full rounded-xl border border-stone-300 font-semibold">
        Log out
      </button>
    </main>
  )
}
