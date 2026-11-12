import type { ExpenseCategory } from './api'

// Display names for database values. One place to translate later (Arabic).

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'fuel', label: 'Fuel', icon: '⛽' },
  { value: 'oil_change', label: 'Oil change', icon: '🛢️' },
  { value: 'repairs', label: 'Repairs', icon: '🔧' },
  { value: 'tyres', label: 'Tyres', icon: '🛞' },
  { value: 'phone_data', label: 'Phone & data', icon: '📱' },
  { value: 'other', label: 'Other', icon: '🧾' },
]

export function expenseLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category
}
