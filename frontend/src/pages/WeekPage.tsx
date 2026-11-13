import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { api, type WeekSummary } from '../lib/api'
import { formatMoney, formatNumber, formatWeekRange, localIsoDate } from '../lib/format'
import { costMeta } from '../lib/labels'

function shiftDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const date = new Date(y!, m! - 1, d! + days)
  return localIsoDate(date)
}

function weekdayShort(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

// Weekly summary: one Saturday-Friday week, with arrows to older weeks.
// The week shown lives in the URL (?date=...), so back/forward and sharing work.
export function WeekPage() {
  const [params, setParams] = useSearchParams()
  const today = localIsoDate()
  const date = params.get('date') ?? today

  const [week, setWeek] = useState<WeekSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setWeek(null)
    setError(false)
    api<WeekSummary>(`/summary/week?date=${date}`)
      .then((data) => !cancelled && setWeek(data))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [date])

  const isCurrentWeek = week ? today >= week.weekStart && today <= week.weekEnd : date === today
  const goTo = (isoDay: string) => setParams(isoDay === today ? {} : { date: isoDay })

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader title="Weekly summary" />

      {/* Week switcher */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        <button
          onClick={() => week && goTo(shiftDays(week.weekStart, -7))}
          aria-label="Previous week"
          className="grid h-11 w-11 place-items-center rounded-xl text-xl active:bg-stone-100"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold">{week ? formatWeekRange(week.weekStart, week.weekEnd) : '…'}</p>
          <p className="text-xs text-stone-500">{isCurrentWeek ? 'This week' : 'Saturday to Friday'}</p>
        </div>
        <button
          onClick={() => week && goTo(shiftDays(week.weekEnd, 1))}
          aria-label="Next week"
          disabled={isCurrentWeek}
          className="grid h-11 w-11 place-items-center rounded-xl text-xl active:bg-stone-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">Couldn't load this week. Check your connection and reopen this page.</p>}
      {!week && !error && <div className="h-64 animate-pulse rounded-3xl bg-stone-200" aria-label="Loading" />}
      {week && <WeekDetails week={week} isCurrentWeek={isCurrentWeek} />}
    </main>
  )
}

function WeekDetails({ week, isCurrentWeek }: { week: WeekSummary; isCurrentWeek: boolean }) {
  const { currency } = week

  // Verdict: the answer to "did I hit my target?"
  let verdict: { icon: string; text: string; tone: string }
  const nothingLogged = week.incomeEntries === 0 && week.expenses === 0
  if (nothingLogged) {
    verdict = { icon: '•', text: 'Nothing logged this week', tone: 'bg-stone-100 text-stone-700' }
  } else if (week.target === null) {
    verdict = { icon: '•', text: 'No target set for this week', tone: 'bg-stone-100 text-stone-700' }
  } else if (week.targetHit) {
    verdict = { icon: '✓', text: `Target hit (${formatMoney(week.target, currency)})`, tone: 'bg-emerald-50 text-emerald-800' }
  } else if (isCurrentWeek) {
    verdict = {
      icon: '…',
      text: `${formatMoney(week.remainingToTarget ?? 0, currency)} to go to target`,
      tone: 'bg-amber-50 text-amber-800',
    }
  } else {
    verdict = {
      icon: '✗',
      text: `Missed target by ${formatMoney(week.remainingToTarget ?? 0, currency)}`,
      tone: 'bg-red-50 text-red-800',
    }
  }

  // Daily bars share one scale: the biggest day (income or cost) is full width.
  const maxDay = Math.max(1, ...week.days.map((d) => Math.max(d.income, d.expenses)))

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-500">Left after costs</p>
        <p className={`mt-1 text-5xl font-bold ${week.net < 0 ? 'text-red-700' : ''}`}>
          {week.net < 0 ? '−' : ''}
          {formatNumber(Math.abs(week.net))} <span className="text-lg font-semibold text-stone-500">{currency}</span>
        </p>
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${verdict.tone}`}>
          <span aria-hidden>{verdict.icon}</span> {verdict.text}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-stone-500">Income</dt>
          <dd className="text-right font-semibold">{formatMoney(week.income, currency)}</dd>
          <dt className="text-stone-500">Costs</dt>
          <dd className="text-right font-semibold">{formatMoney(week.expenses, currency)}</dd>
          {week.tips > 0 && (
            <>
              <dt className="text-stone-500">Of which tips</dt>
              <dd className="text-right font-semibold">{formatMoney(week.tips, currency)}</dd>
            </>
          )}
          <dt className="text-stone-500">Hours logged</dt>
          <dd className="text-right font-semibold">{week.hours > 0 ? formatNumber(week.hours) : '—'}</dd>
          <dt className="text-stone-500">Real per hour</dt>
          <dd className="text-right font-semibold">
            {week.netPerHour === null ? '—' : `${formatMoney(week.netPerHour, currency)}/h`}
          </dd>
          {week.orderCount > 0 && (
            <>
              <dt className="text-stone-500">Trips / orders</dt>
              <dd className="text-right font-semibold">{formatNumber(week.orderCount)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-500">Day by day</h2>
        <div className="mb-3 flex gap-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-emerald-600" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-stone-400" /> Costs
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Day</th>
              <th>Income and costs</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {week.days.map((day) => {
              const net = day.income - day.expenses
              const empty = day.income === 0 && day.expenses === 0
              return (
                <tr key={day.date} title={`Income ${formatMoney(day.income, currency)}, costs ${formatMoney(day.expenses, currency)}`}>
                  <td className="w-16 py-1.5 text-stone-500">{weekdayShort(day.date)}</td>
                  <td className="py-1.5">
                    <div className="space-y-0.5">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(day.income / maxDay) * 100}%` }} />
                      <div className="h-2 rounded-full bg-stone-400" style={{ width: `${(day.expenses / maxDay) * 100}%` }} />
                    </div>
                  </td>
                  <td className={`w-24 py-1.5 text-right tabular-nums ${empty ? 'text-stone-300' : net < 0 ? 'text-red-700' : 'font-semibold'}`}>
                    {empty ? '—' : `${net < 0 ? '−' : ''}${formatNumber(Math.abs(net))}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {week.expensesByCategory.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-stone-500">Costs by category</h2>
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
                    <span className="font-semibold">{formatMoney(row.amount, currency)}</span>{' '}
                    <span className="text-stone-400">({share}%)</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
