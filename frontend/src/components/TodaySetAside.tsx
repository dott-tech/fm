import { useState } from 'react'
import { Link } from 'react-router'
import { api, type PotsOverview } from '../lib/api'
import { formatMoney } from '../lib/format'

// Dashboard card: "Put aside today: 18,500 IQD" with the split per pot,
// a one-tap "Done", and "Skip today" for days the driver can't save.
export function TodaySetAside({
  overview,
  currency,
  onChange,
}: {
  overview: PotsOverview
  currency: string
  onChange: (next: PotsOverview) => void
}) {
  const [busy, setBusy] = useState<null | 'done' | 'skip' | 'undo'>(null)
  const [error, setError] = useState<string | null>(null)

  if (overview.pots.length === 0) {
    return (
      <Link to="/pots/new" className="block rounded-2xl border-2 border-dashed border-stone-300 p-4 text-center active:bg-stone-100">
        <p className="font-semibold">Plan your bills & goals</p>
        <p className="mt-1 text-sm text-stone-500">Car installment, rent, new tyres… we'll tell you how much to put aside each day.</p>
      </Link>
    )
  }

  async function run(kind: 'done' | 'skip' | 'undo', request: () => Promise<PotsOverview>) {
    setBusy(kind)
    setError(null)
    try {
      onChange(await request())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const date = overview.date
  const done = () => run('done', () => api<PotsOverview>('/pots/set-aside', { method: 'POST', body: { date } }))
  const skip = () => run('skip', () => api<PotsOverview>('/pots/skip', { method: 'POST', body: { date } }))
  const undo = () => run('undo', () => api<PotsOverview>(`/pots/skip?date=${date}`, { method: 'DELETE' }))

  // From tomorrow on: what each working day will ask for.
  const perWorkingDay = overview.pots.reduce((sum, p) => sum + p.dailyAmount, 0)
  const due = overview.pots.filter((p) => p.todayLeft > 0)

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-500">Put aside today</h2>
        <Link to="/pots" className="text-sm font-semibold text-emerald-700">
          Bills & goals →
        </Link>
      </div>

      {overview.todayStatus === 'off' && (
        <div className="mt-2 rounded-xl bg-sky-50 px-3 py-3 text-sky-900">
          <p className="font-semibold">🌙 Day off. Nothing to put aside.</p>
          <p className="mt-0.5 text-sm">Next working day: {formatMoney(perWorkingDay, currency)}</p>
        </div>
      )}

      {overview.todayStatus === 'skipped' && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-stone-100 px-3 py-3">
          <div>
            <p className="font-semibold">⏭ Skipped today</p>
            <p className="mt-0.5 text-sm text-stone-600">Spread over the coming days: {formatMoney(perWorkingDay, currency)}/day</p>
          </div>
          <button onClick={undo} disabled={busy !== null} className="h-10 shrink-0 rounded-xl px-3 font-semibold text-emerald-700 active:bg-stone-200">
            {busy === 'undo' ? '…' : 'Undo'}
          </button>
        </div>
      )}

      {overview.todayStatus === 'work' &&
        (overview.todayLeft === 0 ? (
          <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-3 font-semibold text-emerald-800">
            ✓ Done for today{overview.todayTotal > 0 ? ` (${formatMoney(overview.todayTotal, currency)})` : ''}
          </p>
        ) : (
          <>
            <p className="mt-1 text-3xl font-bold">{formatMoney(overview.todayLeft, currency)}</p>
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
            <button
              onClick={done}
              disabled={busy !== null}
              className="mt-4 h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white active:bg-emerald-800 disabled:opacity-60"
            >
              {busy === 'done' ? 'Saving…' : `Done, I put ${formatMoney(overview.todayLeft, currency)} aside`}
            </button>
            <button
              onClick={skip}
              disabled={busy !== null}
              className="mt-2 h-11 w-full rounded-xl font-semibold text-stone-600 active:bg-stone-100 disabled:opacity-60"
            >
              {busy === 'skip' ? 'Skipping…' : "Can't today? Skip and spread it out"}
            </button>
          </>
        ))}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
