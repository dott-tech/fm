import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, ErrorMessage, Field, PrimaryButton } from '../components/ui'
import { translateServerError, useI18n } from '../i18n'
import { authClient } from '../lib/auth-client'
import { queryClient } from '../lib/queries'

export function LoginPage() {
  const { m } = useI18n()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [startingGuest, setStartingGuest] = useState(false)
  const { data: session } = authClient.useSession()
  const isGuest = Boolean(session?.user.isAnonymous)

  async function tryAsGuest() {
    setStartingGuest(true)
    setError(null)
    const { error } = await authClient.signIn.anonymous()
    setStartingGuest(false)
    if (error) {
      setError(m.guest.startFailed)
      return
    }
    navigate('/', { replace: true, viewTransition: true })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    })

    setLoading(false)
    if (error) {
      setError(error.message ? translateServerError(error.message) : m.auth.loginFailed)
      return
    }
    // A guest who logs in to an existing account leaves the guest data behind.
    queryClient.clear()
    navigate('/', { replace: true, viewTransition: true })
  }

  return (
    <AuthLayout title={m.auth.loginTitle} subtitle={m.auth.loginSubtitle}>
      {isGuest && <p className="mb-5 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{m.guest.loginDiscards}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field id="email" name="email" type="email" dir="ltr" label={m.auth.email} autoComplete="email" required />
        <Field id="password" name="password" type="password" dir="ltr" label={m.auth.password} autoComplete="current-password" required />
        <ErrorMessage message={error} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? m.auth.loggingIn : m.auth.logIn}
        </PrimaryButton>
      </form>
      <p className="mt-8 text-center text-ink-2">
        {m.auth.newHere}{' '}
        <Link to="/signup" viewTransition className="font-semibold text-accent-ink">
          {m.auth.createAccount}
        </Link>
      </p>
      {!isGuest && (
        <div className="mt-6 border-t border-line pt-6 text-center">
          <button
            type="button"
            onClick={tryAsGuest}
            disabled={startingGuest}
            className="h-12 w-full rounded-xl border border-line-strong font-semibold text-ink-2 disabled:opacity-60"
          >
            {startingGuest ? m.guest.starting : m.guest.tryIt}
          </button>
          <p className="mt-2 text-sm text-muted">{m.guest.tryHint}</p>
        </div>
      )}
    </AuthLayout>
  )
}
