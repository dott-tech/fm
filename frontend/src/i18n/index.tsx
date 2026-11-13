import { useSyncExternalStore } from 'react'
import { ar, arServerErrors } from './ar'
import { en, type Messages, type Plural } from './en'

// Language support (English / Arabic) without a library.
//
// The current language lives in a tiny store outside React, so plain helpers
// (number/date formatting, API errors) can read it too. Components subscribe
// with useI18n() and re-render when it changes. The choice is a per-device
// preference, saved in localStorage like the theme.

export type Locale = 'en' | 'ar'

const STORAGE_KEY = 'locale'
const MESSAGES: Record<Locale, Messages> = { en, ar }
const listeners = new Set<() => void>()

function readSaved(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

let current: Locale = readSaved()

// Arabic is written right-to-left: <html dir="rtl"> flips the whole layout.
function applyToDocument(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
}
applyToDocument(current)

export function getLocale(): Locale {
  return current
}

export function getMessages(): Messages {
  return MESSAGES[current]
}

export function setLocale(locale: Locale) {
  if (locale === current) return
  current = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // private mode etc.: the choice just won't survive a reload
  }
  applyToDocument(locale)
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// "Hi {name}" + { name: 'Ali' } -> "Hi Ali"
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

// Picks the right plural form for the current language, then fills {count}.
export function plural(forms: Plural, count: number, vars: Record<string, string | number> = {}): string {
  const rule = new Intl.PluralRules(current).select(count)
  return fmt(forms[rule] ?? forms.other, { count, ...vars })
}

// Server messages are English; show the Arabic version when there is one.
export function translateServerError(message: string): string {
  return current === 'ar' ? (arServerErrors[message] ?? message) : message
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return { locale, m: MESSAGES[locale], setLocale, fmt, plural, isRtl: locale === 'ar' }
}
