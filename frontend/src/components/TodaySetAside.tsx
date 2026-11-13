import { Link } from 'react-router'
import { fmt, useI18n } from '../i18n'
import type { PotsOverview } from '../lib/api'
import { formatMoney } from '../lib/format'
import { useSetAside, useSkipToday, useUndoSkip } from '../lib/queries'

// Dashboard card: "Put aside today: 18,500 IQD" with the split per pot,
// a one-tap "Done", and "Skip today" for days the driver can't save.
export function TodaySetAside({ overview, currency }: { overview: PotsOverview; currency: string }) {
  const { m } = useI18n()
  const setAside = useSetAside()
  const skip = useSkipToday()
  const undo = useUndoSkip()
  const busy = setAside.isPending || skip.isPending || undo.isPending
  const error = setAside.error ?? skip.error ?? undo.error

  if (overview.pots.length === 0) {
    return (
      <Link
        to="/pots/new"
        viewTransition
        className="press block rounded-2xl border-2 border-dashed border-line-strong p-4 text-center active:bg-surface-2"
      >
        <p className="font-semibold">{m.setAside.emptyTitle}</p>
        <p className="mt-1 text-sm text-muted">{m.setAside.emptyBody}</p>
      </Link>
    )
  }

  // From tomorrow on: what each working day will ask for.
  const perWorkingDay = overview.pots.reduce((sum, p) => sum + p.dailyAmount, 0)
  const due = overview.pots.filter((p) => p.todayLeft > 0)

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-muted">{m.setAside.title}</h2>
        <Link to="/pots" viewTransition className="text-sm font-semibold text-accent-ink">
          {m.setAside.plansLink}
        </Link>
      </div>

      {overview.todayStatus === 'off' && (
        <div className="pop mt-2 rounded-xl bg-info-soft px-3 py-3 text-info-ink">
          <p className="font-semibold">{m.setAside.dayOff}</p>
          <p className="mt-0.5 text-sm">{fmt(m.setAside.nextWorkingDay, { amount: formatMoney(perWorkingDay, currency) })}</p>
        </div>
      )}

      {overview.todayStatus === 'skipped' && (
        <div className="pop mt-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-3">
          <div>
            <p className="font-semibold">{m.setAside.skipped}</p>
            <p className="mt-0.5 text-sm text-ink-2">{fmt(m.setAside.spread, { amount: formatMoney(perWorkingDay, currency) })}</p>
          </div>
          <button
            onClick={() => undo.mutate(overview.date)}
            disabled={busy}
            className="h-10 shrink-0 rounded-xl px-3 font-semibold text-accent-ink active:bg-surface-3"
          >
            {undo.isPending ? '…' : m.setAside.undo}
          </button>
        </div>
      )}

      {overview.todayStatus === 'work' &&
        (overview.todayLeft === 0 ? (
          <p className="pop mt-2 rounded-xl bg-good-soft px-3 py-3 font-semibold text-good-ink">
            {m.setAside.doneToday}
            {overview.todayTotal > 0 ? ` (${formatMoney(overview.todayTotal, currency)})` : ''}
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
                    {pot.overdue && <span className="ms-1 font-semibold text-bad-ink">· {m.setAside.overdue}</span>}
                  </span>
                  <span className="shrink-0 font-semibold">{formatMoney(pot.todayLeft, currency)}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setAside.mutate(overview.date)}
              disabled={busy}
              className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-white active:bg-accent-pressed disabled:opacity-60"
            >
              {setAside.isPending ? m.common.saving : fmt(m.setAside.doneButton, { amount: formatMoney(overview.todayLeft, currency) })}
            </button>
            <button
              onClick={() => skip.mutate(overview.date)}
              disabled={busy}
              className="mt-2 h-11 w-full rounded-xl font-semibold text-ink-2 active:bg-surface-2 disabled:opacity-60"
            >
              {skip.isPending ? m.setAside.skipping : m.setAside.skipButton}
            </button>
          </>
        ))}

      {error && <p className="mt-2 text-sm text-bad-ink">{error.message}</p>}
    </section>
  )
}
