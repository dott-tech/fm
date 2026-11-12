import { Hono } from "hono";
import { logger } from "hono/logger";
import { health } from "./routes/health.js";

// The app is defined separately from how it's started (index.ts), so the
// same app can later run on Vercel functions without changes.
export const app = new Hono().basePath("/api");

app.use(logger());
app.route("/health", health);
