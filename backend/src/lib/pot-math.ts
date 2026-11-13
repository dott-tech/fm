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

// What kind of day today is for setting money aside.
//   work    = a normal working day
//   off     = one of the driver's regular days off (e.g. Friday)
//   skipped = the driver tapped "Skip today"
export type DayStatus = "work" | "off" | "skipped";

export function weekday(isoDay: string): number {
  return toDbDate(isoDay).getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

// Working days from `from` to `to`, both included, not counting days off.
export function workingDaysBetween(from: string, to: string, daysOff: readonly number[]): number {
  const total = daysBetween(from, to) + 1;
  if (total <= 0) return 0;
  if (daysOff.length === 0) return total;
  // Whole weeks contribute (7 - days off) each; then count the leftover days.
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * (7 - daysOff.length);
  const startDay = weekday(from);
  for (let i = 0; i < total % 7; i++) {
    if (!daysOff.includes((startDay + i) % 7)) count++;
  }
  return count;
}

export type PotPlanInput = {
  targetAmount: number;
  dueDate: string | null; // bill due date or goal deadline
  dailyAmount: number | null; // chosen daily amount, for goals without a deadline
  saved: number; // everything in the pot right now (sum of all transfers)
  putAsideToday: number; // money put IN today (already included in `saved`)
  // Repeating bills: how often the amount comes due again. Used to look
  // ahead, so a payment that falls on a day off is saved up beforehand.
  repeat?: { every: number; unit: RepeatUnit } | null;
};

// How far ahead repeating bills are planned. Two weeks always covers every
// day-off pattern (days off repeat weekly).
export const LOOKAHEAD_DAYS = 14;

export type PotPlan = {
  remaining: number; // still missing to reach the target
  daysLeft: number | null; // WORKING days left, including today if it counts; null = no date
  overdue: boolean;
  dailyAmount: number; // what to put aside per working day
  todayLeft: number; // what's still to put aside today (0 on days off / skipped days)
  funded: boolean; // target reached
};

export function planPot(
  pot: PotPlanInput,
  today: string,
  opts: { daysOff?: readonly number[]; todayStatus?: DayStatus } = {},
): PotPlan {
  const daysOff = opts.daysOff ?? [];
  const todayCounts = (opts.todayStatus ?? "work") === "work";
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
    overdue = daysBetween(today, pot.dueDate) < 0;
    // Spread over working days: from today if it counts, else from tomorrow.
    const from = todayCounts ? today : addDays(today, 1);
    daysLeft = overdue ? (todayCounts ? 1 : 0) : workingDaysBetween(from, pot.dueDate, daysOff);
    // No working day left before the date: everything is due at once.
    let rate = missingAtStartOfToday / Math.max(1, daysLeft);
    let mostNeeded = missingAtStartOfToday;

    // Repeating bills: also make sure the NEXT payments are covered in time.
    // A payment due on a day off (or right after one) must be saved on the
    // working days before it, so it's spread evenly over them. We take the
    // smallest steady daily amount that meets every payment in the next two
    // weeks. Example: 10,000 due every day, Friday off -> 70,000 a week over
    // 6 working days -> 11,750 a day (rounded), and Friday is already covered.
    // Money left in the pot after a payment counts toward the next one.
    if (pot.repeat && !overdue) {
      const horizonEnd = addDays(today, LOOKAHEAD_DAYS - 1);
      let due = nextDueDate(pot.dueDate, pot.repeat.every, pot.repeat.unit);
      let payments = 2;
      while (daysBetween(due, horizonEnd) >= 0) {
        const needed = payments * pot.targetAmount - savedBeforeToday;
        const workingDays = workingDaysBetween(from, due, daysOff);
        if (needed > 0 && workingDays > 0) {
          rate = Math.max(rate, needed / workingDays);
          mostNeeded = Math.max(mostNeeded, needed);
        }
        due = nextDueDate(due, pot.repeat.every, pot.repeat.unit);
        payments++;
      }
    }
    dailyAmount = Math.min(roundUp(rate), mostNeeded); // never more than is needed
  } else {
    dailyAmount = Math.min(pot.dailyAmount ?? 0, missingAtStartOfToday); // never more than is missing
  }

  const todayLeft = todayCounts ? Math.max(0, dailyAmount - pot.putAsideToday) : 0;

  return { remaining, daysLeft, overdue, dailyAmount, todayLeft, funded: remaining === 0 };
}
