import { Hono } from "hono";
import { z } from "zod";
import type { Expense } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { fromDbDate, isoDate, toDbDate } from "../lib/dates.js";
import { idParamSchema, listQuerySchema, optionalNote, positiveAmount } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

const CATEGORIES = ["fuel", "oil_change", "repairs", "tyres", "phone_data", "bills", "other"] as const;

const createExpenseSchema = z.object({
  date: isoDate,
  amount: positiveAmount,
  category: z.enum(CATEGORIES),
  note: optionalNote,
});

function toJson(expense: Expense) {
  return {
    id: expense.id,
    date: fromDbDate(expense.date),
    amount: expense.amount,
    category: expense.category,
    note: expense.note,
    createdAt: expense.createdAt.toISOString(),
  };
}

// Same rules as income: login required, every query scoped to the user.
export const expenses = new Hono<AuthEnv>()
  .use(requireAuth)

  // POST /api/expenses -> create an expense
  .post("/", validate("json", createExpenseSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    const expense = await prisma.expense.create({
      data: {
        userId: user.id,
        date: toDbDate(body.date),
        amount: body.amount,
        category: body.category,
        note: body.note || null,
      },
    });
    return c.json(toJson(expense), 201);
  })

  // GET /api/expenses?from=2026-11-08&to=2026-11-14 -> expenses, newest first
  .get("/", validate("query", listQuerySchema), async (c) => {
    const user = c.get("user");
    const { from, to, limit } = c.req.valid("query");

    const rows = await prisma.expense.findMany({
      where: {
        userId: user.id,
        date: {
          ...(from && { gte: toDbDate(from) }),
          ...(to && { lte: toDbDate(to) }),
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return c.json(rows.map(toJson));
  })

  // GET /api/expenses/defaults -> the category used last (fuel for new users,
  // since it's by far the most frequent cost).
  .get("/defaults", async (c) => {
    const user = c.get("user");
    const last = await prisma.expense.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { category: true },
    });
    return c.json({ category: last?.category ?? "fuel" });
  })

  // DELETE /api/expenses/:id
  .delete("/:id", validate("param", idParamSchema), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    const { count } = await prisma.expense.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) return c.json({ error: "Expense not found" }, 404);
    return c.body(null, 204);
  });
