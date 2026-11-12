import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";

// GET /api/me -> the logged-in user's profile.
export const me = new Hono<AuthEnv>().use(requireAuth).get("/", (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    currency: user.currency,
    weeklyTarget: user.weeklyTarget ?? null,
  });
});
