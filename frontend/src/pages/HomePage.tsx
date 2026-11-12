import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, type IncomeEntry } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatDay, formatMoney } from '../lib/format'

const ROLE_LABEL = { cab_driver: 'Cab driver', delivery_rider: 'Delivery rider' } as const

// Temporary home until the dashboard step: shows recent income so the
// add-income flow can be checked end to end.
export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const user = session?.user
  const currency = user?.currency ?? 'IQD'

  const flash = (location.state as { flash?: string } | null)?.flash
  const [recent, setRecent] = useState<IncomeEntry[] | null>(null)

  useEffect(() => {
    api<IncomeEntry[]>('/income?limit=5')
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])

  async function handleLogout() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold">Hi {user?.name}</h1>
      <p className="mt-1 text-stone-600">{user ? ROLE_LABEL[user.role] : ''}</p>

      {flash && (
        <p role="status" className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          ✓ {flash}
        </p>
      )}

      <Link
        to="/income/new"
        className="mt-6 flex h-14 items-center justify-center rounded-xl bg-emerald-700 text-lg font-semibold text-white active:bg-emerald-800"
      >
        + Add income
      </Link>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">Recent income</h2>
        {recent === null ? (
          <p className="text-stone-500">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-stone-600 shadow-sm">No income yet. Add your first one above.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl bg-white shadow-sm">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium capitalize">{entry.platform ?? entry.source}</p>
                  <p className="text-sm text-stone-500">{formatDay(entry.date)}</p>
                </div>
                <p className="font-semibold">{formatMoney(entry.amount, currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 rounded-xl bg-white p-4 text-sm text-stone-500 shadow-sm">The full dashboard is coming next.</p>
      <button onClick={handleLogout} className="mt-6 h-12 w-full rounded-xl border border-stone-300 font-semibold">
        Log out
      </button>
    </main>
  )
}
