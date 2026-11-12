// Formatting helpers. Kept in one place so Arabic/RTL support later only
// needs changes here.

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatMoney(amount: number, currency = 'IQD'): string {
  return `${numberFormat.format(amount)} ${currency}`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
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
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
