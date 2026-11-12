import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db.js";
import { money } from "../lib/schemas.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

const updateMeSchema = z.object({
  // Weekly goal after costs. null removes the target.
  weeklyTarget: money.nullable(),
});

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  currency?: string | null;
  weeklyTarget?: number | null;
};

function toJson(user: Profile) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    currency: user.currency ?? "IQD",
    weeklyTarget: user.weeklyTarget ?? null,
  };
}

export const me = new Hono<AuthEnv>()
  .use(requireAuth)

  // GET /api/me -> the logged-in user's profile.
  .get("/", (c) => c.json(toJson(c.get("user"))))

  // PATCH /api/me { "weeklyTarget": 500000 } -> update profile settings.
  .patch("/", validate("json", updateMeSchema), async (c) => {
    const { weeklyTarget } = c.req.valid("json");
    const user = await prisma.user.update({
      where: { id: c.get("user").id },
      data: { weeklyTarget },
    });
    return c.json(toJson(user));
  });
