import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { parseAmount } from '../components/AmountInput'
import { ErrorMessage, PrimaryButton } from '../components/ui'
import { api, type Profile } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { formatNumber } from '../lib/format'
import { WEEKDAYS } from '../lib/labels'

const ROLE_LABEL = { cab_driver: 'Cab driver', delivery_rider: 'Delivery rider' } as const

export function SettingsPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [target, setTarget] = useState('')
  const [daysOff, setDaysOff] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Profile>('/me')
      .then((p) => {
        setProfile(p)
        setTarget(p.weeklyTarget ? String(p.weeklyTarget) : '')
        setDaysOff(p.daysOff)
      })
      .catch(() => setError('Could not load your settings.'))
  }, [])

  function toggleDay(day: number) {
    setSavedAt(null)
    setDaysOff((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (daysOff.length > 6) return setError('Keep at least one working day.')
    setSaving(true)
    setError(null)
    try {
      const weeklyTarget = parseAmount(target)
      const updated = await api<Profile>('/me', {
        method: 'PATCH',
        body: { weeklyTarget: weeklyTarget > 0 ? weeklyTarget : null, daysOff },
      })
      setProfile(updated)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <PageHeader title="Settings" />

      {profile && (
        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold">{profile.name}</p>
          <p className="text-sm text-stone-500">{profile.email}</p>
          <p className="mt-2 inline-block rounded-full bg-stone-100 px-3 py-1 text-sm font-medium">
            {ROLE_LABEL[profile.role]} · {profile.currency}
          </p>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="weekly-target" className="block font-semibold">
            Weekly target
          </label>
          <p className="mb-3 text-sm text-stone-500">What you want left after costs, Saturday to Friday.</p>
          <div className="flex items-baseline gap-2 rounded-xl border border-stone-300 px-4 py-2 focus-within:border-emerald-600">
            <input
              id="weekly-target"
              inputMode="numeric"
              placeholder="e.g. 500,000"
              value={target ? formatNumber(parseAmount(target)) : ''}
              onChange={(e) => {
                setSavedAt(null)
                setTarget(e.target.value)
              }}
              className="w-full min-w-0 bg-transparent text-2xl font-bold outline-none"
            />
            <span className="font-semibold text-stone-500">{profile?.currency ?? 'IQD'}</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold">Days off</p>
          <p className="mb-3 text-sm text-stone-500">Daily set-aside amounts are spread over your working days only.</p>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days off">
            {WEEKDAYS.map((day) => {
              const off = daysOff.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={off}
                  aria-label={`${day.long}${off ? ', day off' : ''}`}
                  onClick={() => toggleDay(day.value)}
                  className={`h-12 rounded-xl text-sm font-semibold ${
                    off ? 'bg-sky-100 text-sky-900 ring-2 ring-sky-400' : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-sm text-stone-500">
            {daysOff.length === 0
              ? 'You work every day.'
              : `Off: ${WEEKDAYS.filter((d) => daysOff.includes(d.value)).map((d) => d.long).join(', ')}`}
          </p>
        </section>

        <ErrorMessage message={error} />
        {savedAt && (
          <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
            ✓ Saved
          </p>
        )}
        <PrimaryButton type="submit" disabled={saving || !profile}>
          {saving ? 'Saving…' : 'Save settings'}
        </PrimaryButton>
      </form>

      <button onClick={handleLogout} className="mt-8 mb-4 h-12 w-full rounded-xl border border-stone-300 font-semibold text-stone-700">
        Log out
      </button>
    </main>
  )
}
