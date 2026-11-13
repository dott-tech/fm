import { getLocale, getMessages } from '../i18n'

// Formatting helpers. They read the current language, so the same call gives
// "Today" or "اليوم", "Sat 7 Nov" or "السبت 7 تشرين الثاني".
//
// Numbers always use Western digits (25,000) in both languages: they're what
// drivers see on banknotes and in apps, and clearer for money.

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

// Arabic (Iraq) month/day names with Western digits; English with day-month order.
function dateLocale(): string {
  return getLocale() === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB'
}

export function currencyLabel(currency = 'IQD'): string {
  return getMessages().currency[currency] ?? currency
}

export function formatMoney(amount: number, currency = 'IQD'): string {
  return `${numberFormat.format(amount)} ${currencyLabel(currency)}`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

// Short form for small tiles: 125,000 -> "125K", 1,250,000 -> "1.3M".
export function formatCompact(value: number): string {
  // Typographic minus (−) instead of a hyphen for negative values.
  return compactFormat.format(value).replace('-', '−')
}

// "YYYY-MM-DD" for the phone's local day (not UTC: at 1am in Baghdad,
// UTC is still "yesterday").
export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localIsoDate(d)
}

function parseIsoDay(isoDay: string): Date {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function shiftIsoDay(isoDay: string, days: number): string {
  const date = parseIsoDay(isoDay)
  date.setDate(date.getDate() + days)
  return localIsoDate(date)
}

export function formatDay(isoDay: string): string {
  const m = getMessages()
  if (isoDay === localIsoDate()) return m.common.today
  if (isoDay === daysAgoIso(1)) return m.common.yesterday
  return parseIsoDay(isoDay).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

// "Sat 7 – Fri 13 Nov"
export function formatWeekRange(start: string, end: string): string {
  const s = parseIsoDay(start)
  const e = parseIsoDay(end)
  const sameMonth = s.getMonth() === e.getMonth()
  const startText = s.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', ...(!sameMonth && { month: 'short' }) })
  const endText = e.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  return `${startText} – ${endText}`
}

// "Sat 7" for chart rows
export function formatWeekdayDay(isoDay: string): string {
  return parseIsoDay(isoDay).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' })
}

// Whole days from today until the given day (0 = today).
export function daysUntil(isoDay: string): number {
  return Math.round((parseIsoDay(isoDay).getTime() - parseIsoDay(localIsoDate()).getTime()) / 86_400_000)
}
