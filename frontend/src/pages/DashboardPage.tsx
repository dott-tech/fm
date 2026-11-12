import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { RecentActivity } from '../components/RecentActivity'
import { TargetEditor } from '../components/TargetEditor'
import { api, type WeekSummary } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysUntil, formatCompact, formatMoney, formatNumber, formatWeekRange, localIsoDate } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/labels'

// The home screen. Answers one question fast:
// "After costs, how much did I make this week, and am I on target?"
export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const flash = (location.state as { flash?: string } | null)?.flash

  const [week, setWeek] = useState<WeekSummary | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [editingTarget, setEditingTarget] = useState(false)

  const loadWeek = useCallback(() => {
    api<WeekSummary>(`/summary/week?date=${localIsoDate()}`)
      .then((data) => {
        setWeek(data)
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(loadWeek, [loadWeek])

  async function handleLogout() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

  const currency = week?.currency ?? session?.user.currency ?? 'IQD'

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-10">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">Hi {session?.user.name}</p>
          <h1 className="text-xl font-bold">This week</h1>
        </div>
        <button onClick={handleLogout} className="h-10 rounded-full px-4 text-sm font-semibold text-stone-500 active:bg-stone-200">
          Log out
        </button>
      </header>

      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          ✓ {flash}
        </p>
      )}

      {loadError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">
          Couldn't load this week.{' '}
          <button onClick={loadWeek} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}

      {week === null ? (
        !loadError && <div className="h-52 animate-pulse rounded-3xl bg-stone-200" aria-label="Loading" />
      ) : (
        <>
          <HeroCard
            week={week}
            editingTarget={editingTarget}
            onEditTarget={() => setEditingTarget(true)}
            onTargetSaved={() => {
              setEditingTarget(false)
              loadWeek()
            }}
            onCancelTarget={() => setEditingTarget(false)}
          />

          {/* KPI row: the three numbers behind the big one. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label="Income" value={formatCompact(week.income)} unit={currency} />
            <StatTile label="Costs" value={formatCompact(week.expenses)} unit={currency} />
            <StatTile
              label="Real per hour"
              value={week.netPerHour === null ? '—' : formatCompact(week.netPerHour)}
              unit={week.netPerHour === null ? 'log hours' : `${currency}/h`}
            />
          </div>
          {week.netPerHour !== null && (
            <p className="mt-2 px-1 text-xs text-stone-500">
              Per hour is after costs, from {formatNumber(week.hours)} logged hours (
              {formatMoney(week.grossPerHour ?? 0, currency)}/h before costs).
            </p>
          )}
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
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

      {week && week.expensesByCategory.length > 0 && <CostBreakdown week={week} />}

      <div className="mt-6">
        <RecentActivity currency={currency} />
      </div>
    </main>
  )
}

// The one big number: what's left after costs, plus progress to the target.
function HeroCard({
  week,
  editingTarget,
  onEditTarget,
  onTargetSaved,
  onCancelTarget,
}: {
  week: WeekSummary
  editingTarget: boolean
  onEditTarget: () => void
  onTargetSaved: () => void
  onCancelTarget: () => void
}) {
  const { net, target, currency } = week
  const losing = net < 0
  const progress = target ? Math.min(Math.max(net / target, 0), 1) : 0
  const daysLeft = daysUntil(week.weekEnd)

  return (
    <section className={`rounded-3xl p-5 text-white shadow-sm ${losing ? 'bg-red-800' : 'bg-emerald-800'}`}>
      <div className="flex items-baseline justify-between text-sm text-white/80">
        <span>Left after costs</span>
        <span>{formatWeekRange(week.weekStart, week.weekEnd)}</span>
      </div>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-bold">
          {losing ? '−' : ''}
          {formatNumber(Math.abs(net))}
        </span>
        <span className="text-lg font-semibold text-white/80">{currency}</span>
      </p>
      {losing && <p className="mt-1 font-medium">You spent more than you earned this week.</p>}

      {editingTarget ? (
        <TargetEditor current={target} currency={currency} onSaved={onTargetSaved} onCancel={onCancelTarget} />
      ) : target ? (
        <div className="mt-4">
          {/* Meter: lighter fill on a darker track of the same green. */}
          <div
            className="h-3 overflow-hidden rounded-full bg-emerald-950/40"
            role="progressbar"
            aria-label="Progress to weekly target"
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.max(net, 0)}
          >
            <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {week.targetHit
                ? '🎉 Target hit!'
                : `${formatMoney(week.remainingToTarget ?? 0, currency)} to go`}
            </span>
            <button onClick={onEditTarget} className="shrink-0 text-white/80 underline underline-offset-2">
              of {formatCompact(target)} target
            </button>
          </div>
          {!week.targetHit && daysLeft >= 0 && (
            <p className="mt-1 text-sm text-white/70">
              {daysLeft === 0 ? 'Last day of the week' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
            </p>
          )}
        </div>
      ) : (
        <button onClick={onEditTarget} className="mt-4 h-11 w-full rounded-xl bg-white/15 font-semibold active:bg-white/25">
          Set a weekly target
        </button>
      )}
    </section>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="text-xs text-stone-400">{unit}</p>
    </div>
  )
}

// Where the money went: one bar per category, biggest first, one colour.
function CostBreakdown({ week }: { week: WeekSummary }) {
  const biggest = week.expensesByCategory[0]?.amount ?? 1
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-500">Where costs went</h2>
      <ul className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        {week.expensesByCategory.map((row) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.value === row.category)
          return (
            <li key={row.category}>
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span aria-hidden>{meta?.icon}</span> {meta?.label ?? row.category}
                </span>
                <span className="font-semibold">{formatMoney(row.amount, week.currency)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-stone-500" style={{ width: `${(row.amount / biggest) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
