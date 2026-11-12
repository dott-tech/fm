// Formatting helpers. Kept in one place so Arabic/RTL support later only
// needs changes here.

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatMoney(amount: number, currency = 'IQD'): string {
  return `${numberFormat.format(amount)} ${currency}`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

// Short form for small tiles: 125,000 -> "125K", 1,250,000 -> "1.3M".
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export function formatCompact(value: number): string {
  // Typographic minus (−) instead of a hyphen for negative values.
  return compactFormat.format(value).replace('-', '−')
}

function parseIsoDay(isoDay: string): Date {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

// "Sat 7 – Fri 13 Nov"
export function formatWeekRange(start: string, end: string): string {
  const s = parseIsoDay(start)
  const e = parseIsoDay(end)
  const startText = s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', ...(s.getMonth() !== e.getMonth() && { month: 'short' }) })
  const endText = e.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${startText} – ${endText}`
}

// Whole days from today until the given day (0 = today).
export function daysUntil(isoDay: string): number {
  return Math.round((parseIsoDay(isoDay).getTime() - parseIsoDay(localIsoDate()).getTime()) / 86_400_000)
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

export function formatDay(isoDay: string): string {
  if (isoDay === localIsoDate()) return 'Today'
  if (isoDay === daysAgoIso(1)) return 'Yesterday'
  return parseIsoDay(isoDay).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
