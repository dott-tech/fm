import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, ErrorMessage, Field, PrimaryButton } from '../components/ui'
import { authClient } from '../lib/auth-client'

export function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      setError(error.message ?? 'Could not log in. Try again.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see what you really earned this week.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required />
        <ErrorMessage message={error} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </PrimaryButton>
      </form>
      <p className="mt-8 text-center text-stone-600">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-emerald-700">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
