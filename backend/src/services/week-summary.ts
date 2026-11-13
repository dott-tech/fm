import { prisma } from "../db.js";
import { addDays, toDbDate, weekContaining } from "../lib/dates.js";

// Totals for the Saturday-Friday week containing `date`.
// Used by GET /api/summary/week and GET /api/dashboard.
//
// Speed: every query runs at the same time (one Promise.all), so the whole
// summary costs ONE database round trip instead of several in a row. Totals are
// computed by Postgres (SUM / GROUP BY), not by loading rows into Node.
export async function weekSummary(userId: string, date: string) {
  const { start, end } = weekContaining(date);
  const inWeek = { userId, date: { gte: toDbDate(start), lte: toDbDate(end) } };

  const [user, incomeTotals, withHours, incomeByDay, expenseByDay, expenseByCategory] = await Promise.all([
    // Read from the DB, not the (cached) session, so a just-changed target shows.
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { weeklyTarget: true, currency: true } }),
    prisma.incomeEntry.aggregate({
      where: inWeek,
      _sum: { amount: true, tips: true, hours: true, orderCount: true, platformFee: true },
      _count: true,
    }),
    // Hourly rate only counts income from entries where hours were logged,
    // otherwise unlogged days would make the rate look better than it is.
    prisma.incomeEntry.aggregate({ where: { ...inWeek, hours: { not: null } }, _sum: { amount: true } }),
    prisma.incomeEntry.groupBy({ by: ["date"], where: inWeek, _sum: { amount: true, platformFee: true } }),
    prisma.expense.groupBy({ by: ["date"], where: inWeek, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: inWeek, _sum: { amount: true } }),
  ]);

  const income = incomeTotals._sum.amount ?? 0;
  // Costs = what the driver paid (expenses) + what platforms kept (fees).
  const platformFees = incomeTotals._sum.platformFee ?? 0;
  const paidExpenses = expenseByCategory.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const expenses = paidExpenses + platformFees;
  const net = income - expenses;
  const hours = incomeTotals._sum.hours?.toNumber() ?? 0;
  const incomeWithHours = withHours._sum.amount ?? 0;
  const target = user.weeklyTarget ?? null;

  // Real hourly rate, honest even when hours were only logged on some days:
  // 1. grossPerHour = income from entries that have hours / those hours
  // 2. keepShare    = share of income left after costs this week (net / income)
  // 3. netPerHour   = grossPerHour x keepShare
  // e.g. 60,000 in 6 h = 10,000/h gross; 25% went on costs -> 7,500/h real.
  const grossPerHour = hours > 0 ? incomeWithHours / hours : null;
  const keepShare = income > 0 ? net / income : 0;
  const netPerHour = grossPerHour === null ? null : Math.round(grossPerHour * keepShare);

  // One row per day Sat..Fri, including empty days, for charts.
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const sameDay = (d: Date) => d.getTime() === toDbDate(day).getTime();
    const incomeRow = incomeByDay.find((r) => sameDay(r.date));
    return {
      date: day,
      income: incomeRow?._sum.amount ?? 0,
      // all costs that day: expenses + platform fees on that day's income
      expenses: (expenseByDay.find((r) => sameDay(r.date))?._sum.amount ?? 0) + (incomeRow?._sum.platformFee ?? 0),
    };
  });

  return {
    weekStart: start,
    weekEnd: end,
    currency: user.currency,
    income,
    tips: incomeTotals._sum.tips ?? 0,
    expenses, // all costs, platform fees included
    platformFees,
    net,
    target,
    // null when no target is set; otherwise how much is still missing (0 = hit).
    remainingToTarget: target === null ? null : Math.max(0, target - net),
    targetHit: target === null ? null : net >= target,
    incomeEntries: incomeTotals._count,
    orderCount: incomeTotals._sum.orderCount ?? 0,
    hours,
    grossPerHour: grossPerHour === null ? null : Math.round(grossPerHour),
    netPerHour, // null when no hours were logged this week
    // Cost breakdown; platform fees appear as their own row.
    expensesByCategory: [
      ...expenseByCategory.map((row) => ({ category: row.category as string, amount: row._sum.amount ?? 0 })),
      ...(platformFees > 0 ? [{ category: "platform_fees", amount: platformFees }] : []),
    ].sort((a, b) => b.amount - a.amount),
    days,
  };
}
