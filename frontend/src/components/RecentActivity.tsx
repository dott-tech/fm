import { useState } from 'react'
import { fmt, useI18n } from '../i18n'
import type { Expense, IncomeEntry } from '../lib/api'
import { formatDay, formatMoney } from '../lib/format'
import { costMeta } from '../lib/labels'
import { useDeleteEntry } from '../lib/queries'

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

// Recent income and expenses (data comes with the dashboard request).
// Tap a row to delete a mistake.
export function RecentActivity({
  income,
  expenses,
  currency,
  limit = 6,
}: {
  income: IncomeEntry[]
  expenses: Expense[]
  currency: string
  limit?: number
}) {
  const { m } = useI18n()
  const [openId, setOpenId] = useState<string | null>(null)
  const remove = useDeleteEntry()

  const rows: Activity[] = [
    ...income.map((e) => ({
      id: e.id,
      date: e.date,
      createdAt: e.createdAt,
      title: e.platform ?? m.sources[e.source],
      detail: e.platformFee ? fmt(m.recent.platformCut, { amount: formatMoney(e.platformFee, currency) }) : null,
      amount: e.amount,
      kind: 'income' as const,
    })),
    ...expenses.map((e) => {
      const meta = costMeta(e.category)
      return {
        id: e.id,
        date: e.date,
        createdAt: e.createdAt,
        // Paid bills carry the bill's name in the note ("📅 Car installment").
        title: `${meta.icon} ${e.category === 'bills' && e.note ? e.note : meta.label}`.trim(),
        detail: e.category !== 'bills' ? e.note : null,
        amount: e.amount,
        kind: 'expense' as const,
      }
    }),
  ]
    // Newest day first; within a day, most recently added first.
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted">{m.recent.title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-ink-2 shadow-sm">{m.recent.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">
          {rows.map((row) => {
            const key = `${row.kind}-${row.id}`
            const open = openId === key
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start active:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {formatDay(row.date)}
                      {row.detail ? ` · ${row.detail}` : ''}
                    </span>
                  </span>
                  <span dir="ltr" className={`shrink-0 font-semibold ${row.kind === 'income' ? 'text-accent-ink' : 'text-ink'}`}>
                    {row.kind === 'income' ? '+' : '−'}
                    {formatMoney(row.amount, currency)}
                  </span>
                </button>
                {open && (
                  <div className="pop flex items-center justify-between gap-2 bg-surface-2 px-4 py-2">
                    <span className="text-sm text-ink-2">{row.kind === 'income' ? m.recent.deleteIncome : m.recent.deleteExpense}</span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => setOpenId(null)} className="h-9 rounded-lg px-3 text-sm font-semibold text-ink-2">
                        {m.common.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove.mutate({ kind: row.kind, id: row.id }, { onSuccess: () => setOpenId(null) })}
                        disabled={remove.isPending}
                        className="h-9 rounded-lg bg-bad-button px-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {remove.isPending ? '…' : m.common.delete}
                      </button>
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {remove.error && <p className="mt-2 text-sm text-bad-ink">{remove.error.message}</p>}
    </section>
  )
}
