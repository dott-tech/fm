import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { EntryScreen } from '../components/EntryScreen'
import { ChoiceButton, Choices, ErrorMessage, Field, Skeleton } from '../components/ui'
import { fmt, useI18n } from '../i18n'
import type { Pot, PotKind, RepeatUnit } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysUntil, formatMoney, localIsoDate } from '../lib/format'
import { daysText } from '../lib/labels'
import { usePot, useProfile, useSavePot } from '../lib/queries'

// Icons for the suggestion chips (names come from the language file, same order).
const SUGGESTION_ICONS: Record<PotKind, string[]> = {
  bill: ['🚗', '🏍️', '🏠', '📱', '🔌', '🛡️'],
  goal: ['🛞', '🆘', '🎉', '📚', '🔧', '👨‍👩‍👧'],
}

type Repeat = 'month' | 'week' | 'year' | 'custom' | 'once'
type CustomUnit = 'day' | 'week' | 'month'
type GoalPlan = 'deadline' | 'daily'

// Same rounding as the server: up to the nearest 250 IQD.
const roundUp = (n: number) => Math.ceil(n / 250) * 250

// Map a saved repeat rule back to the form's choices.
function repeatFromPot(pot: Pot): { repeat: Repeat; every: string; unit: CustomUnit } {
  if (!pot.repeatEvery || !pot.repeatUnit) return { repeat: 'once', every: '2', unit: 'week' }
  if (pot.repeatEvery === 1 && pot.repeatUnit !== 'day') return { repeat: pot.repeatUnit, every: '2', unit: 'week' }
  // Custom: "every N years" is shown as N x 12 months.
  if (pot.repeatUnit === 'year') return { repeat: 'custom', every: String(pot.repeatEvery * 12), unit: 'month' }
  return { repeat: 'custom', every: String(pot.repeatEvery), unit: pot.repeatUnit }
}

