import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { EntryScreen } from '../components/EntryScreen'
import { Choices, ErrorMessage, Field } from '../components/ui'
import { api, type NewPot, type Pot, type PotKind, type RepeatUnit } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysUntil, formatMoney, localIsoDate } from '../lib/format'

// Common bills and goals for drivers: one tap fills in the name and icon.
const SUGGESTIONS: Record<PotKind, { name: string; icon: string }[]> = {
  bill: [
    { name: 'Car installment', icon: '🚗' },
    { name: 'Motorbike installment', icon: '🏍️' },
    { name: 'Rent', icon: '🏠' },
    { name: 'Phone plan', icon: '📱' },
    { name: 'Generator', icon: '🔌' },
    { name: 'Insurance', icon: '🛡️' },
  ],
  goal: [
    { name: 'New tyres', icon: '🛞' },
    { name: 'Emergency fund', icon: '🆘' },
    { name: 'Eid', icon: '🎉' },
    { name: 'School fees', icon: '📚' },
    { name: 'Repair fund', icon: '🔧' },
    { name: 'Family', icon: '👨‍👩‍👧' },
  ],
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
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'

  const [loaded, setLoaded] = useState(!editing)
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
  const [saved, setSaved] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Editing: load the pot and fill the form with it.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    api<Pot>(`/pots/${id}?date=${localIsoDate()}`)
      .then((pot) => {
        if (cancelled) return
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
        setSaved(pot.saved)
        setLoaded(true)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load it.'))
    return () => {
      cancelled = true
    }
  }, [id])

  const usesDate = kind === 'bill' || goalPlan === 'deadline'

  // Live preview of the daily amount (counts what's already saved when editing).
  let preview: string | null = null
  const missing = Math.max(0, amount - saved)
  if (amount > 0 && missing === 0) {
    preview = 'Already fully saved'
  } else if (amount > 0 && usesDate && dueDate) {
    const days = Math.max(1, daysUntil(dueDate) + 1)
    preview = `${formatMoney(roundUp(missing / days), currency)} a day for ${days} ${days === 1 ? 'day' : 'days'}`
  } else if (amount > 0 && !usesDate && dailyAmount > 0) {
    const days = Math.ceil(missing / dailyAmount)
    preview = `Reached in about ${days} ${days === 1 ? 'day' : 'days'}`
  }

  function switchKind(next: PotKind) {
    setKind(next)
    // Clear a suggestion from the other kind; keep anything typed by hand.
    if (SUGGESTIONS[kind].some((s) => s.name === name)) {
      setName('')
      setIcon(null)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Quick checks for instant feedback. The server and the database enforce
    // the same rules again, so nothing invalid can be saved either way.
    if (!name.trim()) return setError('Give it a name.')
    if (amount <= 0) return setError(kind === 'bill' ? 'Enter the bill amount.' : 'Enter how much you need.')
    if (usesDate && !dueDate) return setError(kind === 'bill' ? 'Pick the due date.' : 'Pick a deadline.')
    if (!usesDate && dailyAmount <= 0) return setError('Enter how much to put aside per day.')

    let repeatEvery: number | null = null
    let repeatUnit: RepeatUnit | null = null
    if (kind === 'bill' && repeat !== 'once') {
      if (repeat === 'custom') {
        repeatEvery = Number(customEvery) || 0
        repeatUnit = customUnit
        if (repeatEvery < 1) return setError('Enter how often it repeats.')
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

    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await api(`/pots/${id}`, { method: 'PATCH', body: fields })
      } else {
        const body: NewPot = { kind, ...fields }
        await api('/pots', { method: 'POST', body })
      }
      navigate('/pots', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  const noun = kind === 'bill' ? 'bill' : 'goal'
  const title = editing ? `Edit ${noun}` : `New ${noun}`

  if (!loaded) {
    return (
      <EntryScreen backTo="/pots" title={title} formId="pot-form" saving={false} canSave={false} saveLabel="Save">
        {error ? <ErrorMessage message={error} /> : <div className="h-64 animate-pulse rounded-2xl bg-stone-200" aria-label="Loading" />}
      </EntryScreen>
    )
  }

  return (
    <EntryScreen backTo="/pots" title={title} formId="pot-form" saving={saving} canSave saveLabel={editing ? 'Save changes' : 'Save'}>
      <form id="pot-form" onSubmit={handleSubmit} className="space-y-6">
        {/* The kind can't change after creation: a bill's history isn't a goal's. */}
        {!editing && (
          <Choices
            label="What is it?"
            columns={2}
            value={kind}
            onChange={switchKind}
            options={[
              { value: 'bill', label: 'Fixed bill' },
              { value: 'goal', label: 'Goal or need' },
            ]}
          />
        )}

        <div>
          <Field
            id="pot-name"
            label="Name"
            placeholder={kind === 'bill' ? 'e.g. Car installment' : 'e.g. New tyres'}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value)
              setIcon(null)
            }}
          />
          {!editing && (
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS[kind].map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={name === s.name}
                  onClick={() => {
                    setName(s.name)
                    setIcon(s.icon)
                  }}
                  className={`h-9 rounded-full border-2 px-3 text-sm font-medium ${
                    name === s.name ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  <span aria-hidden>{s.icon}</span> {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <AmountInput
          id="pot-amount"
          autoFocus={false}
          label={kind === 'bill' ? 'Bill amount' : 'How much do you need?'}
          value={amount}
          onChange={setAmount}
          currency={currency}
        />
        {editing && saved > 0 && (
          <p className="-mt-4 text-sm text-stone-500">{formatMoney(saved, currency)} already saved</p>
        )}

        {kind === 'goal' && (
          <Choices
            label="How do you want to get there?"
            columns={2}
            value={goalPlan}
            onChange={setGoalPlan}
            options={[
              { value: 'deadline', label: 'By a date' },
              { value: 'daily', label: 'Fixed per day' },
            ]}
          />
        )}

        {usesDate ? (
          <Field
            id="pot-date"
            type="date"
            label={kind === 'bill' ? 'Next due date' : 'Deadline'}
            value={dueDate}
            min={editing ? undefined : localIsoDate()}
            onChange={(e) => setDueDate(e.target.value)}
          />
        ) : (
          <AmountInput
            id="pot-daily"
            autoFocus={false}
            label="Put aside per day"
            value={dailyAmount}
            onChange={setDailyAmount}
            currency={currency}
          />
        )}

        {kind === 'bill' && (
          <div>
            <Choices
              label="Repeats"
              columns={3}
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: 'month', label: 'Monthly' },
                { value: 'week', label: 'Weekly' },
                { value: 'year', label: 'Yearly' },
                { value: 'custom', label: 'Custom' },
                { value: 'once', label: 'Just once' },
              ]}
            />
            {repeat === 'custom' && (
              <div className="mt-3 flex items-end gap-2">
                <span className="pb-4 font-medium text-stone-700">Every</span>
                <div className="w-24">
                  <Field
                    id="custom-every"
                    label="How many"
                    inputMode="numeric"
                    value={customEvery}
                    maxLength={3}
                    onChange={(e) => setCustomEvery(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <label className="block flex-1">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Unit</span>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as CustomUnit)}
                    className="h-14 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg"
                  >
                    <option value="day">days</option>
                    <option value="week">weeks</option>
                    <option value="month">months</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        {preview && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-900" role="status">
            📅 {preview}
          </p>
        )}

        <ErrorMessage message={error} />
      </form>
    </EntryScreen>
  )
}
