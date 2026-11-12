import { Hono } from "hono";
import { prisma } from "../db.js";

// GET /api/health -> checks the server is up and can reach the database.
export const health = new Hono().get("/", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, db: "up" });
  } catch {
    return c.json({ ok: false, db: "down" }, 503);
  }
});
