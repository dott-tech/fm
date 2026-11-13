import type { ExecutionContext } from "hono";
import { app } from "./app.js";
import { withRequestDb } from "./db.js";

// Cloudflare Workers entry point (see wrangler.jsonc). The same Hono app as
// local dev (index.ts). Secrets and vars set in Cloudflare show up in
// process.env (nodejs_compat), so the rest of the code doesn't change.
// Requests to /api/* reach this Worker; everything else is the built
// frontend, served straight from Cloudflare's static assets.
export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    try {
      // Each request gets its own database connection (a Workers rule).
      return await withRequestDb(() => Promise.resolve(app.fetch(request, env, ctx)), (p) => ctx.waitUntil(p));
    } catch (err) {
      // e.g. a missing secret: log it for the dashboard, show nothing internal.
      console.error(err);
      return Response.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  },
};

