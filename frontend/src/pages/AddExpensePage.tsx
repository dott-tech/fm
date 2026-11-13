import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AmountInput } from '../components/AmountInput'
import { DayPicker } from '../components/DayPicker'
import { EntryScreen } from '../components/EntryScreen'
import { ChoiceButton, ErrorMessage, Field } from '../components/ui'
import { fmt, useI18n } from '../i18n'
import type { ExpenseCategory } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatMoney, localIsoDate } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/labels'
import { useCreateExpense, useExpenseDefaults } from '../lib/queries'

export function AddExpensePage() {
  const { m } = useI18n()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'
  const defaults = useExpenseDefaults()
  const create = useCreateExpense()

  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(localIsoDate())
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Pre-select the category used last time (fuel for a new user).
  useEffect(() => {
    if (defaults.data) setCategory((current) => current ?? defaults.data.category)
    else if (defaults.error) setCategory((current) => current ?? 'fuel')
  }, [defaults.data, defaults.error])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount <= 0) return setError(m.expense.enterAmount)
    if (!category) return
    setError(null)
    create.mutate(
      { date, amount, category, note: note.trim() || null },
      {
        onSuccess: (saved) =>
          navigate('/', {
            replace: true,
            viewTransition: true,
            state: { flash: fmt(m.dashboard.savedExpense, { amount: formatMoney(saved.amount, currency), what: m.costs[saved.category] }) },
          }),
      },
    )
  }

  return (
    <EntryScreen
      title={m.expense.title}
      formId="expense-form"
      saving={create.isPending}
      canSave={category !== null}
      saveLabel={amount > 0 ? fmt(m.income.saveAmount, { amount: formatMoney(amount, currency) }) : m.common.save}
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
        <AmountInput label={m.expense.howMuch} value={amount} onChange={setAmount} currency={currency} />

        {/* Big icon buttons: recognisable at a glance, one tap to pick. */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">{m.expense.onWhat}</legend>
          <div className="grid grid-cols-3 gap-2">
            {EXPENSE_CATEGORIES.filter((c) => c.pickable).map((option) => (
              <ChoiceButton
                key={option.value}
                selected={option.value === category}
                onClick={() => setCategory(option.value)}
                className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl"
              >
                <span aria-hidden className="text-2xl leading-none">
                  {option.icon}
                </span>
                {m.costs[option.value]}
              </ChoiceButton>
            ))}
          </div>
        </fieldset>

        <DayPicker value={date} onChange={setDate} />

        <Field
          id="note"
          label={m.common.noteOptional}
          placeholder={m.expense.notePlaceholder}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />

        <ErrorMessage message={error ?? create.error?.message ?? null} />
      </form>
    </EntryScreen>
  )
}
