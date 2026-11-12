import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AmountInput, parseAmount } from '../components/AmountInput'
import { DayPicker } from '../components/DayPicker'
import { EntryScreen } from '../components/EntryScreen'
import { Choices, ErrorMessage, Field } from '../components/ui'
import { api, type IncomeDefaults, type IncomeEntry, type IncomeSource, type NewIncome } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatMoney, formatNumber, localIsoDate } from '../lib/format'

const SOURCES: { value: IncomeSource; label: string }[] = [
  { value: 'cab', label: 'Cab' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'other', label: 'Other' },
]

// Suggested platforms per source. The driver can still type any name.
const PLATFORMS: Record<IncomeSource, string[]> = {
  cab: ['Careem', 'Baly', 'Direct'],
  delivery: ['Toters', 'Talabat', 'Lezzoo'],
  freelance: ['Direct'],
  other: [],
}
const ALL_SUGGESTED = Object.values(PLATFORMS).flat()

function optionalNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function AddIncomePage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'

  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(localIsoDate())
  const [source, setSource] = useState<IncomeSource | null>(null)
  const [platform, setPlatform] = useState('')
  const [hours, setHours] = useState('')
  const [orderCount, setOrderCount] = useState('')
  const [tips, setTips] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pre-fill source and platform from the last entry (or the user's role).
  useEffect(() => {
    let cancelled = false
    api<IncomeDefaults>('/income/defaults')
      .then((defaults) => {
        if (cancelled) return
        setSource((current) => current ?? defaults.source)
        setPlatform((current) => current || (defaults.platform ?? ''))
      })
      .catch(() => {
        if (!cancelled) setSource((current) => current ?? 'cab')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function chooseSource(next: IncomeSource) {
    setSource(next)
    // A Toters platform makes no sense for a cab fare: clear a suggestion
    // that belongs to another source (typed-in names are kept).
    if (ALL_SUGGESTED.includes(platform) && !PLATFORMS[next].includes(platform)) {
      setPlatform('')
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount <= 0) {
      setError('Enter how much you earned.')
      return
    }
    if (!source) return

    const entry: NewIncome = {
      date,
      amount,
      source,
      hours: optionalNumber(hours),
      orderCount: optionalNumber(orderCount),
      tips: tips ? parseAmount(tips) : null,
      platform: platform.trim() || null,
      note: note.trim() || null,
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await api<IncomeEntry>('/income', { method: 'POST', body: entry })
      navigate('/', { replace: true, state: { flash: `Saved ${formatMoney(saved.amount, currency)} income` } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <EntryScreen
      title="Add income"
      formId="income-form"
      saving={saving}
      canSave={source !== null}
      saveLabel={amount > 0 ? `Save ${formatMoney(amount, currency)}` : 'Save'}
    >
      <form id="income-form" onSubmit={handleSubmit} className="space-y-6">
        <AmountInput label="How much did you earn?" value={amount} onChange={setAmount} currency={currency} />

        <DayPicker value={date} onChange={setDate} />

        <Choices label="From" options={SOURCES} value={source} onChange={chooseSource} />

        {source && PLATFORMS[source].length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">Platform (optional)</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS[source].map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={platform === name}
                  onClick={() => setPlatform(platform === name ? '' : name)}
                  className={`h-10 rounded-full border-2 px-4 text-sm font-semibold ${
                    platform === name
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional details stay folded so the fast path stays fast. */}
        <details className="group rounded-2xl border border-stone-200 bg-white">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold text-stone-700">
            More details
            <span className="text-stone-400 transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="hours"
                label="Hours worked"
                inputMode="decimal"
                placeholder="e.g. 7.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <Field
                id="orders"
                label={source === 'cab' ? 'Trips' : 'Orders'}
                inputMode="numeric"
                placeholder="e.g. 12"
                value={orderCount}
                onChange={(e) => setOrderCount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Field
              id="tips"
              label="Of which tips"
              inputMode="numeric"
              placeholder="0"
              value={tips ? formatNumber(parseAmount(tips)) : ''}
              onChange={(e) => setTips(e.target.value)}
            />
            <Field
              id="platform"
              label="Platform name"
              placeholder="Any app or 'direct'"
              value={platform}
              maxLength={50}
              onChange={(e) => setPlatform(e.target.value)}
            />
            <Field id="note" label="Note" placeholder="Optional" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </div>
        </details>

        <ErrorMessage message={error} />
      </form>
    </EntryScreen>
  )
}
