import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db.js";
import { isoDate } from "../lib/dates.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";
import { weekSummary } from "../services/week-summary.js";
import { toExpenseJson } from "./expenses.js";
import { toIncomeJson } from "./income.js";
import { potsOverview } from "./pots.js";

const RECENT = 6;

// GET /api/dashboard?date=2026-11-13
// Everything the home screen shows, in ONE request: the week summary, today's
// set-aside plan and recent activity. All queries run in parallel, so the
// screen costs one database round trip instead of five separate requests.
export const dashboard = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/", validate("query", z.object({ date: isoDate })), async (c) => {
    const userId = c.get("user").id;
    const { date } = c.req.valid("query");
    const newestFirst = [{ date: "desc" as const }, { createdAt: "desc" as const }];

    const [week, pots, income, expenses] = await Promise.all([
      weekSummary(userId, date),
      potsOverview(userId, date),
      prisma.incomeEntry.findMany({ where: { userId }, orderBy: newestFirst, take: RECENT }),
      prisma.expense.findMany({ where: { userId }, orderBy: newestFirst, take: RECENT }),
    ]);

    return c.json({
      week,
      pots,
      recent: { income: income.map(toIncomeJson), expenses: expenses.map(toExpenseJson) },
    });
  });
