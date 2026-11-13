import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { RecentActivity } from '../components/RecentActivity'
import { TargetEditor } from '../components/TargetEditor'
import { TodaySetAside } from '../components/TodaySetAside'
import { Flash, Rise, Skeleton } from '../components/ui'
import { fmt, plural, useI18n } from '../i18n'
import type { WeekSummary } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { currencyLabel, daysUntil, formatCompact, formatMoney, formatNumber, formatWeekRange } from '../lib/format'
import { costMeta } from '../lib/labels'
import { useDashboard } from '../lib/queries'
import { useCountUp } from '../lib/use-count-up'

// The home screen. Answers one question fast:
// "After costs, how much did I make this week, and am I on target?"
// Everything comes from ONE cached request (GET /api/dashboard). Coming back
// to this tab shows the cached numbers instantly, then refreshes quietly.
export function DashboardPage() {
  const { m } = useI18n()
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const flash = (location.state as { flash?: string } | null)?.flash
  const { data, error, refetch } = useDashboard()
  const [editingTarget, setEditingTarget] = useState(false)

  const week = data?.week
  const currency = week?.currency ?? session?.user.currency ?? 'IQD'

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader title={m.dashboard.title} subtitle={session ? fmt(m.dashboard.hi, { name: session.user.isAnonymous ? m.guest.name : session.user.name }) : undefined} />

      {flash && (
        <div className="mb-4">
          <Flash>✓ {flash}</Flash>
        </div>
      )}

      {error && !data && (
        <p role="alert" className="pop mb-4 rounded-xl bg-bad-soft px-4 py-3 text-bad-ink">
          {m.dashboard.couldNotLoad}{' '}
          <button onClick={() => refetch()} className="font-semibold underline">
            {m.common.tryAgain}
          </button>
        </p>
      )}

      {!week ? (
        !error && <DashboardSkeleton />
      ) : (
        <Rise i={0}>
          <HeroCard week={week} editingTarget={editingTarget} onEditTarget={() => setEditingTarget(true)} onDoneEditing={() => setEditingTarget(false)} />
        </Rise>
      )}

      <Rise i={1} className="mt-3 grid grid-cols-2 gap-3">
        <Link
          to="/income/new"
          viewTransition
          className="press flex h-14 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-white shadow-sm active:bg-accent-pressed"
        >
          {m.dashboard.addIncome}
        </Link>
        <Link
          to="/expenses/new"
          viewTransition
          className="press flex h-14 items-center justify-center rounded-2xl bg-dark-button text-lg font-semibold text-white shadow-sm"
        >
          {m.dashboard.addExpense}
        </Link>
      </Rise>

      {week && (
        <Rise i={2}>
          {/* KPI row: the three numbers behind the big one. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label={m.dashboard.income} value={formatCompact(week.income)} unit={currencyLabel(currency)} />
            <StatTile label={m.dashboard.costs} value={formatCompact(week.expenses)} unit={currencyLabel(currency)} />
            <StatTile
              label={m.dashboard.realPerHour}
              value={week.netPerHour === null ? '—' : formatCompact(week.netPerHour)}
              unit={week.netPerHour === null ? m.dashboard.logHours : fmt(m.dashboard.perHourUnit, { currency: currencyLabel(currency) })}
            />
          </div>
          {week.netPerHour !== null && (
            <p className="mt-2 px-1 text-xs text-muted">
              {fmt(m.dashboard.perHourNote, { hours: formatNumber(week.hours), gross: formatMoney(week.grossPerHour ?? 0, currency) })}
            </p>
          )}
        </Rise>
      )}

      {data && (
        <Rise i={3} className="mt-5">
          <TodaySetAside overview={data.pots} currency={currency} />
        </Rise>
      )}

      {week && week.expensesByCategory.length > 0 && (
        <Rise i={4}>
          <CostBreakdown week={week} />
        </Rise>
      )}

      {data && (
        <Rise i={5} className="mt-6">
          <RecentActivity income={data.recent.income} expenses={data.recent.expenses} currency={currency} />
        </Rise>
      )}
    </main>
  )
}

function DashboardSkeleton() {
  return <Skeleton className="h-52 rounded-3xl" />
}

// The one big number: what's left after costs, plus progress to the target.
function HeroCard({
  week,
  editingTarget,
  onEditTarget,
  onDoneEditing,
}: {
  week: WeekSummary
  editingTarget: boolean
  onEditTarget: () => void
  onDoneEditing: () => void
}) {
  const { m } = useI18n()
  const { net, target, currency } = week
  const shownNet = useCountUp(net)
  const losing = net < 0
  const progress = target ? Math.min(Math.max(net / target, 0), 1) : 0
  const daysLeft = daysUntil(week.weekEnd)

  return (
    <section className={`rounded-3xl p-5 text-white shadow-sm transition-colors duration-500 ${losing ? 'bg-hero-loss' : 'bg-hero'}`}>
      {/* Each label stays on one line; the date drops below when space runs out (Arabic). */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm text-white/80">
        <span className="whitespace-nowrap">{m.dashboard.leftAfterCosts}</span>
        <span className="whitespace-nowrap">{formatWeekRange(week.weekStart, week.weekEnd)}</span>
      </div>

      <p className="mt-2 flex items-baseline gap-2">
        <span dir="ltr" className="text-5xl font-bold">
          {losing ? '−' : ''}
          {formatNumber(Math.abs(shownNet))}
        </span>
        <span className="text-lg font-semibold text-white/80">{currencyLabel(currency)}</span>
      </p>
      {losing && <p className="mt-1 font-medium">{m.dashboard.lostWeek}</p>}

      {editingTarget ? (
        <TargetEditor current={target} currency={currency} onDone={onDoneEditing} />
      ) : target ? (
        <div className="mt-4">
          {/* Meter: lighter fill on a darker track of the same green. */}
          <div
            className="h-3 overflow-hidden rounded-full bg-black/25"
            role="progressbar"
            aria-label={m.dashboard.targetProgress}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.max(net, 0)}
          >
            <div className="bar h-full rounded-full bg-emerald-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {week.targetHit ? m.dashboard.targetHit : fmt(m.dashboard.toGo, { amount: formatMoney(week.remainingToTarget ?? 0, currency) })}
            </span>
            <button onClick={onEditTarget} className="shrink-0 text-white/80 underline underline-offset-2">
              {fmt(m.dashboard.ofTarget, { amount: formatCompact(target) })}
            </button>
          </div>
          {!week.targetHit && daysLeft >= 0 && (
            <p className="mt-1 text-sm text-white/70">{daysLeft === 0 ? m.dashboard.lastDay : plural(m.dashboard.daysLeft, daysLeft)}</p>
          )}
        </div>
      ) : (
        <button onClick={onEditTarget} className="mt-4 h-11 w-full rounded-xl bg-white/15 font-semibold active:bg-white/25">
          {m.dashboard.setTarget}
        </button>
      )}
    </section>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-sm">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <p dir="ltr" className="mt-1 text-xl font-semibold rtl:text-right">
        {value}
      </p>
      <p className="truncate text-xs text-faint">{unit}</p>
    </div>
  )
}

// Where the money went: one bar per category, biggest first, one colour.
function CostBreakdown({ week }: { week: WeekSummary }) {
  const { m } = useI18n()
  const biggest = week.expensesByCategory[0]?.amount ?? 1
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-muted">{m.dashboard.whereCostsWent}</h2>
      <ul className="space-y-3 rounded-2xl bg-surface p-4 shadow-sm">
        {week.expensesByCategory.map((row) => {
          const meta = costMeta(row.category)
          return (
            <li key={row.category}>
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span aria-hidden>{meta.icon}</span> {meta.label}
                </span>
                <span className="font-semibold">{formatMoney(row.amount, week.currency)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-2">
                <div className="bar h-full rounded-full bg-bar-neutral" style={{ width: `${(row.amount / biggest) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
