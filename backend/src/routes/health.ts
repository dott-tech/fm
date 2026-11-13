import { Hono } from "hono";
import { prisma } from "../db.js";

// Settings the server needs. Health reports which are missing by NAME only
// (never values), so a deploy with a forgotten secret is easy to spot.
const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "FRONTEND_URL"] as const;

// GET /api/health -> checks the server is up, configured, and can reach the database.
export const health = new Hono().get("/", async (c) => {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // Also list the setting NAMES Cloudflare passed to this Worker (no
    // values), to tell "not added" apart from "added under another name".
    const received = Object.keys((c.env ?? {}) as object).sort();
    return c.json({ ok: false, missing, received }, 503);
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, db: "up" });
  } catch {
    return c.json({ ok: false, db: "down" }, 503);
  }
});
