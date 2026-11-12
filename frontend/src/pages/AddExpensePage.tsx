import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { DayPicker } from '../components/DayPicker'
import { EntryScreen } from '../components/EntryScreen'
import { ErrorMessage, Field } from '../components/ui'
import { api, type Expense, type ExpenseCategory, type ExpenseDefaults, type NewExpense } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatMoney, localIsoDate } from '../lib/format'
import { EXPENSE_CATEGORIES, expenseLabel } from '../lib/labels'

export function AddExpensePage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'

  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(localIsoDate())
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pre-select the category used last time (fuel for a new user).
  useEffect(() => {
    let cancelled = false
    api<ExpenseDefaults>('/expenses/defaults')
      .then((defaults) => {
        if (!cancelled) setCategory((current) => current ?? defaults.category)
      })
      .catch(() => {
        if (!cancelled) setCategory((current) => current ?? 'fuel')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount <= 0) {
      setError('Enter how much you spent.')
      return
    }
    if (!category) return

    const expense: NewExpense = { date, amount, category, note: note.trim() || null }

    setSaving(true)
    setError(null)
    try {
      const saved = await api<Expense>('/expenses', { method: 'POST', body: expense })
      const what = expenseLabel(saved.category).toLowerCase()
      navigate('/', { replace: true, state: { flash: `Saved ${formatMoney(saved.amount, currency)} for ${what}` } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <EntryScreen
      title="Add expense"
      formId="expense-form"
      saving={saving}
      canSave={category !== null}
      saveLabel={amount > 0 ? `Save ${formatMoney(amount, currency)}` : 'Save'}
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
        <AmountInput label="How much did you spend?" value={amount} onChange={setAmount} currency={currency} />

        {/* Big icon buttons: recognisable at a glance, one tap to pick. */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">On what</legend>
          <div className="grid grid-cols-3 gap-2">
            {EXPENSE_CATEGORIES.filter((c) => c.pickable).map((option) => {
              const selected = option.value === category
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(option.value)}
                  className={`flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold ${
                    selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {option.icon}
                  </span>
                  {option.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <DayPicker value={date} onChange={setDate} />

        <Field
          id="note"
          label="Note (optional)"
          placeholder="e.g. new brake pads"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />

        <ErrorMessage message={error} />
      </form>
    </EntryScreen>
  )
}
