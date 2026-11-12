import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, type Expense, type IncomeEntry } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatDay, formatMoney } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/labels'

const ROLE_LABEL = { cab_driver: 'Cab driver', delivery_rider: 'Delivery rider' } as const

// One row in the recent activity list: income and expenses mixed together.
type Activity = { id: string; date: string; createdAt: string; title: string; amount: number; kind: 'income' | 'expense' }

function toActivity(income: IncomeEntry[], expenses: Expense[]): Activity[] {
  const rows: Activity[] = [
    ...income.map((e) => ({
      id: e.id,
      date: e.date,
      createdAt: e.createdAt,
      title: e.platform ?? e.source.charAt(0).toUpperCase() + e.source.slice(1),
      amount: e.amount,
      kind: 'income' as const,
    })),
    ...expenses.map((e) => {
      const category = EXPENSE_CATEGORIES.find((c) => c.value === e.category)
      return {
        id: e.id,
        date: e.date,
        createdAt: e.createdAt,
        title: `${category?.icon ?? ''} ${category?.label ?? e.category}`.trim(),
        amount: e.amount,
        kind: 'expense' as const,
      }
    }),
  ]
  // Newest day first; within a day, most recently added first.
  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
}

// Temporary home until the dashboard step: quick actions + recent activity.
export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const user = session?.user
  const currency = user?.currency ?? 'IQD'

  const flash = (location.state as { flash?: string } | null)?.flash
  const [activity, setActivity] = useState<Activity[] | null>(null)

  useEffect(() => {
    Promise.all([api<IncomeEntry[]>('/income?limit=8'), api<Expense[]>('/expenses?limit=8')])
      .then(([income, expenses]) => setActivity(toActivity(income, expenses)))
      .catch(() => setActivity([]))
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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/income/new"
          className="flex h-14 items-center justify-center rounded-xl bg-emerald-700 text-lg font-semibold text-white active:bg-emerald-800"
        >
          + Income
        </Link>
        <Link
          to="/expenses/new"
          className="flex h-14 items-center justify-center rounded-xl bg-stone-800 text-lg font-semibold text-white active:bg-stone-900"
        >
          − Expense
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">Recent</h2>
        {activity === null ? (
          <p className="text-stone-500">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-stone-600 shadow-sm">Nothing yet. Add your first income or expense above.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl bg-white shadow-sm">
            {activity.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-sm text-stone-500">{formatDay(row.date)}</p>
                </div>
                <p className={`font-semibold ${row.kind === 'income' ? 'text-emerald-700' : 'text-stone-800'}`}>
                  {row.kind === 'income' ? '+' : '−'}
                  {formatMoney(row.amount, currency)}
                </p>
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
