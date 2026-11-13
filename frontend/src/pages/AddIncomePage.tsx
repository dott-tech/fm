import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AmountInput, parseAmount } from '../components/AmountInput'
import { DayPicker } from '../components/DayPicker'
import { EntryScreen } from '../components/EntryScreen'
import { ChoiceButton, Choices, ErrorMessage, Field } from '../components/ui'
import { fmt, useI18n } from '../i18n'
import type { IncomeSource, NewIncome } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatMoney, formatNumber, localIsoDate } from '../lib/format'
import { useCreateIncome, useIncomeDefaults } from '../lib/queries'

const SOURCES: IncomeSource[] = ['cab', 'delivery', 'freelance', 'other']

// Suggested platforms per source (brand names, same in every language).
// The driver can still type any name.
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
  const { m } = useI18n()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const currency = session?.user.currency ?? 'IQD'
  const defaults = useIncomeDefaults()
  const create = useCreateIncome()

  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(localIsoDate())
  const [source, setSource] = useState<IncomeSource | null>(null)
  const [platform, setPlatform] = useState('')
  const [hours, setHours] = useState('')
  const [orderCount, setOrderCount] = useState('')
  const [tips, setTips] = useState('')
  const [note, setNote] = useState('')
  // Manual correction of the platform's cut for this entry (null = default rate).
  const [feeOverride, setFeeOverride] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill source and platform from the last entry (or the user's role).
  // Cached, so on a second visit this is instant.
  const d = defaults.data
  useEffect(() => {
    if (d) {
      setSource((current) => current ?? d.source)
      setPlatform((current) => current || (d.platform ?? ''))
    } else if (defaults.error) {
      setSource((current) => current ?? 'cab')
    }
  }, [d, defaults.error])

  function chooseSource(next: IncomeSource) {
    setSource(next)
    // A Toters platform makes no sense for a cab fare: clear a suggestion
    // that belongs to another source (typed-in names are kept).
    if (ALL_SUGGESTED.includes(platform) && !PLATFORMS[next].includes(platform)) setPlatform('')
  }

  // The platform's cut, previewed the same way the server computes it:
  // rate x (amount - tips). Tips go fully to the driver.
  const feeRate = d?.platformFeeRates[platform.trim().toLowerCase()] ?? null
  const tipsAmount = tips ? parseAmount(tips) : 0
  const defaultFee = feeRate === null ? null : Math.round(Math.max(0, amount - tipsAmount) * feeRate)
  const fee = feeOverride !== null ? parseAmount(feeOverride) : defaultFee

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount <= 0) return setError(m.income.enterAmount)
    if (!source) return
    setError(null)

    const entry: NewIncome = {
      date,
      amount,
      source,
      hours: optionalNumber(hours),
      orderCount: optionalNumber(orderCount),
      tips: tips ? parseAmount(tips) : null,
      platform: platform.trim() || null,
      // Only send a fee when the driver corrected it; otherwise the server
      // applies the platform's default rate.
      ...(feeOverride !== null && { platformFee: parseAmount(feeOverride) }),
      note: note.trim() || null,
    }
    create.mutate(entry, {
      onSuccess: (saved) =>
        navigate('/', {
          replace: true,
          viewTransition: true,
          state: { flash: fmt(m.dashboard.savedIncome, { amount: formatMoney(saved.amount, currency) }) },
        }),
    })
  }

  return (
    <EntryScreen
      title={m.income.title}
      formId="income-form"
      saving={create.isPending}
      canSave={source !== null}
      saveLabel={amount > 0 ? fmt(m.income.saveAmount, { amount: formatMoney(amount, currency) }) : m.common.save}
    >
      <form id="income-form" onSubmit={handleSubmit} className="space-y-6">
        <AmountInput label={m.income.howMuch} value={amount} onChange={setAmount} currency={currency} />

        <DayPicker value={date} onChange={setDate} />

        <Choices label={m.income.from} options={SOURCES.map((s) => ({ value: s, label: m.sources[s] }))} value={source} onChange={chooseSource} />

        {source && PLATFORMS[source].length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">{m.income.platformOptional}</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS[source].map((name) => (
                <ChoiceButton
                  key={name}
                  selected={platform === name}
                  onClick={() => setPlatform(platform === name ? '' : name)}
                  className="h-10 rounded-full px-4"
                >
                  {name}
                </ChoiceButton>
              ))}
            </div>
          </div>
        )}

        {feeRate !== null && amount > 0 && fee !== null && (
          <div className="pop rounded-2xl border border-warn-line bg-warn-soft p-4 text-sm text-warn-ink">
            <div className="flex items-start justify-between gap-3">
              <p>
                <span className="font-semibold">{platform.trim()}</span> {m.income.keeps}{' '}
                {feeOverride === null ? (
                  <>
                    {Math.round(feeRate * 100)}% (<span className="font-semibold">{formatMoney(fee, currency)}</span>)
                  </>
                ) : (
                  <span className="font-semibold">{formatMoney(fee, currency)}</span>
                )}
                <span className="block text-base font-bold">{fmt(m.income.youKeep, { amount: formatMoney(Math.max(0, amount - fee), currency) })}</span>
              </p>
              <button
                type="button"
                onClick={() => setFeeOverride(feeOverride === null ? String(defaultFee ?? 0) : null)}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                {feeOverride === null ? m.income.change : fmt(m.income.useRate, { pct: Math.round(feeRate * 100) })}
              </button>
            </div>
            {feeOverride !== null && (
              <div className="pop mt-3">
                <Field
                  id="platform-fee"
                  dir="ltr"
                  label={fmt(m.income.actuallyKept, { platform: platform.trim() })}
                  inputMode="numeric"
                  value={feeOverride ? formatNumber(parseAmount(feeOverride)) : ''}
                  onChange={(e) => setFeeOverride(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Optional details stay folded so the fast path stays fast. */}
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold text-ink-2">
            {m.income.moreDetails}
            <span className="text-faint transition-transform duration-200 group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="hours"
                dir="ltr"
                label={m.income.hours}
                inputMode="decimal"
                placeholder={m.income.hoursPlaceholder}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <Field
                id="orders"
                dir="ltr"
                label={source === 'cab' ? m.income.trips : m.income.orders}
                inputMode="numeric"
                placeholder={m.income.countPlaceholder}
                value={orderCount}
                onChange={(e) => setOrderCount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Field
              id="tips"
              dir="ltr"
              label={m.income.tips}
              inputMode="numeric"
              placeholder="0"
              value={tips ? formatNumber(parseAmount(tips)) : ''}
              onChange={(e) => setTips(e.target.value)}
            />
            <Field
              id="platform"
              label={m.income.platformName}
              placeholder={m.income.platformPlaceholder}
              value={platform}
              maxLength={50}
              onChange={(e) => setPlatform(e.target.value)}
            />
            <Field id="note" label={m.common.note} placeholder={m.common.optional} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </div>
        </details>

        <ErrorMessage message={error ?? create.error?.message ?? null} />
      </form>
    </EntryScreen>
  )
}
