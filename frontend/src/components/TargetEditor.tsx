import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { formatNumber } from '../lib/format'
import { parseAmount } from './AmountInput'

// Inline form to set or change the weekly target (what the driver wants left
// after costs). Saves through PATCH /api/me.
export function TargetEditor({
  current,
  currency,
  onSaved,
  onCancel,
}: {
  current: number | null
  currency: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(current ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api('/me', { method: 'PATCH', body: { weeklyTarget: value > 0 ? value : null } })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the target.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <label htmlFor="target" className="block text-sm font-medium text-emerald-50">
        Weekly target (left after costs)
      </label>
      <div className="flex items-baseline gap-2 rounded-xl bg-white px-4 py-2 text-stone-900">
        <input
          id="target"
          inputMode="numeric"
          autoFocus
          placeholder="e.g. 500,000"
          value={value ? formatNumber(value) : ''}
          onChange={(e) => setValue(parseAmount(e.target.value))}
          className="w-full min-w-0 bg-transparent text-2xl font-bold outline-none"
        />
        <span className="font-semibold text-stone-500">{currency}</span>
      </div>
      {error && <p className="text-sm text-red-100">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-xl border border-emerald-300/60 font-semibold text-white">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="h-12 rounded-xl bg-white font-semibold text-emerald-800 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save target'}
        </button>
      </div>
    </form>
  )
}