// One form for both "new" (/pots/new) and "edit" (/pots/:id/edit).
export function PotFormPage() {
  const { m } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'
  const existing = usePot(id)
  const daysOff = useProfile().data?.daysOff ?? []
  const save = useSavePot()

  const [filled, setFilled] = useState(!editing)
  const [kind, setKind] = useState<PotKind>('bill')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('month')
  const [customEvery, setCustomEvery] = useState('2')
  const [customUnit, setCustomUnit] = useState<CustomUnit>('week')
  const [goalPlan, setGoalPlan] = useState<GoalPlan>('deadline')
  const [dailyAmount, setDailyAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Editing: fill the form once, as soon as the pot has loaded.
  const pot = existing.data
  useEffect(() => {
    if (!pot || filled) return
    const r = repeatFromPot(pot)
    setKind(pot.kind)
    setName(pot.name)
    setIcon(pot.icon)
    setAmount(pot.targetAmount)
    setDueDate(pot.dueDate ?? '')
    setRepeat(r.repeat)
    setCustomEvery(r.every)
    setCustomUnit(r.unit)
    setGoalPlan(pot.kind === 'goal' && !pot.dueDate ? 'daily' : 'deadline')
    setDailyAmount(pot.chosenDailyAmount ?? 0)
    setFilled(true)
  }, [pot, filled])

  const saved = pot?.saved ?? 0
  const usesDate = kind === 'bill' || goalPlan === 'deadline'
  const suggestions = m.potForm.suggestions[kind].map((label, i) => ({ name: label, icon: SUGGESTION_ICONS[kind][i] ?? '' }))

  // Live preview of the daily amount (counts what's already saved when editing).
  let preview: string | null = null
  const missing = Math.max(0, amount - saved)
  // Bills that repeat every week or more often: the server spreads them
  // evenly over working days (a payment on a day off is saved beforehand),
  // so preview that steady amount: a week's payments / working days a week.
  const cycleDays =
    kind !== 'bill' ? null
    : repeat === 'week' ? 7
    : repeat === 'custom' && customUnit === 'day' ? Number(customEvery) || null
    : repeat === 'custom' && customUnit === 'week' ? (Number(customEvery) || 0) * 7 || null
    : null
  if (amount > 0 && missing === 0) {
    preview = m.potForm.previewFull
  } else if (amount > 0 && dueDate && cycleDays && cycleDays <= 7) {
    const perWeek = (amount * 7) / cycleDays
    preview = fmt(m.potForm.previewSteady, { amount: formatMoney(roundUp(perWeek / (7 - daysOff.length)), currency) })
  } else if (amount > 0 && usesDate && dueDate) {
    const days = Math.max(1, daysUntil(dueDate) + 1)
    preview = fmt(m.potForm.previewDaily, { amount: formatMoney(roundUp(missing / days), currency), days: daysText(days) })
  } else if (amount > 0 && !usesDate && dailyAmount > 0) {
    preview = fmt(m.potForm.previewReached, { days: daysText(Math.ceil(missing / dailyAmount)) })
  }

  function switchKind(next: PotKind) {
    // Clear a suggestion from the other kind; keep anything typed by hand.
    if (m.potForm.suggestions[kind].includes(name)) {
      setName('')
      setIcon(null)
    }
    setKind(next)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Quick checks for instant feedback. The server and the database enforce
    // the same rules again, so nothing invalid can be saved either way.
    if (!name.trim()) return setError(m.potForm.giveName)
    if (amount <= 0) return setError(kind === 'bill' ? m.potForm.enterBillAmount : m.potForm.enterNeed)
    if (usesDate && !dueDate) return setError(kind === 'bill' ? m.potForm.pickDue : m.potForm.pickDeadline)
    if (!usesDate && dailyAmount <= 0) return setError(m.potForm.enterDaily)

    let repeatEvery: number | null = null
    let repeatUnit: RepeatUnit | null = null
    if (kind === 'bill' && repeat !== 'once') {
      if (repeat === 'custom') {
        repeatEvery = Number(customEvery) || 0
        repeatUnit = customUnit
        if (repeatEvery < 1) return setError(m.potForm.enterRepeat)
      } else {
        repeatEvery = 1
        repeatUnit = repeat
      }
    }

    const fields = {
      name: name.trim(),
      icon,
      targetAmount: amount,
      dueDate: usesDate ? dueDate : null,
      repeatEvery,
      repeatUnit,
      dailyAmount: usesDate ? null : dailyAmount,
    }
    setError(null)
    save.mutate(
      { id, body: editing ? fields : { kind, ...fields } },
      { onSuccess: () => navigate('/pots', { replace: true, viewTransition: true }) },
    )
  }

  const title = editing
    ? kind === 'bill'
      ? m.potForm.editBill
      : m.potForm.editGoal
    : kind === 'bill'
      ? m.potForm.newBill
      : m.potForm.newGoal

  if (!filled) {
    return (
      <EntryScreen backTo="/pots" title={title} formId="pot-form" saving={false} canSave={false} saveLabel={m.common.save}>
        {existing.error ? <ErrorMessage message={existing.error.message || m.potForm.couldNotLoad} /> : <Skeleton className="h-64" />}
      </EntryScreen>
    )
  }

  return (
    <EntryScreen
      backTo="/pots"
      title={title}
      formId="pot-form"
      saving={save.isPending}
      canSave
      saveLabel={editing ? m.potForm.saveChanges : m.common.save}
    >
      <form id="pot-form" onSubmit={handleSubmit} className="space-y-6">
        {/* The kind can't change after creation: a bill's history isn't a goal's. */}
        {!editing && (
          <Choices
            label={m.potForm.whatIsIt}
            columns={2}
            value={kind}
            onChange={switchKind}
            options={[
              { value: 'bill', label: m.potForm.fixedBill },
              { value: 'goal', label: m.potForm.goalOrNeed },
            ]}
          />
        )}

        <div>
          <Field
            id="pot-name"
            label={m.potForm.name}
            placeholder={kind === 'bill' ? m.potForm.namePlaceholderBill : m.potForm.namePlaceholderGoal}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value)
              setIcon(null)
            }}
          />
          {!editing && (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <ChoiceButton
                  key={s.name}
                  selected={name === s.name}
                  onClick={() => {
                    setName(s.name)
                    setIcon(s.icon)
                  }}
                  className="h-9 rounded-full px-3 font-medium"
                >
                  <span aria-hidden>{s.icon}</span> {s.name}
                </ChoiceButton>
              ))}
            </div>
          )}
        </div>

        <AmountInput
          id="pot-amount"
          autoFocus={false}
          label={kind === 'bill' ? m.potForm.billAmount : m.potForm.howMuchNeed}
          value={amount}
          onChange={setAmount}
          currency={currency}
        />
        {editing && saved > 0 && (
          <p className="-mt-4 text-sm text-muted">{fmt(m.potForm.alreadySaved, { amount: formatMoney(saved, currency) })}</p>
        )}

        {kind === 'goal' && (
          <Choices
            label={m.potForm.howGetThere}
            columns={2}
            value={goalPlan}
            onChange={setGoalPlan}
            options={[
              { value: 'deadline', label: m.potForm.byDate },
              { value: 'daily', label: m.potForm.fixedPerDay },
            ]}
          />
        )}

        {usesDate ? (
          <Field
            id="pot-date"
            type="date"
            label={kind === 'bill' ? m.potForm.nextDue : m.potForm.deadline}
            value={dueDate}
            min={editing ? undefined : localIsoDate()}
            onChange={(e) => setDueDate(e.target.value)}
          />
        ) : (
          <AmountInput id="pot-daily" autoFocus={false} label={m.potForm.perDay} value={dailyAmount} onChange={setDailyAmount} currency={currency} />
        )}

        {kind === 'bill' && (
          <div>
            <Choices
              label={m.potForm.repeats}
              columns={3}
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: 'month', label: m.potForm.monthly },
                { value: 'week', label: m.potForm.weekly },
                { value: 'year', label: m.potForm.yearly },
                { value: 'custom', label: m.potForm.custom },
                { value: 'once', label: m.potForm.justOnce },
              ]}
            />
            {repeat === 'custom' && (
              <div className="pop mt-3 flex items-end gap-2">
                <span className="pb-4 font-medium text-ink-2">{m.potForm.every}</span>
                <div className="w-24">
                  <Field
                    id="custom-every"
                    label={m.potForm.howMany}
                    inputMode="numeric"
                    dir="ltr"
                    value={customEvery}
                    maxLength={3}
                    onChange={(e) => setCustomEvery(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <label className="block flex-1">
                  <span className="mb-1.5 block text-sm font-medium text-ink-2">{m.potForm.unit}</span>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as CustomUnit)}
                    className="h-14 w-full rounded-xl border border-line-strong bg-surface px-3 text-lg text-ink"
                  >
                    <option value="day">{m.potForm.units.day}</option>
                    <option value="week">{m.potForm.units.week}</option>
                    <option value="month">{m.potForm.units.month}</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        {preview && (
          <p className="pop rounded-xl bg-good-soft px-4 py-3 font-medium text-good-ink" role="status">
            📅 {preview}
          </p>
        )}

        <ErrorMessage message={error ?? save.error?.message ?? null} />
      </form>
    </EntryScreen>
  )
}
