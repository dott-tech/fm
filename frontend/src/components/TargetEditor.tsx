import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { currencyLabel, formatNumber } from '../lib/format'
import { useUpdateProfile } from '../lib/queries'
import { parseAmount } from './AmountInput'

// Inline form (inside the green hero card) to set or change the weekly target.
export function TargetEditor({
  current,
  currency,
  onDone,
}: {
  current: number | null
  currency: string
  onDone: () => void
}) {
  const { m } = useI18n()
  const [value, setValue] = useState(current ?? 0)
  const update = useUpdateProfile()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    update.mutate({ weeklyTarget: value > 0 ? value : null }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={handleSubmit} className="pop mt-4 space-y-3">
      <label htmlFor="target" className="block text-sm font-medium text-white/85">
        {m.dashboard.targetLabel}
      </label>
      <div className="flex items-baseline gap-2 rounded-xl bg-white px-4 py-2 text-stone-900">
        <input
          id="target"
          dir="ltr"
          inputMode="numeric"
          autoFocus
          placeholder={m.dashboard.targetPlaceholder}
          value={value ? formatNumber(value) : ''}
          onChange={(e) => setValue(parseAmount(e.target.value))}
          className="w-full min-w-0 bg-transparent text-2xl font-bold outline-none rtl:text-right"
        />
        <span className="font-semibold text-stone-500">{currencyLabel(currency)}</span>
      </div>
      {update.error && <p className="text-sm text-red-100">{update.error.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} className="h-12 rounded-xl border border-white/40 font-semibold text-white">
          {m.common.cancel}
        </button>
        <button type="submit" disabled={update.isPending} className="h-12 rounded-xl bg-white font-semibold text-emerald-800 disabled:opacity-60">
          {update.isPending ? m.common.saving : m.dashboard.saveTarget}
        </button>
      </div>
    </form>
  )
}
