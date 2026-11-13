import { getMessages, plural } from '../i18n'
import type { CostCategory, ExpenseCategory, RepeatUnit } from './api'

// Icons and display names for database values. Names come from the current
// language's messages, so this file holds no text of its own.

// `pickable: false` = not offered on the add-expense screen (bills are
// recorded automatically when a bill pot is paid).
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; icon: string; pickable: boolean }[] = [
  { value: 'fuel', icon: '⛽', pickable: true },
  { value: 'oil_change', icon: '🛢️', pickable: true },
  { value: 'repairs', icon: '🔧', pickable: true },
  { value: 'tyres', icon: '🛞', pickable: true },
  { value: 'phone_data', icon: '📱', pickable: true },
  { value: 'other', icon: '🧾', pickable: true },
  { value: 'bills', icon: '📅', pickable: false },
]

// Label + icon for any cost row, including the platforms' cut.
export function costMeta(category: CostCategory): { label: string; icon: string } {
  const label = getMessages().costs[category] ?? category
  if (category === 'platform_fees') return { label, icon: '🏷️' }
  return { label, icon: EXPENSE_CATEGORIES.find((c) => c.value === category)?.icon ?? '' }
}

// Weekdays in the Iraqi work-week order (Saturday first), as JS weekday numbers.
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const

// "every month", "every 2 weeks" / "كل شهر", "كل أسبوعين"
export function repeatLabel(every: number, unit: RepeatUnit): string {
  return plural(getMessages().pots.repeat[unit], every)
}

export function daysText(count: number): string {
  return plural(getMessages().common.days, count)
}
