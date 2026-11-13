import { useSearchParams } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { Rise, Skeleton } from '../components/ui'
import { fmt, useI18n } from '../i18n'
import type { WeekSummary } from '../lib/api'
import { currencyLabel, formatMoney, formatNumber, formatWeekRange, formatWeekdayDay, localIsoDate, shiftIsoDay } from '../lib/format'
import { costMeta } from '../lib/labels'
import { useWeek } from '../lib/queries'

// Weekly summary: one Saturday-Friday week, with arrows to older weeks.
// The week shown lives in the URL (?date=...), so back/forward work.
// While the next week loads, the previous one stays on screen (no blank flash).
export function WeekPage() {
  const { m } = useI18n()
  const [params, setParams] = useSearchParams()
  const today = localIsoDate()
  const date = params.get('date') ?? today
  const { data: week, error, isPlaceholderData } = useWeek(date)

  const isCurrentWeek = week ? today >= week.weekStart && today <= week.weekEnd : date === today
  const goTo = (isoDay: string) => setParams(isoDay === today ? {} : { date: isoDay }, { viewTransition: true })

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader title={m.week.title} />

      {/* Week switcher. Arrows flip direction in Arabic (right-to-left). */}
      <div className="rise mb-4 flex items-center justify-between rounded-2xl bg-surface p-2 shadow-sm">
        <button
          onClick={() => week && goTo(shiftIsoDay(week.weekStart, -7))}
          aria-label={m.week.previous}
          className="grid h-11 w-11 place-items-center rounded-xl text-2xl active:bg-surface-2"
        >
          <span className="rtl:rotate-180">‹</span>
        </button>
        <div className="text-center">
          <p className="font-semibold">{week ? formatWeekRange(week.weekStart, week.weekEnd) : '…'}</p>
          <p className="text-xs text-muted">{isCurrentWeek ? m.week.thisWeek : m.week.satToFri}</p>
        </div>
        <button
          onClick={() => week && goTo(shiftIsoDay(week.weekEnd, 1))}
          aria-label={m.week.next}
          disabled={isCurrentWeek}
          className="grid h-11 w-11 place-items-center rounded-xl text-2xl active:bg-surface-2 disabled:opacity-30"
        >
          <span className="rtl:rotate-180">›</span>
        </button>
      </div>

      {error && !week && <p className="rounded-xl bg-bad-soft px-4 py-3 text-bad-ink">{m.week.couldNotLoad}</p>}
      {!week && !error && <Skeleton className="h-64 rounded-3xl" />}
      {week && (
        <div className={`transition-opacity duration-200 ${isPlaceholderData ? 'opacity-50' : ''}`}>
          <WeekDetails week={week} isCurrentWeek={isCurrentWeek} />
        </div>
      )}
    </main>
  )
}

