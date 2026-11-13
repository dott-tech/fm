import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { PageHeader } from '../components/AppShell'
import { Rise, Skeleton } from '../components/ui'
import { fmt, useI18n } from '../i18n'
import type { Pot } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysUntil, formatDay, formatMoney } from '../lib/format'
import { daysText, repeatLabel } from '../lib/labels'
import { useAddToPot, useDeletePot, usePayBill, usePots } from '../lib/queries'

// Bills & goals: every pot with its progress, due date and daily amount.
export function PotsPage() {
  const { m } = useI18n()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'
  const { data: overview, error } = usePots()

  const bills = overview?.pots.filter((p) => p.kind === 'bill') ?? []
  const goals = overview?.pots.filter((p) => p.kind === 'goal') ?? []

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader
        title={m.pots.title}
        action={
          <Link
            to="/pots/new"
            viewTransition
            className="press flex h-11 items-center rounded-xl bg-accent px-4 font-semibold text-white shadow-sm active:bg-accent-pressed"
          >
            {m.pots.add}
          </Link>
        }
      />

      {error && !overview && <p className="rounded-xl bg-bad-soft px-4 py-3 text-bad-ink">{m.pots.couldNotLoad}</p>}
      {!overview && !error && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {overview && (
        <>
          <Rise i={0}>
            <p className="mb-5 rounded-2xl bg-good-soft px-4 py-3 text-good-ink">
              {fmt(m.pots.everyDay, { amount: formatMoney(overview.todayTotal, currency) })}
              {overview.todayLeft > 0 ? (
                <span className="block text-sm">{fmt(m.pots.stillToGo, { amount: formatMoney(overview.todayLeft, currency) })}</span>
              ) : (
                overview.pots.length > 0 && <span className="block text-sm">{m.setAside.doneToday}</span>
              )}
            </p>
          </Rise>
          <Rise i={1}>
            <PotSection title={m.pots.fixedBills} empty={m.pots.emptyBills} pots={bills} currency={currency} />
          </Rise>
          <Rise i={2}>
            <PotSection title={m.pots.goalsNeeds} empty={m.pots.emptyGoals} pots={goals} currency={currency} />
          </Rise>
        </>
      )}
    </main>
  )
}

function PotSection({ title, empty, pots, currency }: { title: string; empty: string; pots: Pot[]; currency: string }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
      {pots.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted shadow-sm">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {pots.map((pot) => (
            <PotCard key={pot.id} pot={pot} currency={currency} />
          ))}
        </ul>
      )}
    </section>
  )
}

// "Due today", "Overdue since…", "Due Tue 2 Dec · 20 days", "3,000 a day · no deadline"
function useWhenText() {
  const { m } = useI18n()
  return (pot: Pot, currency: string): string => {
    if (!pot.dueDate) return fmt(m.pots.noDeadline, { amount: formatMoney(pot.chosenDailyAmount ?? 0, currency) })
    const days = daysUntil(pot.dueDate)
    if (pot.overdue) return fmt(m.pots.overdueSince, { date: formatDay(pot.dueDate) })
    if (days === 0) return pot.kind === 'bill' ? m.pots.dueToday : m.pots.deadlineToday
    return fmt(pot.kind === 'bill' ? m.pots.due : m.pots.by, { date: formatDay(pot.dueDate), days: daysText(days) })
  }
}

type Panel = null | 'add' | 'pay' | 'delete'

