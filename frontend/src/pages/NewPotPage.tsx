import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { EntryScreen } from '../components/EntryScreen'
import { Choices, ErrorMessage, Field } from '../components/ui'
import { api, type NewPot, type PotKind, type RepeatUnit } from '../lib/api'
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

type Repeat = 'once' | 'week' | 'month' | 'year' | 'days'
type GoalPlan = 'deadline' | 'daily'

// Same rounding as the server: up to the nearest 250 IQD.
const roundUp = (n: number) => Math.ceil(n / 250) * 250

export function NewPotPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'

  const [kind, setKind] = useState<PotKind>('bill')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('month')
  const [everyDays, setEveryDays] = useState('10')
  const [goalPlan, setGoalPlan] = useState<GoalPlan>('deadline')
  const [dailyAmount, setDailyAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const usesDate = kind === 'bill' || goalPlan === 'deadline'

  // Live preview of the daily amount, so the driver sees the plan before saving.
  let preview: string | null = null
  if (amount > 0 && usesDate && dueDate) {
    const days = Math.max(1, daysUntil(dueDate) + 1)
    preview = `${formatMoney(roundUp(amount / days), currency)} a day for ${days} ${days === 1 ? 'day' : 'days'}`
  } else if (amount > 0 && !usesDate && dailyAmount > 0) {
    const days = Math.ceil(amount / dailyAmount)
    preview = `Reached in about ${days} ${days === 1 ? 'day' : 'days'}`
  }

  function pickSuggestion(s: { name: string; icon: string }) {
    setName(s.name)
    setIcon(s.icon)
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
    if (!name.trim()) return setError('Give it a name.')
    if (amount <= 0) return setError(kind === 'bill' ? 'Enter the bill amount.' : 'Enter how much you need.')
    if (usesDate && !dueDate) return setError(kind === 'bill' ? 'Pick the due date.' : 'Pick a deadline.')
    if (!usesDate && dailyAmount <= 0) return setError('Enter how much to put aside per day.')

    let repeatEvery: number | null = null
    let repeatUnit: RepeatUnit | null = null
    if (kind === 'bill' && repeat !== 'once') {
      repeatUnit = repeat === 'days' ? 'day' : repeat
      repeatEvery = repeat === 'days' ? Number(everyDays) || 0 : 1
      if (repeatEvery < 1) return setError('Enter after how many days it repeats.')
    }

    const body: NewPot = {
      kind,
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
      await api('/pots', { method: 'POST', body })
      navigate('/pots', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <EntryScreen title={kind === 'bill' ? 'New bill' : 'New goal'} formId="pot-form" saving={saving} canSave saveLabel="Save">
      <form id="pot-form" onSubmit={handleSubmit} className="space-y-6">
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
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS[kind].map((s) => (
              <button
                key={s.name}
                type="button"
                aria-pressed={name === s.name}
                onClick={() => pickSuggestion(s)}
                className={`h-9 rounded-full border-2 px-3 text-sm font-medium ${
                  name === s.name ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-700'
                }`}
              >
                <span aria-hidden>{s.icon}</span> {s.name}
              </button>
            ))}
          </div>
        </div>

        <AmountInput
          id="pot-amount"
          autoFocus={false}
          label={kind === 'bill' ? 'Bill amount' : 'How much do you need?'}
          value={amount}
          onChange={setAmount}
          currency={currency}
        />

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
            min={localIsoDate()}
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
                { value: 'days', label: 'Every … days' },
                { value: 'once', label: 'Just once' },
              ]}
            />
            {repeat === 'days' && (
              <div className="mt-2">
                <Field
                  id="every-days"
                  label="Every how many days?"
                  inputMode="numeric"
                  value={everyDays}
                  onChange={(e) => setEveryDays(e.target.value.replace(/\D/g, ''))}
                />
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