function WeekDetails({ week, isCurrentWeek }: { week: WeekSummary; isCurrentWeek: boolean }) {
  const { m } = useI18n()
  const { currency } = week
  const money = (n: number) => formatMoney(n, currency)

  // Verdict: the answer to "did I hit my target?"
  let verdict: { icon: string; text: string; tone: string }
  const nothingLogged = week.incomeEntries === 0 && week.expenses === 0
  if (nothingLogged) {
    verdict = { icon: '•', text: m.week.nothingLogged, tone: 'bg-surface-2 text-ink-2' }
  } else if (week.target === null) {
    verdict = { icon: '•', text: m.week.noTarget, tone: 'bg-surface-2 text-ink-2' }
  } else if (week.targetHit) {
    verdict = { icon: '✓', text: fmt(m.week.targetHit, { amount: money(week.target) }), tone: 'bg-good-soft text-good-ink' }
  } else if (isCurrentWeek) {
    verdict = { icon: '…', text: fmt(m.week.toGo, { amount: money(week.remainingToTarget ?? 0) }), tone: 'bg-warn-soft text-warn-ink' }
  } else {
    verdict = { icon: '✗', text: fmt(m.week.missedBy, { amount: money(week.remainingToTarget ?? 0) }), tone: 'bg-bad-soft text-bad-ink' }
  }

  // Daily bars share one scale: the biggest day (income or cost) is full width.
  const maxDay = Math.max(1, ...week.days.map((d) => Math.max(d.income, d.expenses)))

  return (
    <div className="space-y-4">
      <Rise i={1}>
        <section className="rounded-3xl bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{m.dashboard.leftAfterCosts}</p>
          <p className={`mt-1 text-5xl font-bold ${week.net < 0 ? 'text-bad-ink' : ''}`}>
            <span dir="ltr">
              {week.net < 0 ? '−' : ''}
              {formatNumber(Math.abs(week.net))}
            </span>{' '}
            <span className="text-lg font-semibold text-muted">{currencyLabel(currency)}</span>
          </p>
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${verdict.tone}`}>
            <span aria-hidden>{verdict.icon}</span> {verdict.text}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{m.dashboard.income}</dt>
            <dd className="text-end font-semibold">{money(week.income)}</dd>
            <dt className="text-muted">{m.dashboard.costs}</dt>
            <dd className="text-end font-semibold">{money(week.expenses)}</dd>
            {week.tips > 0 && (
              <>
                <dt className="text-muted">{m.income.tips}</dt>
                <dd className="text-end font-semibold">{money(week.tips)}</dd>
              </>
            )}
            <dt className="text-muted">{m.week.hoursLogged}</dt>
            <dd className="text-end font-semibold">{week.hours > 0 ? formatNumber(week.hours) : '—'}</dd>
            <dt className="text-muted">{m.dashboard.realPerHour}</dt>
            <dd className="text-end font-semibold">
              {week.netPerHour === null ? '—' : fmt(m.dashboard.perHourUnit, { currency: money(week.netPerHour) })}
            </dd>
            {week.orderCount > 0 && (
              <>
                <dt className="text-muted">{m.week.tripsOrders}</dt>
                <dd className="text-end font-semibold">{formatNumber(week.orderCount)}</dd>
              </>
            )}
          </dl>
        </section>
      </Rise>

      <Rise i={2}>
        <section className="rounded-3xl bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-muted">{m.week.dayByDay}</h2>
          <div className="mb-3 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-good-bar" /> {m.dashboard.income}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-bar-neutral" /> {m.dashboard.costs}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>{m.week.day}</th>
                <th>{m.week.incomeAndCosts}</th>
                <th>{m.week.net}</th>
              </tr>
            </thead>
            <tbody>
              {week.days.map((day) => {
                const net = day.income - day.expenses
                const empty = day.income === 0 && day.expenses === 0
                return (
                  <tr key={day.date} title={fmt(m.week.dayTooltip, { income: money(day.income), costs: money(day.expenses) })}>
                    <td className="w-20 py-1.5 text-muted">{formatWeekdayDay(day.date)}</td>
                    <td className="py-1.5">
                      <div className="space-y-0.5">
                        <div className="bar h-2 rounded-full bg-good-bar" style={{ width: `${(day.income / maxDay) * 100}%` }} />
                        <div className="bar h-2 rounded-full bg-bar-neutral" style={{ width: `${(day.expenses / maxDay) * 100}%` }} />
                      </div>
                    </td>
                    <td dir="ltr" className={`w-24 py-1.5 text-end tabular-nums ${empty ? 'text-faint' : net < 0 ? 'text-bad-ink' : 'font-semibold'} rtl:text-start`}>
                      {empty ? '—' : `${net < 0 ? '−' : ''}${formatNumber(Math.abs(net))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </Rise>

      {week.expensesByCategory.length > 0 && (
        <Rise i={3}>
          <section className="rounded-3xl bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-muted">{m.week.costsByCategory}</h2>
            <ul className="space-y-2 text-sm">
              {week.expensesByCategory.map((row) => {
                const meta = costMeta(row.category)
                const share = week.expenses > 0 ? Math.round((row.amount / week.expenses) * 100) : 0
                return (
                  <li key={row.category} className="flex justify-between">
                    <span>
                      <span aria-hidden>{meta.icon}</span> {meta.label}
                    </span>
                    <span>
                      <span className="font-semibold">{money(row.amount)}</span> <span className="text-faint">({share}%)</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </Rise>
      )}
    </div>
  )
}