function PotCard({ pot, currency }: { pot: Pot; currency: string }) {
  const { m } = useI18n()
  const whenText = useWhenText()
  const [panel, setPanel] = useState<Panel>(null)
  const [amount, setAmount] = useState(0)
  const add = useAddToPot()
  const pay = usePayBill()
  const remove = useDeletePot()
  const busy = add.isPending || pay.isPending || remove.isPending
  const error = add.error ?? pay.error ?? remove.error

  const progress = Math.min(1, pot.saved / pot.targetAmount)
  const close = () => {
    setPanel(null)
    setAmount(0)
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (amount > 0) add.mutate({ id: pot.id, amount }, { onSuccess: close })
  }

  return (
    <li className="rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {pot.icon && <span aria-hidden>{pot.icon} </span>}
            {pot.name}
          </p>
          <p className={`text-sm ${pot.overdue ? 'font-semibold text-bad-ink' : 'text-muted'}`}>
            {whenText(pot, currency)}
            {pot.repeatEvery && pot.repeatUnit ? ` · ${repeatLabel(pot.repeatEvery, pot.repeatUnit)}` : ''}
          </p>
        </div>
        {!pot.funded && pot.dailyAmount > 0 && (
          <p className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">
            {fmt(m.pots.perDay, { amount: formatMoney(pot.dailyAmount, currency) })}
          </p>
        )}
      </div>

      {/* Progress: saved so far out of the target. */}
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-good-track"
        role="progressbar"
        aria-label={fmt(m.pots.savedAria, { name: pot.name })}
        aria-valuemin={0}
        aria-valuemax={pot.targetAmount}
        aria-valuenow={pot.saved}
      >
        <div className="bar h-full rounded-full bg-good-bar" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between text-sm">
        <span>
          <span className="font-semibold">{formatMoney(pot.saved, currency)}</span>{' '}
          <span className="text-muted">{fmt(m.pots.savedOf, { amount: formatMoney(pot.targetAmount, currency) })}</span>
        </span>
        {pot.funded ? (
          <span className="font-semibold text-accent-ink">{m.pots.ready}</span>
        ) : (
          <span className="text-muted">{fmt(m.pots.toGo, { amount: formatMoney(pot.remaining, currency) })}</span>
        )}
      </p>

      {panel === null && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPanel('add')} className="h-10 flex-1 rounded-xl bg-surface-2 text-sm font-semibold active:bg-surface-3">
            {m.pots.addMoney}
          </button>
          {pot.kind === 'bill' && (
            <button onClick={() => setPanel('pay')} className="h-10 flex-1 rounded-xl bg-dark-button text-sm font-semibold text-white">
              {m.pots.payBill}
            </button>
          )}
          <Link
            to={`/pots/${pot.id}/edit`}
            viewTransition
            aria-label={fmt(m.pots.edit, { name: pot.name })}
            className="press grid h-10 w-10 place-items-center rounded-xl text-muted active:bg-surface-2"
          >
            ✎
          </Link>
          <button
            onClick={() => setPanel('delete')}
            aria-label={fmt(m.pots.deleteAria, { name: pot.name })}
            className="h-10 w-10 rounded-xl text-faint active:bg-surface-2"
          >
            ✕
          </button>
        </div>
      )}

      {panel === 'add' && (
        <form onSubmit={handleAdd} className="pop mt-3 space-y-2">
          <AmountInput id={`add-${pot.id}`} label={m.pots.howMuchIn} value={amount} onChange={setAmount} currency={currency} />
          <PanelButtons busy={busy} confirmLabel={m.pots.addToPot} disabled={amount <= 0} onCancel={close} />
        </form>
      )}

      {panel === 'pay' && (
        <div className="pop mt-3 rounded-xl bg-surface-2 p-3 text-sm">
          <p>
            {fmt(m.pots.payConfirm, { amount: formatMoney(pot.targetAmount, currency) })}
            {pot.saved > 0 ? fmt(m.pots.payFromPot, { amount: formatMoney(Math.min(pot.saved, pot.targetAmount), currency) }) : ''}
            {pot.repeatEvery ? m.pots.payNext : m.pots.payClose}
          </p>
          <PanelButtons busy={busy} confirmLabel={m.pots.yesPaid} onCancel={close} onConfirm={() => pay.mutate(pot.id, { onSuccess: close })} />
        </div>
      )}

      {panel === 'delete' && (
        <div className="pop mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad-ink">
          <p>{fmt(m.pots.deleteConfirm, { name: pot.name })}</p>
          <PanelButtons busy={busy} confirmLabel={m.common.delete} danger onCancel={close} onConfirm={() => remove.mutate(pot.id)} />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-bad-ink">{error.message}</p>}
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
  const { m } = useI18n()
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-line-strong font-semibold text-ink">
        {m.common.cancel}
      </button>
      <button
        type={onConfirm ? 'button' : 'submit'}
        onClick={onConfirm}
        disabled={busy || disabled}
        className={`h-11 rounded-xl font-semibold text-white disabled:opacity-60 ${danger ? 'bg-bad-button' : 'bg-accent'}`}
      >
        {busy ? m.common.saving : confirmLabel}
      </button>
    </div>
  )
}
