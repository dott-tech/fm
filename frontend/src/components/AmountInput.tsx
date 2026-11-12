import { formatNumber } from '../lib/format'

const QUICK_ADD = [1_000, 5_000, 10_000]

// Keep only digits, so "25,000" or "25 000" both become 25000.
export function parseAmount(text: string): number {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

// The big "how much" box used by the add-income and add-expense screens.
// Formats with thousands separators while typing; quick buttons add common
// amounts so counting cash takes taps, not typing.
export function AmountInput({
  label,
  value,
  onChange,
  currency,
  id = "amount",
  autoFocus = true,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  currency: string
  id?: string
  autoFocus?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <div className="flex items-baseline gap-2 rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 focus-within:border-emerald-600">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value ? formatNumber(value) : ''}
          onChange={(e) => onChange(parseAmount(e.target.value))}
          className="w-full min-w-0 bg-transparent text-4xl font-bold outline-none"
        />
        <span className="text-lg font-semibold text-stone-500">{currency}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {QUICK_ADD.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(value + step)}
            className="h-11 rounded-xl bg-stone-200/70 text-sm font-semibold text-stone-700 active:bg-stone-300"
          >
            +{formatNumber(step)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(0)}
          className="h-11 rounded-xl text-sm font-semibold text-stone-500 active:bg-stone-200"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
