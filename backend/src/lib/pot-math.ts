import { addDays, fromDbDate, toDbDate } from "./dates.js";

// The daily set-aside math, kept free of database code so it's easy to test
// and to explain.
//
// Idea: every pot needs (target - saved) more money by its date. Spread that
// over the days left, including today:
//
//     dailyAmount = what's still missing / days left
//
// e.g. car installment 250,000 due in 20 days, nothing saved -> 12,500/day.
// Skip a day and tomorrow's amount goes up a bit; put in extra and it drops.
// It always adds up to the target by the due date.

// Amounts are rounded UP to the nearest 250 IQD (the smallest banknote), so
// the daily amount is something you can actually hand over in cash.
export const ROUND_TO = 250;

export function roundUp(amount: number): number {
  return Math.ceil(amount / ROUND_TO) * ROUND_TO;
}

// Whole days from `from` to `to` (YYYY-MM-DD). Same day = 0.
export function daysBetween(from: string, to: string): number {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000);
}

export type RepeatUnit = "day" | "week" | "month" | "year";

// Next due date after a bill is paid. Month/year steps keep the day of the
// month where possible (31 Jan + 1 month -> 28/29 Feb, not 3 Mar).
export function nextDueDate(isoDay: string, every: number, unit: RepeatUnit): string {
  if (unit === "day") return addDays(isoDay, every);
  if (unit === "week") return addDays(isoDay, every * 7);

  const date = toDbDate(isoDay);
  const months = unit === "month" ? every : every * 12;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfMonth));
  return fromDbDate(date);
}

export type PotPlanInput = {
  targetAmount: number;
  dueDate: string | null; // bill due date or goal deadline
  dailyAmount: number | null; // chosen daily amount, for goals without a deadline
  saved: number; // everything in the pot right now (sum of all transfers)
  putAsideToday: number; // money put IN today (already included in `saved`)
};

export type PotPlan = {
  remaining: number; // still missing to reach the target
  daysLeft: number | null; // including today; null = no date
  overdue: boolean;
  dailyAmount: number; // what to put aside per day (as of the start of today)
  todayLeft: number; // what's still to put aside today
  funded: boolean; // target reached
};

export function planPot(pot: PotPlanInput, today: string): PotPlan {
  const remaining = Math.max(0, pot.targetAmount - pot.saved);

  // Work out today's amount from the balance at the START of today, so it
  // doesn't shrink while the driver is putting money in during the day.
  // Withdrawals (e.g. paying the bill) count as happening before that, so
  // after paying a bill the new cycle starts from zero.
  const savedBeforeToday = Math.max(0, pot.saved - pot.putAsideToday);
  const missingAtStartOfToday = Math.max(0, pot.targetAmount - savedBeforeToday);

  let daysLeft: number | null = null;
  let overdue = false;
  let dailyAmount: number;

  if (pot.dueDate) {
    const days = daysBetween(today, pot.dueDate) + 1; // count today
    overdue = days < 1;
    daysLeft = Math.max(1, days);
    dailyAmount = roundUp(missingAtStartOfToday / daysLeft);
  } else {
    dailyAmount = pot.dailyAmount ?? 0;
  }
  // Never ask for more than is actually missing.
  dailyAmount = Math.min(dailyAmount, missingAtStartOfToday);

  const todayLeft = Math.max(0, dailyAmount - pot.putAsideToday);

  return { remaining, daysLeft, overdue, dailyAmount, todayLeft, funded: remaining === 0 };
}
