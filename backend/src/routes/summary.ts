import { Hono } from "hono";
import { z } from "zod";
import { isoDate } from "../lib/dates.js";
import { validate } from "../lib/validate.js";
import { requireAuth, type AuthEnv } from "../middleware/require-auth.js";
import { weekSummary } from "../services/week-summary.js";

const weekQuerySchema = z.object({
  // Any day inside the wanted week, in the driver's local time ("today" for
  // the current week). The phone sends it, so the server never has to guess
  // the user's time zone.
  date: isoDate,
});

// GET /api/summary/week?date=2026-11-13
// -> totals for the Saturday-Friday week containing that date.
export const summary = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/week", validate("query", weekQuerySchema), async (c) => {
    return c.json(await weekSummary(c.get("user").id, c.req.valid("query").date));
  });
