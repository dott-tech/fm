import { Hono } from "hono";
import { z } from "zod";
import type { IncomeEntry } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { fromDbDate, isoDate, toDbDate } from "../lib/dates.js";
import { PLATFORM_FEE_RATES, defaultPlatformFee } from "../lib/platforms.js";
import { idParamSchema, listQuerySchema, money, optionalNote, positiveAmount } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

const SOURCES = ["cab", "delivery", "freelance", "other"] as const;

const createIncomeSchema = z.object({
  date: isoDate,
  amount: positiveAmount,
  source: z.enum(SOURCES),
  hours: z.number().gt(0, "Hours must be more than 0").max(24, "Hours can't be more than 24").nullish(),
  orderCount: z.number().int().min(0, "Can't be negative").max(1000, "That looks too high").nullish(),
  tips: money.nullish(),
  platform: z.string().trim().max(50).nullish(),
  // The platform's cut. Leave it out to use the platform's default rate
  // (e.g. Baly 20%); send 0 or a number to override it for this entry.
  platformFee: money.nullish(),
  note: optionalNote,
})
  // `amount` is the total received; `tips` is the part of it that was tips.
  .refine((v) => v.tips == null || v.tips <= v.amount, {
    path: ["tips"],
    message: "Tips can't be more than the total amount",
  })
  .refine((v) => v.platformFee == null || v.platformFee <= v.amount, {
    path: ["platformFee"],
    message: "The platform's cut can't be more than the fare",
  });

// What the API returns: plain JSON, dates as "YYYY-MM-DD", hours as a number.
export function toIncomeJson(entry: IncomeEntry) {
  return {
    id: entry.id,
    date: fromDbDate(entry.date),
    amount: entry.amount,
    source: entry.source,
    hours: entry.hours === null ? null : entry.hours.toNumber(),
    orderCount: entry.orderCount,
    tips: entry.tips,
    platform: entry.platform,
    platformFee: entry.platformFee,
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
        platformFee:
          body.platformFee !== undefined ? body.platformFee : defaultPlatformFee(body.platform, body.amount, body.tips),
        note: body.note || null,
      },
    });
    return c.json(toIncomeJson(entry), 201);
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
    return c.json(entries.map(toIncomeJson));
  })

  // GET /api/income/defaults -> pre-fill values for the add-income form:
  // the source and platform of the last entry, or a guess from the user's role.
  .get("/defaults", async (c) => {
    const userId = c.get("user").id;
    // Role is read from the database: it can change in settings, and the
    // session cookie's copy may be up to 5 minutes old.
    const [user, last] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } }),
      prisma.incomeEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { source: true, platform: true },
      }),
    ]);
    const fallbackSource = user.role === "delivery_rider" ? "delivery" : "cab";
    return c.json({
      source: last?.source ?? fallbackSource,
      platform: last?.platform ?? null,
      // So the form can preview "Baly takes 20%" before saving.
      platformFeeRates: PLATFORM_FEE_RATES,
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
