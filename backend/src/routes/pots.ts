import { Hono } from "hono";
import { z } from "zod";
import type { Pot } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { fromDbDate, isoDate, toDbDate } from "../lib/dates.js";
import { nextDueDate, planPot } from "../lib/pot-math.js";
import { idParamSchema, money, positiveAmount } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

// ---------- Validation ----------

const potFields = z.object({
  kind: z.enum(["bill", "goal"]),
  name: z.string().trim().min(1, "Give it a name").max(80),
  icon: z.string().trim().max(16).nullish(),
  targetAmount: positiveAmount,
  dueDate: isoDate.nullish(),
  repeatEvery: z.number().int().min(1).max(365).nullish(),
  repeatUnit: z.enum(["day", "week", "month", "year"]).nullish(),
  dailyAmount: money.min(1, "Daily amount must be at least 1").nullish(),
});
type PotFields = z.infer<typeof potFields>;

// Rules that depend on the kind of pot. Returns an error message or null.
function checkPotRules(p: PotFields): { field: string; message: string } | null {
  const hasRepeat = p.repeatEvery != null || p.repeatUnit != null;
  if (hasRepeat && (p.repeatEvery == null || p.repeatUnit == null)) {
    return { field: "repeatEvery", message: "Repeat needs both how often and the unit" };
  }
  if (p.kind === "bill") {
    if (!p.dueDate) return { field: "dueDate", message: "A bill needs a due date" };
    if (p.dailyAmount != null) return { field: "dailyAmount", message: "Bills get their daily amount from the due date" };
  }
  if (p.kind === "goal") {
    if (hasRepeat) return { field: "repeatEvery", message: "Goals don't repeat" };
    if (!p.dueDate && p.dailyAmount == null) {
      return { field: "dailyAmount", message: "Set a deadline or how much to put aside per day" };
    }
  }
  return null;
}

const createPotSchema = potFields.superRefine((p, ctx) => {
  const problem = checkPotRules(p);
  if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.message });
});

const updatePotSchema = potFields.omit({ kind: true }).partial();

const dateBody = z.object({ date: isoDate });
const todayQuery = z.object({ date: isoDate });

const transferSchema = z.object({
  date: isoDate,
  amount: z.number().int("Must be a whole number").refine((n) => n !== 0, "Amount can't be 0"),
  note: z.string().trim().max(200).nullish(),
});

const paySchema = z.object({
  date: isoDate,
  amount: positiveAmount.optional(), // defaults to the bill amount
});

// ---------- Helpers ----------

async function balances(userId: string, potIds: string[], today: string) {
  const [all, todays] = await Promise.all([
    prisma.potTransfer.groupBy({ by: ["potId"], where: { potId: { in: potIds }, pot: { userId } }, _sum: { amount: true } }),
    prisma.potTransfer.groupBy({
      by: ["potId"],
      where: { potId: { in: potIds }, pot: { userId }, date: toDbDate(today), amount: { gt: 0 } }, // money put in today
      _sum: { amount: true },
    }),
  ]);
  const saved = new Map(all.map((r) => [r.potId, r._sum.amount ?? 0]));
  const putInToday = new Map(todays.map((r) => [r.potId, r._sum.amount ?? 0]));
  return { saved: (id: string) => saved.get(id) ?? 0, putAsideToday: (id: string) => putInToday.get(id) ?? 0 };
}

function withPlan(pot: Pot, saved: number, putAsideToday: number, today: string) {
  const dueDate = pot.dueDate ? fromDbDate(pot.dueDate) : null;
  const plan = planPot({ targetAmount: pot.targetAmount, dueDate, dailyAmount: pot.dailyAmount, saved, putAsideToday }, today);
  return {
    id: pot.id,
    kind: pot.kind,
    name: pot.name,
    icon: pot.icon,
    targetAmount: pot.targetAmount,
    dueDate,
    repeatEvery: pot.repeatEvery,
    repeatUnit: pot.repeatUnit,
    chosenDailyAmount: pot.dailyAmount,
    saved,
    ...plan,
  };
}

