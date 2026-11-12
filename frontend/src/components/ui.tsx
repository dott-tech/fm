import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

// Small shared building blocks so every screen looks and behaves the same.
// Touch targets are at least 56px tall: easy to hit with a thumb.

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-8 text-sm font-semibold tracking-wide text-emerald-700 uppercase">Driver Finance</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 mb-8 text-stone-600">{subtitle}</p>
      {children}
    </main>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string }

export function Field({ label, id, ...props }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      <input
        id={id}
        className="h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        {...props}
      />
    </label>
  )
}

export function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="h-14 w-full rounded-xl bg-emerald-700 text-lg font-semibold text-white active:bg-emerald-800 disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
  )
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  )
}
