import { useEffect, useState } from 'react'
import { api, type Expense, type IncomeEntry } from '../lib/api'
import { formatDay, formatMoney } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/labels'

// One row in the list: income and expenses mixed together.
type Activity = { id: string; date: string; createdAt: string; title: string; amount: number; kind: 'income' | 'expense' }

function toActivity(income: IncomeEntry[], expenses: Expense[], limit: number): Activity[] {
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
        // Paid bills carry the bill's name in the note ("📅 Car installment").
        title: `${category?.icon ?? ''} ${e.category === 'bills' && e.note ? e.note : (category?.label ?? e.category)}`.trim(),
        amount: e.amount,
        kind: 'expense' as const,
      }
    }),
  ]
  // Newest day first; within a day, most recently added first.
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

export function RecentActivity({ currency, limit = 5 }: { currency: string; limit?: number }) {
  const [activity, setActivity] = useState<Activity[] | null>(null)

  useEffect(() => {
    Promise.all([api<IncomeEntry[]>(`/income?limit=${limit}`), api<Expense[]>(`/expenses?limit=${limit}`)])
      .then(([income, expenses]) => setActivity(toActivity(income, expenses, limit)))
      .catch(() => setActivity([]))
  }, [limit])

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-stone-500">Recent</h2>
      {activity === null ? (
        <p className="text-stone-500">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-stone-600 shadow-sm">Nothing yet. Add your first income or expense above.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl bg-white shadow-sm">
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
  )
}
