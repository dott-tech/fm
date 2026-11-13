import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { PageHeader } from '../components/AppShell'
import { api, type Pot, type PotsOverview } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysUntil, formatDay, formatMoney, localIsoDate } from '../lib/format'
import { repeatLabel } from '../lib/labels'

// Bills & goals: every pot with its progress, due date and daily amount.
export function PotsPage() {
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'
  const [overview, setOverview] = useState<PotsOverview | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    api<PotsOverview>(`/pots?date=${localIsoDate()}`)
      .then((data) => {
        setOverview(data)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  const bills = overview?.pots.filter((p) => p.kind === 'bill') ?? []
  const goals = overview?.pots.filter((p) => p.kind === 'goal') ?? []

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader
        title="Bills & goals"
        action={
          <Link
            to="/pots/new"
            className="flex h-11 items-center rounded-xl bg-emerald-700 px-4 font-semibold text-white shadow-sm active:bg-emerald-800"
          >
            + Add
          </Link>
        }
      />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">Couldn't load your bills and goals.</p>}
      {!overview && !error && <div className="h-40 animate-pulse rounded-2xl bg-stone-200" aria-label="Loading" />}

      {overview && (
        <>
          <p className="mb-5 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
            Every day: <span className="font-bold">{formatMoney(overview.todayTotal, currency)}</span> to put aside
            {overview.todayLeft > 0 ? (
              <span className="block text-sm">{formatMoney(overview.todayLeft, currency)} still to go today</span>
            ) : (
              overview.pots.length > 0 && <span className="block text-sm">✓ Done for today</span>
            )}
          </p>

          <PotSection title="Fixed bills" empty="No bills yet. Add rent, installments, phone plan…" pots={bills} currency={currency} onChange={load} />
          <PotSection title="Goals & needs" empty="No goals yet. Saving for tyres, Eid, an emergency fund?" pots={goals} currency={currency} onChange={load} />
        </>
      )}

    </main>
  )
}

function PotSection({
  title,
  empty,
  pots,
  currency,
  onChange,
}: {
  title: string
  empty: string
  pots: Pot[]
  currency: string
  onChange: () => void
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-500">{title}</h2>
      {pots.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {pots.map((pot) => (
            <PotCard key={pot.id} pot={pot} currency={currency} onChange={onChange} />
          ))}
        </ul>
      )}
    </section>
  )
}

// "Due today", "Overdue", "Due Tue 2 Dec · 20 days", "By 28 Feb · 108 days", "3,000/day · no deadline"
function whenText(pot: Pot, currency: string): string {
  if (!pot.dueDate) return `${formatMoney(pot.chosenDailyAmount ?? 0, currency)} a day · no deadline`
  const days = daysUntil(pot.dueDate)
  if (pot.overdue) return `Overdue since ${formatDay(pot.dueDate)}`
  if (days === 0) return pot.kind === 'bill' ? 'Due today' : 'Deadline today'
  const prefix = pot.kind === 'bill' ? 'Due' : 'By'
  return `${prefix} ${formatDay(pot.dueDate)} · ${days} ${days === 1 ? 'day' : 'days'}`
}

type Panel = null | 'add' | 'pay' | 'delete'

