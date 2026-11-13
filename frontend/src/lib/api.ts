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
  platformFee: number | null // part of `amount` the platform kept (a cost)
  note: string | null
  createdAt: string
}

// platformFee: leave out to use the platform's default rate (e.g. Baly 20%).
export type NewIncome = Omit<IncomeEntry, 'id' | 'createdAt' | 'platformFee'> & { platformFee?: number | null }

export type IncomeDefaults = {
  source: IncomeSource
  platform: string | null
  platformFeeRates: Record<string, number> // lowercase platform -> share kept, e.g. { baly: 0.2 }
}

export type ExpenseCategory = 'fuel' | 'oil_change' | 'repairs' | 'tyres' | 'phone_data' | 'bills' | 'other'

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

// Cost rows in summaries: expense categories plus the platforms' cut.
export type CostCategory = ExpenseCategory | 'platform_fees'

// GET/PATCH /api/me
export type Profile = {
  id: string
  name: string
  email: string
  role: 'cab_driver' | 'delivery_rider'
  currency: string
  weeklyTarget: number | null
  daysOff: number[]
}

// ---- Pots: bills and goals with a daily set-aside amount ----

export type PotKind = 'bill' | 'goal'
export type RepeatUnit = 'day' | 'week' | 'month' | 'year'

export type Pot = {
  id: string
  kind: PotKind
  name: string
  icon: string | null
  targetAmount: number
  dueDate: string | null
  repeatEvery: number | null
  repeatUnit: RepeatUnit | null
  chosenDailyAmount: number | null
  saved: number
  remaining: number
  daysLeft: number | null
  overdue: boolean
  dailyAmount: number
  todayLeft: number
  funded: boolean
}

export type DayStatus = 'work' | 'off' | 'skipped'

export type PotsOverview = {
  date: string
  todayStatus: DayStatus
  daysOff: number[]
  todayTotal: number // all pots' daily amounts
  todayLeft: number // what's still to put aside today
  pots: Pot[]
}

export type NewPot = {
  kind: PotKind
  name: string
  icon?: string | null
  targetAmount: number
  dueDate?: string | null
  repeatEvery?: number | null
  repeatUnit?: RepeatUnit | null
  dailyAmount?: number | null
}

// GET /api/summary/week?date=YYYY-MM-DD
export type WeekSummary = {
  weekStart: string // Saturday
  weekEnd: string // Friday
  currency: string
  income: number
  tips: number
  expenses: number // all costs, platform fees included
  platformFees: number
  net: number // income - costs: what's left
  target: number | null
  remainingToTarget: number | null
  targetHit: boolean | null
  incomeEntries: number
  orderCount: number
  hours: number
  grossPerHour: number | null
  netPerHour: number | null
  expensesByCategory: { category: CostCategory; amount: number }[]
  days: { date: string; income: number; expenses: number }[]
}
