import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// One shared Prisma client for the whole backend.
// The Neon adapter talks to Neon over HTTP/WebSockets, which works on
// serverless hosts (Vercel) where normal long-lived TCP connections don't.
export const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});
