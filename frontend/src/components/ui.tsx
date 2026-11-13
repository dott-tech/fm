import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { useI18n } from '../i18n'

// Shared building blocks so every screen looks and behaves the same.
// Touch targets are at least 48-56px tall: easy to hit with a thumb.
// Colours are roles (bg-surface, text-muted...) so light/dark mode just works.

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { m } = useI18n()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-accent-ink uppercase">{m.appName}</p>
        <LanguageToggle />
      </div>
      <h1 className="rise text-3xl font-bold">{title}</h1>
      <p className="rise mt-2 mb-8 text-muted" style={{ '--i': 1 } as CSSProperties}>
        {subtitle}
      </p>
      <div className="rise" style={{ '--i': 2 } as CSSProperties}>
        {children}
      </div>
    </main>
  )
}

// EN / ع switch, shown on the login screens (Settings has the full option).
export function LanguageToggle() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="h-9 rounded-full bg-surface-2 px-3 text-sm font-semibold text-ink-2"
      lang={locale === 'ar' ? 'en' : 'ar'}
    >
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string }

export function Field({ label, id, ...props }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      <input
        id={id}
        className="h-14 w-full rounded-xl border border-line-strong bg-surface px-4 text-lg text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
        {...props}
      />
    </label>
  )
}

export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white shadow-sm active:bg-accent-pressed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// A row of big tap-to-select buttons (one choice). Used for source, date, etc.
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 4,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  columns?: 2 | 3 | 4
}) {
  const grid = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns]
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-2">{label}</legend>
      <div className={`grid ${grid} gap-2`}>
        {options.map((option) => (
          <ChoiceButton key={option.value} selected={option.value === value} onClick={() => onChange(option.value)}>
            {option.label}
          </ChoiceButton>
        ))}
      </div>
    </fieldset>
  )
}

export function ChoiceButton({
  selected,
  onClick,
  children,
  className = 'h-12 rounded-xl',
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`border-2 px-2 text-sm font-semibold ${className} ${
        selected ? 'border-accent bg-good-soft text-good-ink' : 'border-line bg-surface text-ink-2'
      }`}
    >
      {children}
    </button>
  )
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="pop rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad-ink">
      {message}
    </p>
  )
}

export function Flash({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="pop rounded-xl bg-good-soft px-4 py-3 font-medium text-good-ink">
      {children}
    </p>
  )
}

// Loading placeholder with a moving shine.
export function Skeleton({ className = '' }: { className?: string }) {
  const { m } = useI18n()
  return <div className={`skeleton rounded-2xl ${className}`} role="status" aria-label={m.common.loading} />
}

// Staggered entrance: <Rise i={2}>…</Rise> appears slightly after i={1}.
export function Rise({ i = 0, className = '', children }: { i?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`rise ${className}`} style={{ '--i': i } as CSSProperties}>
      {children}
    </div>
  )
}