function PotCard({ pot, currency, onChange }: { pot: Pot; currency: string; onChange: () => void }) {
  const [panel, setPanel] = useState<Panel>(null)
  const [amount, setAmount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const progress = Math.min(1, pot.saved / pot.targetAmount)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setPanel(null)
      setAmount(0)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (amount <= 0) return
    void run(() => api(`/pots/${pot.id}/transfers`, { method: 'POST', body: { date: localIsoDate(), amount } }))
  }

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {pot.icon && <span aria-hidden>{pot.icon} </span>}
            {pot.name}
          </p>
          <p className={`text-sm ${pot.overdue ? 'font-semibold text-red-700' : 'text-stone-500'}`}>
            {whenText(pot, currency)}
            {pot.repeatEvery && pot.repeatUnit ? ` · ${repeatLabel(pot.repeatEvery, pot.repeatUnit)}` : ''}
          </p>
        </div>
        {!pot.funded && pot.dailyAmount > 0 && (
          <p className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold">
            {formatMoney(pot.dailyAmount, currency)}/day
          </p>
        )}
      </div>

      {/* Progress: saved so far out of the target. */}
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-label={`${pot.name}: saved`}
        aria-valuemin={0}
        aria-valuemax={pot.targetAmount}
        aria-valuenow={pot.saved}
      >
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between text-sm">
        <span>
          <span className="font-semibold">{formatMoney(pot.saved, currency)}</span>
          <span className="text-stone-500"> of {formatMoney(pot.targetAmount, currency)}</span>
        </span>
        {pot.funded ? <span className="font-semibold text-emerald-700">✓ Ready</span> : <span className="text-stone-500">{formatMoney(pot.remaining, currency)} to go</span>}
      </p>

      {panel === null && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPanel('add')} className="h-10 flex-1 rounded-xl bg-stone-100 text-sm font-semibold active:bg-stone-200">
            + Add money
          </button>
          {pot.kind === 'bill' && (
            <button onClick={() => setPanel('pay')} className="h-10 flex-1 rounded-xl bg-stone-800 text-sm font-semibold text-white active:bg-stone-900">
              Pay bill
            </button>
          )}
          <Link
            to={`/pots/${pot.id}/edit`}
            aria-label={`Edit ${pot.name}`}
            className="grid h-10 w-10 place-items-center rounded-xl text-stone-500 active:bg-stone-100"
          >
            ✎
          </Link>
          <button
            onClick={() => setPanel('delete')}
            aria-label={`Delete ${pot.name}`}
            className="h-10 w-10 rounded-xl text-stone-400 active:bg-stone-100"
          >
            ✕
          </button>
        </div>
      )}

      {panel === 'add' && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2">
          <AmountInput id={`add-${pot.id}`} label="How much are you putting in?" value={amount} onChange={setAmount} currency={currency} />
          <PanelButtons busy={busy} confirmLabel="Add to pot" disabled={amount <= 0} onCancel={() => setPanel(null)} />
        </form>
      )}

      {panel === 'pay' && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
          <p>
            Record <span className="font-semibold">{formatMoney(pot.targetAmount, currency)}</span> as paid today? It's added to your costs
            {pot.saved > 0 ? `, ${formatMoney(Math.min(pot.saved, pot.targetAmount), currency)} comes out of this pot` : ''}
            {pot.repeatEvery ? ', and the next due date is set.' : ', and this bill is closed.'}
          </p>
          <PanelButtons
            busy={busy}
            confirmLabel="Yes, paid"
            onCancel={() => setPanel(null)}
            onConfirm={() => run(() => api(`/pots/${pot.id}/pay`, { method: 'POST', body: { date: localIsoDate() } }))}
          />
        </div>
      )}

      {panel === 'delete' && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <p>Delete "{pot.name}" and its history? The money you put aside isn't touched, only this plan.</p>
          <PanelButtons
            busy={busy}
            confirmLabel="Delete"
            danger
            onCancel={() => setPanel(null)}
            onConfirm={() => run(() => api(`/pots/${pot.id}`, { method: 'DELETE' }))}
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  )
}

function PanelButtons({
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
  disabled = false,
  danger = false,
}: {
  busy: boolean
  confirmLabel: string
  onCancel: () => void
  onConfirm?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-stone-300 font-semibold">
        Cancel
      </button>
      <button
        type={onConfirm ? 'button' : 'submit'}
        onClick={onConfirm}
        disabled={busy || disabled}
        className={`h-11 rounded-xl font-semibold text-white disabled:opacity-60 ${danger ? 'bg-red-700' : 'bg-emerald-700'}`}
      >
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </div>
  )
}