// Active pots for the user, each with its daily plan, plus today's totals.
async function potsOverview(userId: string, today: string) {
  const pots = await prisma.pot.findMany({ where: { userId, archivedAt: null } });
  const b = await balances(
    userId,
    pots.map((p) => p.id),
    today,
  );
  const rows = pots
    .map((p) => withPlan(p, b.saved(p.id), b.putAsideToday(p.id), today))
    // Bills first (soonest due first), then goals (soonest deadline, then by name).
    .sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === "bill" ? -1 : 1) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        a.name.localeCompare(b.name),
    );
  return {
    date: today,
    todayTotal: rows.reduce((s, r) => s + r.dailyAmount, 0),
    todayLeft: rows.reduce((s, r) => s + r.todayLeft, 0),
    pots: rows,
  };
}

async function findOwnPot(userId: string, id: string) {
  return prisma.pot.findFirst({ where: { id, userId, archivedAt: null } });
}

// ---------- Routes ----------

export const pots = new Hono<AuthEnv>()
  .use(requireAuth)

  // GET /api/pots?date=2026-11-13 -> pots with daily amounts + today's totals
  .get("/", validate("query", todayQuery), async (c) => {
    return c.json(await potsOverview(c.get("user").id, c.req.valid("query").date));
  })

  // GET /api/pots/:id?date=2026-11-13 -> one pot with its plan (edit screen)
  .get("/:id", validate("param", idParamSchema), validate("query", todayQuery), async (c) => {
    const userId = c.get("user").id;
    const { date } = c.req.valid("query");
    const pot = await findOwnPot(userId, c.req.valid("param").id);
    if (!pot) return c.json({ error: "Not found" }, 404);
    const b = await balances(userId, [pot.id], date);
    return c.json(withPlan(pot, b.saved(pot.id), b.putAsideToday(pot.id), date));
  })

  // POST /api/pots -> create a bill or goal
  .post("/", validate("json", createPotSchema), async (c) => {
    const body = c.req.valid("json");
    const pot = await prisma.pot.create({
      data: {
        userId: c.get("user").id,
        kind: body.kind,
        name: body.name,
        icon: body.icon || null,
        targetAmount: body.targetAmount,
        dueDate: body.dueDate ? toDbDate(body.dueDate) : null,
        repeatEvery: body.repeatEvery ?? null,
        repeatUnit: body.repeatUnit ?? null,
        dailyAmount: body.dailyAmount ?? null,
      },
    });
    return c.json({ id: pot.id }, 201);
  })

  // POST /api/pots/set-aside { date } -> the one-tap "I put today's money aside":
  // adds each pot's remaining amount for today.
  .post("/set-aside", validate("json", dateBody), async (c) => {
    const userId = c.get("user").id;
    const { date } = c.req.valid("json");
    const overview = await potsOverview(userId, date);
    const toMove = overview.pots.filter((p) => p.todayLeft > 0);

    await prisma.potTransfer.createMany({
      data: toMove.map((p) => ({ potId: p.id, date: toDbDate(date), amount: p.todayLeft, note: "Daily set-aside" })),
    });
    return c.json(await potsOverview(userId, date));
  })

  // PATCH /api/pots/:id -> edit name, amount, dates...
  .patch("/:id", validate("param", idParamSchema), validate("json", updatePotSchema), async (c) => {
    const userId = c.get("user").id;
    const pot = await findOwnPot(userId, c.req.valid("param").id);
    if (!pot) return c.json({ error: "Not found" }, 404);

    const changes = c.req.valid("json");
    // Check the kind-specific rules against the pot as it would be after the edit.
    const merged: PotFields = {
      kind: pot.kind,
      name: changes.name ?? pot.name,
      icon: changes.icon !== undefined ? changes.icon : pot.icon,
      targetAmount: changes.targetAmount ?? pot.targetAmount,
      dueDate: changes.dueDate !== undefined ? changes.dueDate : pot.dueDate ? fromDbDate(pot.dueDate) : null,
      repeatEvery: changes.repeatEvery !== undefined ? changes.repeatEvery : pot.repeatEvery,
      repeatUnit: changes.repeatUnit !== undefined ? changes.repeatUnit : pot.repeatUnit,
      dailyAmount: changes.dailyAmount !== undefined ? changes.dailyAmount : pot.dailyAmount,
    };
    const problem = checkPotRules(merged);
    if (problem) return c.json({ error: problem.message, field: problem.field }, 400);

    await prisma.pot.update({
      where: { id: pot.id },
      data: {
        name: merged.name,
        icon: merged.icon || null,
        targetAmount: merged.targetAmount,
        dueDate: merged.dueDate ? toDbDate(merged.dueDate) : null,
        repeatEvery: merged.repeatEvery ?? null,
        repeatUnit: merged.repeatUnit ?? null,
        dailyAmount: merged.dailyAmount ?? null,
      },
    });
    return c.json({ id: pot.id });
  })

  // DELETE /api/pots/:id -> remove the pot and its history
  .delete("/:id", validate("param", idParamSchema), async (c) => {
    const { count } = await prisma.pot.deleteMany({ where: { id: c.req.valid("param").id, userId: c.get("user").id } });
    if (count === 0) return c.json({ error: "Not found" }, 404);
    return c.body(null, 204);
  })

  // POST /api/pots/:id/transfers { date, amount } -> put money in (+) or take it out (-)
  .post("/:id/transfers", validate("param", idParamSchema), validate("json", transferSchema), async (c) => {
    const userId = c.get("user").id;
    const pot = await findOwnPot(userId, c.req.valid("param").id);
    if (!pot) return c.json({ error: "Not found" }, 404);

    const { date, amount, note } = c.req.valid("json");
    if (amount < 0) {
      const b = await balances(userId, [pot.id], date);
      if (b.saved(pot.id) + amount < 0) {
        return c.json({ error: "You can't take out more than is in the pot", field: "amount" }, 400);
      }
    }
    await prisma.potTransfer.create({ data: { potId: pot.id, date: toDbDate(date), amount, note: note || null } });
    return c.json(await potsOverview(userId, date), 201);
  })

  // POST /api/pots/:id/pay { date, amount? } -> pay a bill:
  // records it as an expense, empties the pot, and moves to the next due date
  // (or closes a one-off bill). All in one transaction: all or nothing.
  .post("/:id/pay", validate("param", idParamSchema), validate("json", paySchema), async (c) => {
    const userId = c.get("user").id;
    const pot = await findOwnPot(userId, c.req.valid("param").id);
    if (!pot) return c.json({ error: "Not found" }, 404);
    if (pot.kind !== "bill") return c.json({ error: "Only bills can be paid" }, 400);

    const { date } = c.req.valid("json");
    const amount = c.req.valid("json").amount ?? pot.targetAmount;
    const b = await balances(userId, [pot.id], date);
    const fromPot = Math.min(b.saved(pot.id), amount);

    const nextDue =
      pot.repeatEvery && pot.repeatUnit && pot.dueDate
        ? nextDueDate(fromDbDate(pot.dueDate), pot.repeatEvery, pot.repeatUnit)
        : null;

    await prisma.$transaction([
      prisma.expense.create({
        data: { userId, date: toDbDate(date), amount, category: "bills", note: pot.name },
      }),
      ...(fromPot > 0
        ? [prisma.potTransfer.create({ data: { potId: pot.id, date: toDbDate(date), amount: -fromPot, note: "Paid bill" } })]
        : []),
      prisma.pot.update({
        where: { id: pot.id },
        data: nextDue ? { dueDate: toDbDate(nextDue) } : { archivedAt: new Date() },
      }),
    ]);
    return c.json({ paid: amount, fromPot, nextDueDate: nextDue });
  });
