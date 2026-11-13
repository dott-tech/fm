import { useCallback, useEffect, useState } from 'react'
import { api, type Expense, type IncomeEntry } from '../lib/api'
import { formatDay, formatMoney } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/labels'

// One row in the list: income and expenses mixed together.
type Activity = {
  id: string
  date: string
  createdAt: string
  title: string
  detail: string | null
  amount: number
  kind: 'income' | 'expense'
}

function toActivity(income: IncomeEntry[], expenses: Expense[], limit: number, currency: string): Activity[] {
  const rows: Activity[] = [
    ...income.map((e) => ({
      id: e.id,
      date: e.date,
      createdAt: e.createdAt,
      title: e.platform ?? e.source.charAt(0).toUpperCase() + e.source.slice(1),
      detail: e.platformFee ? `${formatMoney(e.platformFee, currency)} platform cut` : null,
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
        detail: e.category !== 'bills' ? e.note : null,
        amount: e.amount,
        kind: 'expense' as const,
      }
    }),
  ]
  // Newest day first; within a day, most recently added first.
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

// Recent income and expenses. Tap a row to delete a mistake.
export function RecentActivity({
  currency,
  limit = 6,
  onChanged,
}: {
  currency: string
  limit?: number
  onChanged?: () => void
}) {
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([api<IncomeEntry[]>(`/income?limit=${limit}`), api<Expense[]>(`/expenses?limit=${limit}`)])
      .then(([income, expenses]) => setActivity(toActivity(income, expenses, limit, currency)))
      .catch(() => setActivity([]))
  }, [limit, currency])

  useEffect(load, [load])

  async function remove(row: Activity) {
    setDeleting(true)
    setError(null)
    try {
      await api(`/${row.kind === 'income' ? 'income' : 'expenses'}/${row.id}`, { method: 'DELETE' })
      setOpenId(null)
      load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-stone-500">Recent</h2>
      {activity === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-stone-200" aria-label="Loading" />
      ) : activity.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-stone-600 shadow-sm">Nothing yet. Add your first income or expense above.</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm">
          {activity.map((row) => {
            const key = `${row.kind}-${row.id}`
            const open = openId === key
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-sm text-stone-500">
                      {formatDay(row.date)}
                      {row.detail ? ` · ${row.detail}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold ${row.kind === 'income' ? 'text-emerald-700' : 'text-stone-800'}`}>
                    {row.kind === 'income' ? '+' : '−'}
                    {formatMoney(row.amount, currency)}
                  </span>
                </button>
                {open && (
                  <div className="flex items-center justify-between gap-2 bg-stone-50 px-4 py-2">
                    <span className="text-sm text-stone-600">Delete this {row.kind === 'income' ? 'income' : 'expense'}?</span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => setOpenId(null)} className="h-9 rounded-lg px-3 text-sm font-semibold text-stone-600">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        disabled={deleting}
                        className="h-9 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {deleting ? '…' : 'Delete'}
                      </button>
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
