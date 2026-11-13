import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Expense,
  type ExpenseDefaults,
  type IncomeDefaults,
  type IncomeEntry,
  type NewExpense,
  type NewIncome,
  type NewPot,
  type Pot,
  type PotsOverview,
  type Profile,
  type WeekSummary,
} from './api'
import { localIsoDate } from './format'

// Data layer: every screen reads through these hooks.
//
// Why it feels fast: responses are cached in memory. Opening a tab again shows
// the last data instantly, then quietly refreshes it in the background
// ("stale-while-revalidate"). After a change, only the affected data refetches.

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data younger than 30 s is shown without refetching
      gcTime: 30 * 60_000, // keep unused data for 30 min (instant back-navigation)
      retry: 1,
      refetchOnWindowFocus: true, // reopening the app refreshes the numbers
    },
  },
})

// Query keys, in one place so invalidation can't drift out of sync.
export const keys = {
  dashboard: (date: string) => ['dashboard', date] as const,
  week: (date: string) => ['week', date] as const,
  pots: (date: string) => ['pots', date] as const,
  pot: (id: string) => ['pot', id] as const,
  profile: ['profile'] as const,
  incomeDefaults: ['income-defaults'] as const,
  expenseDefaults: ['expense-defaults'] as const,
}

export type Dashboard = {
  week: WeekSummary
  pots: PotsOverview
  recent: { income: IncomeEntry[]; expenses: Expense[] }
}

// ---- Reads ----

export function useDashboard() {
  const today = localIsoDate()
  return useQuery({ queryKey: keys.dashboard(today), queryFn: () => api<Dashboard>(`/dashboard?date=${today}`) })
}

export function useWeek(date: string) {
  return useQuery({
    queryKey: keys.week(date),
    queryFn: () => api<WeekSummary>(`/summary/week?date=${date}`),
    placeholderData: (previous) => previous, // keep the old week on screen while the next one loads
  })
}

export function usePots() {
  const today = localIsoDate()
  return useQuery({ queryKey: keys.pots(today), queryFn: () => api<PotsOverview>(`/pots?date=${today}`) })
}

export function usePot(id: string | undefined) {
  return useQuery({
    queryKey: keys.pot(id ?? ''),
    queryFn: () => api<Pot>(`/pots/${id}?date=${localIsoDate()}`),
    enabled: Boolean(id),
    staleTime: 0, // the edit form should start from fresh data
  })
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api<Profile>('/me') })
}

export function useIncomeDefaults() {
  return useQuery({ queryKey: keys.incomeDefaults, queryFn: () => api<IncomeDefaults>('/income/defaults') })
}

export function useExpenseDefaults() {
  return useQuery({ queryKey: keys.expenseDefaults, queryFn: () => api<ExpenseDefaults>('/expenses/defaults') })
}

// Warm the cache for the other tabs while the user looks at the home screen,
// so switching tabs is instant.
export function prefetchTabs() {
  const today = localIsoDate()
  void queryClient.prefetchQuery({ queryKey: keys.week(today), queryFn: () => api<WeekSummary>(`/summary/week?date=${today}`) })
  void queryClient.prefetchQuery({ queryKey: keys.pots(today), queryFn: () => api<PotsOverview>(`/pots?date=${today}`) })
  void queryClient.prefetchQuery({ queryKey: keys.profile, queryFn: () => api<Profile>('/me') })
}

// ---- Writes ----
// Each mutation says which cached data it makes outdated.

function invalidate(...prefixes: string[]) {
  return Promise.all(prefixes.map((p) => queryClient.invalidateQueries({ queryKey: [p] })))
}

// Money in/out changes the week, the dashboard and the "last used" defaults.
const MONEY = ['dashboard', 'week'] as const

export function useCreateIncome() {
  return useMutation({
    mutationFn: (entry: NewIncome) => api<IncomeEntry>('/income', { method: 'POST', body: entry }),
    onSuccess: () => invalidate(...MONEY, 'income-defaults'),
  })
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: (expense: NewExpense) => api<Expense>('/expenses', { method: 'POST', body: expense }),
    onSuccess: () => invalidate(...MONEY, 'expense-defaults'),
  })
}

export function useDeleteEntry() {
  return useMutation({
    mutationFn: ({ kind, id }: { kind: 'income' | 'expense'; id: string }) =>
      api(`/${kind === 'income' ? 'income' : 'expenses'}/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(...MONEY),
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (changes: { role?: Profile['role']; weeklyTarget?: number | null; daysOff?: number[] }) =>
      api<Profile>('/me', { method: 'PATCH', body: changes }),
    onSuccess: (profile) => {
      client.setQueryData(keys.profile, profile)
      // target affects the week; days off affect every daily amount;
      // role changes the add-income form's default source
      return invalidate(...MONEY, 'pots', 'pot', keys.incomeDefaults[0])
    },
  })
}

// Set-aside / skip / undo return the fresh overview: put it straight into the
// cache (no extra request), then refresh the dashboard copy.
function useOverviewMutation(request: (date: string) => Promise<PotsOverview>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (overview) => {
      client.setQueryData(keys.pots(overview.date), overview)
      client.setQueryData<Dashboard>(keys.dashboard(overview.date), (d) => (d ? { ...d, pots: overview } : d))
    },
  })
}

export const useSetAside = () =>
  useOverviewMutation((date) => api<PotsOverview>('/pots/set-aside', { method: 'POST', body: { date } }))
export const useSkipToday = () =>
  useOverviewMutation((date) => api<PotsOverview>('/pots/skip', { method: 'POST', body: { date } }))
export const useUndoSkip = () =>
  useOverviewMutation((date) => api<PotsOverview>(`/pots/skip?date=${date}`, { method: 'DELETE' }))

const POTS = ['pots', 'pot', 'dashboard'] as const

export function useSavePot() {
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: NewPot | Omit<NewPot, 'kind'> }) =>
      id ? api(`/pots/${id}`, { method: 'PATCH', body }) : api('/pots', { method: 'POST', body }),
    onSuccess: () => invalidate(...POTS),
  })
}

export function useAddToPot() {
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api(`/pots/${id}/transfers`, { method: 'POST', body: { date: localIsoDate(), amount } }),
    onSuccess: () => invalidate(...POTS),
  })
}

export function usePayBill() {
  return useMutation({
    mutationFn: (id: string) => api(`/pots/${id}/pay`, { method: 'POST', body: { date: localIsoDate() } }),
    // paying a bill also adds an expense, so the week changes too
    onSuccess: () => invalidate(...POTS, 'week'),
  })
}

export function useDeletePot() {
  return useMutation({
    mutationFn: (id: string) => api(`/pots/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(...POTS),
  })
}
