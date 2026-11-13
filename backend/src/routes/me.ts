import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db.js";
import { ROLES } from "../auth.js";
import { money } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

// Settings the user can change. Send only what changes.
const updateMeSchema = z
  .object({
    role: z.enum(ROLES, "Role must be cab_driver or delivery_rider"),
    // Weekly goal after costs. null removes the target.
    weeklyTarget: money.nullable(),
    // Regular days off as weekday numbers (0 = Sunday ... 5 = Friday).
    daysOff: z
      .array(z.number().int().min(0, "Days go from 0 (Sunday) to 6 (Saturday)").max(6, "Days go from 0 (Sunday) to 6 (Saturday)"))
      .max(6, "Keep at least one working day")
      .refine((days) => new Set(days).size === days.length, "Each day only once"),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

const profileSelect = {
  id: true,
  name: true,
  email: true,
  isAnonymous: true,
  role: true,
  currency: true,
  weeklyTarget: true,
  daysOff: true,
} as const;

export const me = new Hono<AuthEnv>()
  .use(requireAuth)

  // GET /api/me -> the logged-in user's profile and settings.
  .get("/", async (c) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: c.get("user").id }, select: profileSelect });
    return c.json(user);
  })

  // PATCH /api/me { "weeklyTarget": 500000, "daysOff": [5] } -> update settings.
  .patch("/", validate("json", updateMeSchema), async (c) => {
    const { role, weeklyTarget, daysOff } = c.req.valid("json");
    const user = await prisma.user.update({
      where: { id: c.get("user").id },
      data: {
        ...(role !== undefined && { role }),
        ...(weeklyTarget !== undefined && { weeklyTarget }),
        ...(daysOff !== undefined && { daysOff: [...daysOff].sort() }),
      },
      select: profileSelect,
    });
    return c.json(user);
  });
