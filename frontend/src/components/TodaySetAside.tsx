import { useState } from 'react'
import { Link } from 'react-router'
import { api, type PotsOverview } from '../lib/api'
import { formatMoney } from '../lib/format'

// Dashboard card: "Put aside today: 18,500 IQD" with the split per pot and a
// one-tap "Done" that records it all.
export function TodaySetAside({
  overview,
  currency,
  onChange,
}: {
  overview: PotsOverview
  currency: string
  onChange: (next: PotsOverview) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (overview.pots.length === 0) {
    return (
      <Link to="/pots/new" className="mt-3 block rounded-2xl border-2 border-dashed border-stone-300 p-4 text-center active:bg-stone-100">
        <p className="font-semibold">Plan your bills & goals</p>
        <p className="mt-1 text-sm text-stone-500">Car installment, rent, new tyres… we'll tell you how much to put aside each day.</p>
      </Link>
    )
  }

  const due = overview.pots.filter((p) => p.todayLeft > 0)
  const allDone = overview.todayLeft === 0

  async function handleDone() {
    setSaving(true)
    setError(null)
    try {
      onChange(await api<PotsOverview>('/pots/set-aside', { method: 'POST', body: { date: overview.date } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-500">Put aside today</h2>
        <Link to="/pots" className="text-sm font-semibold text-emerald-700">
          Bills & goals →
        </Link>
      </div>

      {allDone ? (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-3 font-semibold text-emerald-800">
          ✓ Done for today{overview.todayTotal > 0 ? ` (${formatMoney(overview.todayTotal, currency)})` : ''}
        </p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-bold">
            {formatMoney(overview.todayLeft, currency)}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {due.map((pot) => (
              <li key={pot.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {pot.icon && <span aria-hidden>{pot.icon} </span>}
                  {pot.name}
                  {pot.overdue && <span className="ml-1 font-semibold text-red-700">· overdue</span>}
                </span>
                <span className="shrink-0 font-semibold">{formatMoney(pot.todayLeft, currency)}</span>
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={handleDone}
            disabled={saving}
            className="mt-4 h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white active:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : `Done, I put ${formatMoney(overview.todayLeft, currency)} aside`}
          </button>
        </>
      )}
    </section>
  )
}
