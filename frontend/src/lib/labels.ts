import type { CostCategory, ExpenseCategory, RepeatUnit } from './api'

// Display names for database values. One place to translate later (Arabic).

// `pickable: false` = not offered on the add-expense screen (bills are
// recorded automatically when a bill pot is paid).
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string; pickable: boolean }[] = [
  { value: 'fuel', label: 'Fuel', icon: '⛽', pickable: true },
  { value: 'oil_change', label: 'Oil change', icon: '🛢️', pickable: true },
  { value: 'repairs', label: 'Repairs', icon: '🔧', pickable: true },
  { value: 'tyres', label: 'Tyres', icon: '🛞', pickable: true },
  { value: 'phone_data', label: 'Phone & data', icon: '📱', pickable: true },
  { value: 'other', label: 'Other', icon: '🧾', pickable: true },
  { value: 'bills', label: 'Bills', icon: '📅', pickable: false },
]

export function expenseLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

// Label + icon for any cost row, including the platforms' cut.
export function costMeta(category: CostCategory): { label: string; icon: string } {
  if (category === 'platform_fees') return { label: 'Platform fees', icon: '🏷️' }
  const c = EXPENSE_CATEGORIES.find((x) => x.value === category)
  return { label: c?.label ?? category, icon: c?.icon ?? '' }
}

// Weekdays in the Iraqi work-week order (Saturday first). value = JS weekday.
export const WEEKDAYS = [
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
] as const

const UNIT_LABEL: Record<RepeatUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
}

// "every month", "every 2 weeks"
export function repeatLabel(every: number, unit: RepeatUnit): string {
  return every === 1 ? `every ${UNIT_LABEL[unit][0]}` : `every ${every} ${UNIT_LABEL[unit][1]}`
}
