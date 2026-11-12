import { Hono } from "hono";
import { logger } from "hono/logger";
import { auth } from "./auth.js";
import { health } from "./routes/health.js";
import { me } from "./routes/me.js";

// The app is defined separately from how it's started (index.ts), so the
// same app can later run on Vercel functions without changes.
export const app = new Hono().basePath("/api");

app.use(logger());

// All Better Auth endpoints: /api/auth/sign-up/email, /api/auth/sign-in/email,
// /api/auth/sign-out, /api/auth/get-session, ...
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/health", health);
app.route("/me", me);
