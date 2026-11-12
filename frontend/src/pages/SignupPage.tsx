import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, ErrorMessage, Field, PrimaryButton } from '../components/ui'
import { authClient, type Role } from '../lib/auth-client'

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'cab_driver', label: 'Cab driver', hint: 'Car, taxi or ride-hailing' },
  { value: 'delivery_rider', label: 'Delivery rider', hint: 'Motorcycle, Toters, Talabat…' },
]

export function SignupPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('cab_driver')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      setError(error.message ?? 'Could not create your account. Try again.')
      return
    }
    // Better Auth logs the user in right after sign-up.
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Create your account" subtitle="Takes 30 seconds. Then log every trip in under 10.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">I work as a</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-20 cursor-pointer flex-col justify-center rounded-xl border-2 border-stone-200 bg-white p-3 has-checked:border-emerald-600 has-checked:bg-emerald-50"
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="sr-only"
                />
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs text-stone-500">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="name" name="name" label="Name" autoComplete="name" required />
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Field
          id="password"
          name="password"
          type="password"
          label="Password (8+ characters)"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <ErrorMessage message={error} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </PrimaryButton>
      </form>
      <p className="mt-8 text-center text-stone-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-emerald-700">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
