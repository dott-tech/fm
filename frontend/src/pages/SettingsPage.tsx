import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { parseAmount } from '../components/AmountInput'
import { ChoiceButton, ErrorMessage, Flash, PrimaryButton, Rise, Skeleton } from '../components/ui'
import { fmt, useI18n, type Locale } from '../i18n'
import { authClient } from '../lib/auth-client'
import { currencyLabel, formatNumber } from '../lib/format'
import { WEEK_ORDER } from '../lib/labels'
import { queryClient, useProfile, useUpdateProfile } from '../lib/queries'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'

const THEMES: ThemePref[] = ['system', 'light', 'dark']
const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]

export function SettingsPage() {
  const { m, locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const theme = useThemePref()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [target, setTarget] = useState('')
  const [daysOff, setDaysOff] = useState<number[]>([])
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fill the form from the saved profile (once per load).
  const p = profile.data
  useEffect(() => {
    if (!p || loadedFrom === p.id) return
    setTarget(p.weeklyTarget ? String(p.weeklyTarget) : '')
    setDaysOff(p.daysOff)
    setLoadedFrom(p.id)
  }, [p, loadedFrom])

  function toggleDay(day: number) {
    update.reset()
    setDaysOff((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (daysOff.length > 6) return setError(m.settings.keepOneDay)
    setError(null)
    const weeklyTarget = parseAmount(target)
    update.mutate({ weeklyTarget: weeklyTarget > 0 ? weeklyTarget : null, daysOff })
  }

  async function handleLogout() {
    await authClient.signOut()
    // Forget the previous user's cached data (shared phones).
    queryClient.clear()
    navigate('/login', { replace: true, viewTransition: true })
  }

  const offNames = WEEK_ORDER.filter((d) => daysOff.includes(d)).map((d) => m.weekdays.long[d])

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader title={m.settings.title} />

      {!p ? (
        profile.error ? (
          <ErrorMessage message={m.settings.couldNotLoad} />
        ) : (
          <Skeleton className="mb-6 h-24" />
        )
      ) : (
        <Rise i={0}>
          <section className="mb-6 rounded-2xl bg-surface p-4 shadow-sm">
            <p className="text-lg font-semibold">{p.name}</p>
            <p dir="ltr" className="text-sm text-muted rtl:text-right">
              {p.email}
            </p>
            <p className="mt-2 inline-block rounded-full bg-surface-2 px-3 py-1 text-sm font-medium">
              {m.roles[p.role].label} · {currencyLabel(p.currency)}
            </p>
          </section>
        </Rise>
      )}

      {/* Device preferences: apply instantly, no Save needed. */}
      <Rise i={1}>
        <section className="mb-6 space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
          <fieldset>
            <legend className="mb-2 font-semibold">{m.settings.appearance}</legend>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <ChoiceButton key={t} selected={theme === t} onClick={() => setThemePref(t)}>
                  {m.settings.themes[t]}
                </ChoiceButton>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">{m.settings.language}</legend>
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((l) => (
                <ChoiceButton key={l.value} selected={locale === l.value} onClick={() => setLocale(l.value)}>
                  <span lang={l.value}>{l.label}</span>
                </ChoiceButton>
              ))}
            </div>
          </fieldset>
        </section>
      </Rise>

      <Rise i={2}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl bg-surface p-4 shadow-sm">
            <label htmlFor="weekly-target" className="block font-semibold">
              {m.settings.weeklyTarget}
            </label>
            <p className="mb-3 text-sm text-muted">{m.settings.weeklyTargetHint}</p>
            <div className="flex items-baseline gap-2 rounded-xl border border-line-strong px-4 py-2 transition-colors focus-within:border-accent">
              <input
                id="weekly-target"
                dir="ltr"
                inputMode="numeric"
                placeholder={m.dashboard.targetPlaceholder}
                value={target ? formatNumber(parseAmount(target)) : ''}
                onChange={(e) => {
                  update.reset()
                  setTarget(e.target.value)
                }}
                className="w-full min-w-0 bg-transparent text-2xl font-bold text-ink outline-none placeholder:text-faint rtl:text-right"
              />
              <span className="font-semibold text-muted">{currencyLabel(p?.currency)}</span>
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-4 shadow-sm">
            <p className="font-semibold">{m.settings.daysOff}</p>
            <p className="mb-3 text-sm text-muted">{m.settings.daysOffHint}</p>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={m.settings.daysOff}>
              {WEEK_ORDER.map((day) => {
                const off = daysOff.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={off}
                    aria-label={off ? fmt(m.settings.dayOffAria, { day: m.weekdays.long[day]! }) : m.weekdays.long[day]}
                    onClick={() => toggleDay(day)}
                    className={`h-12 rounded-xl text-xs font-semibold sm:text-sm ${
                      off ? 'bg-info-soft text-info-ink ring-2 ring-info-ring' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {m.weekdays.short[day]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-muted">
              {offNames.length === 0 ? m.settings.workEveryDay : fmt(m.settings.offList, { days: offNames.join(locale === 'ar' ? '، ' : ', ') })}
            </p>
          </section>

          <ErrorMessage message={error ?? update.error?.message ?? null} />
          {update.isSuccess && <Flash>{m.settings.saved}</Flash>}
          <PrimaryButton type="submit" disabled={update.isPending || !p}>
            {update.isPending ? m.common.saving : m.settings.saveSettings}
          </PrimaryButton>
        </form>
      </Rise>

      <button onClick={handleLogout} className="mt-8 mb-4 h-12 w-full rounded-xl border border-line-strong font-semibold text-ink-2">
        {m.settings.logOut}
      </button>
    </main>
  )
}
