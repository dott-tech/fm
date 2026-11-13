import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, ChoiceButton, ErrorMessage, Field, PrimaryButton } from '../components/ui'
import { translateServerError, useI18n } from '../i18n'
import { authClient, type Role } from '../lib/auth-client'
import { queryClient } from '../lib/queries'

const ROLES: Role[] = ['cab_driver', 'delivery_rider']

export function SignupPage() {
  const { m } = useI18n()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('cab_driver')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { data: session } = authClient.useSession()
  const isGuest = Boolean(session?.user.isAnonymous)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    const { error } = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
      role,
    })

    setLoading(false)
    if (error) {
      setError(error.message ? translateServerError(error.message) : m.auth.signupFailed)
      return
    }
    // Better Auth logs the user in right after sign-up. A guest's data has
    // moved to the new account, so drop the cached guest copies.
    queryClient.clear()
    navigate('/', { replace: true, viewTransition: true })
  }

  return (
    <AuthLayout title={m.auth.signupTitle} subtitle={isGuest ? m.guest.signupKeeps : m.auth.signupSubtitle}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">{m.auth.iWorkAs}</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((value) => (
              <ChoiceButton
                key={value}
                selected={role === value}
                onClick={() => setRole(value)}
                className="flex min-h-20 flex-col items-start justify-center rounded-xl p-3 text-start"
              >
                <span className="text-base font-semibold">{m.roles[value].label}</span>
                <span className="text-xs font-normal text-muted">{m.roles[value].hint}</span>
              </ChoiceButton>
            ))}
          </div>
        </fieldset>
        <Field id="name" name="name" label={m.auth.name} autoComplete="name" required />
        <Field id="email" name="email" type="email" dir="ltr" label={m.auth.email} autoComplete="email" required />
        <Field
          id="password"
          name="password"
          type="password"
          dir="ltr"
          label={m.auth.passwordNew}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <ErrorMessage message={error} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? m.auth.creatingAccount : m.auth.createAccount}
        </PrimaryButton>
      </form>
      <p className="mt-8 text-center text-ink-2">
        {m.auth.alreadyHave}{' '}
        <Link to="/login" viewTransition className="font-semibold text-accent-ink">
          {m.auth.logIn}
        </Link>
      </p>
    </AuthLayout>
  )
}
