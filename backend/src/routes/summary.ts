import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db.js";
import { addDays, isoDate, toDbDate, weekContaining } from "../lib/dates.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

const weekQuerySchema = z.object({
  // Any day inside the wanted week, in the driver's local time ("today" for
  // the current week). The phone sends it, so the server never has to guess
  // the user's time zone.
  date: isoDate,
});

// GET /api/summary/week?date=2026-11-13
// -> totals for the Saturday-Friday week containing that date.
// The dashboard and the weekly summary screen both use this.
export const summary = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/week", validate("query", weekQuerySchema), async (c) => {
    const user = c.get("user");
    const { start, end } = weekContaining(c.req.valid("query").date);
    const inWeek = { userId: user.id, date: { gte: toDbDate(start), lte: toDbDate(end) } };

    // Totals are computed by Postgres (SUM / GROUP BY), not by loading every
    // row into Node. Fast no matter how many entries a driver has.
    const [incomeTotals, incomeByDay, expenseByDay, expenseByCategory] = await Promise.all([
      prisma.incomeEntry.aggregate({
        where: inWeek,
        _sum: { amount: true, tips: true, hours: true, orderCount: true },
        _count: true,
      }),
      prisma.incomeEntry.groupBy({ by: ["date"], where: inWeek, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["date"], where: inWeek, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["category"], where: inWeek, _sum: { amount: true } }),
    ]);

    // Hourly rate only counts income from entries where hours were logged,
    // otherwise unlogged days would make the rate look better than it is.
    const withHours = await prisma.incomeEntry.aggregate({
      where: { ...inWeek, hours: { not: null } },
      _sum: { amount: true },
    });

    const income = incomeTotals._sum.amount ?? 0;
    const expenses = expenseByCategory.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
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
      const date = addDays(start, i);
      const sameDay = (d: Date) => d.getTime() === toDbDate(date).getTime();
      return {
        date,
        income: incomeByDay.find((r) => sameDay(r.date))?._sum.amount ?? 0,
        expenses: expenseByDay.find((r) => sameDay(r.date))?._sum.amount ?? 0,
      };
    });

    return c.json({
      weekStart: start,
      weekEnd: end,
      currency: user.currency,
      income,
      tips: incomeTotals._sum.tips ?? 0,
      expenses,
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
      expensesByCategory: expenseByCategory
        .map((row) => ({ category: row.category, amount: row._sum.amount ?? 0 }))
        .sort((a, b) => b.amount - a.amount),
      days,
    });
  });
