import { Hono } from "hono";
import { z } from "zod";
import type { IncomeEntry } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { fromDbDate, isoDate, toDbDate } from "../lib/dates.js";
import { idParamSchema, listQuerySchema, money, optionalNote, positiveAmount } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

const SOURCES = ["cab", "delivery", "freelance", "other"] as const;

const createIncomeSchema = z.object({
  date: isoDate,
  amount: positiveAmount,
  source: z.enum(SOURCES),
  hours: z.number().min(0).max(24).nullish(),
  orderCount: z.number().int().min(0).max(1000).nullish(),
  tips: money.nullish(),
  platform: z.string().trim().max(50).nullish(),
  note: optionalNote,
})
  // `amount` is the total received; `tips` is the part of it that was tips.
  .refine((v) => v.tips == null || v.tips <= v.amount, {
    path: ["tips"],
    message: "Tips can't be more than the total amount",
  });

// What the API returns: plain JSON, dates as "YYYY-MM-DD", hours as a number.
function toJson(entry: IncomeEntry) {
  return {
    id: entry.id,
    date: fromDbDate(entry.date),
    amount: entry.amount,
    source: entry.source,
    hours: entry.hours === null ? null : entry.hours.toNumber(),
    orderCount: entry.orderCount,
    tips: entry.tips,
    platform: entry.platform,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
  };
}

// Every route here requires a logged-in user, and every query is filtered by
// that user's id, so nobody can read or delete someone else's entries.
export const income = new Hono<AuthEnv>()
  .use(requireAuth)

  // POST /api/income -> create an entry
  .post("/", validate("json", createIncomeSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    const entry = await prisma.incomeEntry.create({
      data: {
        userId: user.id,
        date: toDbDate(body.date),
        amount: body.amount,
        source: body.source,
        hours: body.hours == null ? null : Math.round(body.hours * 100) / 100,
        orderCount: body.orderCount ?? null,
        tips: body.tips ?? null,
        platform: body.platform || null,
        note: body.note || null,
      },
    });
    return c.json(toJson(entry), 201);
  })

  // GET /api/income?from=2026-11-08&to=2026-11-14 -> entries, newest first
  .get("/", validate("query", listQuerySchema), async (c) => {
    const user = c.get("user");
    const { from, to, limit } = c.req.valid("query");

    const entries = await prisma.incomeEntry.findMany({
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
    return c.json(entries.map(toJson));
  })

  // GET /api/income/defaults -> pre-fill values for the add-income form:
  // the source and platform of the last entry, or a guess from the user's role.
  .get("/defaults", async (c) => {
    const user = c.get("user");
    const last = await prisma.incomeEntry.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { source: true, platform: true },
    });
    const fallbackSource = user.role === "delivery_rider" ? "delivery" : "cab";
    return c.json({
      source: last?.source ?? fallbackSource,
      platform: last?.platform ?? null,
    });
  })

  // DELETE /api/income/:id -> remove a mistaken entry
  .delete("/:id", validate("param", idParamSchema), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    // deleteMany with userId in the filter: deleting someone else's entry
    // simply matches nothing, and we answer 404 without revealing it exists.
    const { count } = await prisma.incomeEntry.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) return c.json({ error: "Entry not found" }, 404);
    return c.body(null, 204);
  });
