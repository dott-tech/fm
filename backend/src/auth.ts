import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "./db.js";

const frontendUrl = process.env["FRONTEND_URL"];

export const ROLES = ["cab_driver", "delivery_rider"] as const;

// Better Auth handles sign-up, log-in, log-out, password hashing and sessions.
// It stores everything in our own Postgres tables through Prisma.
// Needs BETTER_AUTH_SECRET and BETTER_AUTH_URL in .env (read automatically).
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // stay logged in for 30 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
  },
  user: {
    // Our extra columns on the users table.
    additionalFields: {
      role: {
        type: [...ROLES],
        required: true,
        input: true, // chosen at sign-up
      },
      currency: {
        type: "string",
        required: false,
        defaultValue: "IQD",
        input: false, // not settable from the sign-up form
      },
      weeklyTarget: {
        type: "number",
        required: false,
        input: false, // set through PATCH /api/me, which validates it
      },
    },
  },
  hooks: {
    // Reject an invalid role with a clear 400 before it ever reaches the database.
    // Applies to sign-up and to Better Auth's own /update-user endpoint.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;
      const role: unknown = ctx.body?.role;
      if (ctx.path === "/update-user" && role === undefined) return; // not changing role
      if (!ROLES.includes(role as (typeof ROLES)[number])) {
        throw new APIError("BAD_REQUEST", {
          message: "Role must be cab_driver or delivery_rider",
        });
      }
    }),
  },
  // Only accept auth requests coming from our own frontend (CSRF protection).
  trustedOrigins: frontendUrl ? [frontendUrl] : [],
  telemetry: { enabled: false },
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
