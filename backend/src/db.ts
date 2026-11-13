import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaNeon } from "@prisma/adapter-neon";
// "#prisma" = the Node or the Workers build of the client (see package.json "imports").
import { PrismaClient } from "#prisma";

// The Neon adapter talks to Neon over WebSockets, which works on Cloudflare
// Workers, where normal long-lived TCP connections don't.
// DATABASE_URL is checked here, on first use, not when the file loads:
// Cloudflare starts the Worker once while uploading it, before secrets exist.
function createClient() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env (or add it as a Cloudflare secret).");
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Cloudflare Workers don't allow a connection opened during one request to be
// used by another, so there each request gets its own client (worker.ts calls
// withRequestDb). In Node (local dev) one shared client is created on first use.
const requestClient = new AsyncLocalStorage<PrismaClient>();
let sharedClient: PrismaClient | undefined;

function currentClient(): PrismaClient {
  return requestClient.getStore() ?? (sharedClient ??= createClient());
}

// Use `prisma` anywhere as a normal client; it points at the right one.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = currentClient();
    const value: unknown = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Runs `handle` with a fresh client, then closes it once the response is
// sent (`waitUntil` keeps the Worker alive just long enough for that).
export async function withRequestDb<T>(handle: () => Promise<T>, waitUntil: (p: Promise<unknown>) => void): Promise<T> {
  const client = createClient();
  try {
    return await requestClient.run(client, handle);
  } finally {
    waitUntil(client.$disconnect());
  }
}
