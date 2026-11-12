// Minimal JSON fetch wrapper for our own backend (/api/*).
// The session cookie is sent automatically because the API is same-origin.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null)
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Something went wrong. Check your connection and try again.'
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---- Shared types (mirror the backend's JSON responses) ----

export type IncomeSource = 'cab' | 'delivery' | 'freelance' | 'other'

export type IncomeEntry = {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  source: IncomeSource
  hours: number | null
  orderCount: number | null
  tips: number | null
  platform: string | null
  note: string | null
  createdAt: string
}

export type NewIncome = Omit<IncomeEntry, 'id' | 'createdAt'>

export type IncomeDefaults = { source: IncomeSource; platform: string | null }

export type ExpenseCategory = 'fuel' | 'oil_change' | 'repairs' | 'tyres' | 'phone_data' | 'other'

export type Expense = {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  category: ExpenseCategory
  note: string | null
  createdAt: string
}

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>

export type ExpenseDefaults = { category: ExpenseCategory }
