import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Choices, ErrorMessage, Field, PrimaryButton } from '../components/ui'
import { api, type IncomeDefaults, type IncomeEntry, type IncomeSource, type NewIncome } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { daysAgoIso, formatMoney, formatNumber, localIsoDate } from '../lib/format'

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

const QUICK_ADD = [1_000, 5_000, 10_000]

type DateChoice = 'today' | 'yesterday' | 'other'

// Keep only digits, so "25,000" or "25 000" both become 25000.
function parseAmount(text: string): number {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

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
  const [dateChoice, setDateChoice] = useState<DateChoice>('today')
  const [otherDate, setOtherDate] = useState(daysAgoIso(2))
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
    // that belongs to another source.
    if (platform && !PLATFORMS[next].includes(platform) && Object.values(PLATFORMS).flat().includes(platform)) {
      setPlatform('')
    }
  }

  const date = dateChoice === 'today' ? localIsoDate() : dateChoice === 'yesterday' ? daysAgoIso(1) : otherDate

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
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">
      <header className="mb-6 flex items-center gap-3">
        <Link to="/" aria-label="Back" className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-2xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">Add income</h1>
      </header>

      <form id="income-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Amount: the only required thing to type. */}
        <div>
          <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-stone-700">
            How much did you earn?
          </label>
          <div className="flex items-baseline gap-2 rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 focus-within:border-emerald-600">
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="0"
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => setAmount(parseAmount(e.target.value))}
              className="w-full min-w-0 bg-transparent text-4xl font-bold outline-none"
            />
            <span className="text-lg font-semibold text-stone-500">{currency}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {QUICK_ADD.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setAmount((a) => a + step)}
                className="h-11 rounded-xl bg-stone-200/70 text-sm font-semibold text-stone-700 active:bg-stone-300"
              >
                +{formatNumber(step)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(0)}
              className="h-11 rounded-xl text-sm font-semibold text-stone-500 active:bg-stone-200"
            >
              Clear
            </button>
          </div>
        </div>

        <div>
          <Choices
            label="When"
            columns={3}
            value={dateChoice}
            onChange={setDateChoice}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'other', label: 'Other day' },
            ]}
          />
          {dateChoice === 'other' && (
            <input
              type="date"
              aria-label="Date"
              value={otherDate}
              max={localIsoDate()}
              onChange={(e) => setOtherDate(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-stone-300 bg-white px-4"
            />
          )}
        </div>

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

      {/* Save stays at the bottom of the screen, under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-stone-50/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <PrimaryButton type="submit" form="income-form" disabled={saving || !source}>
            {saving ? 'Saving…' : amount > 0 ? `Save ${formatMoney(amount, currency)}` : 'Save'}
          </PrimaryButton>
        </div>
      </div>
    </main>
  )
}
