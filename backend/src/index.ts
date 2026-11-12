import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Local / Node entry point. Runs the Hono app as a normal Node server.
const port = Number(process.env["PORT"] ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API running on http://localhost:${info.port}/api`);
});
