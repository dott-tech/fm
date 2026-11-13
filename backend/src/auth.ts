import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
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
    // Speed: keep a signed copy of the session in a cookie for 5 minutes, so
    // most requests don't need a database lookup just to know who's calling.
    // Trade-off: a session revoked on another device stays usable for up to
    // 5 minutes, and user fields in it may be up to 5 minutes old, so routes
    // read changeable settings (target, days off) from the database instead.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    // Our extra columns on the users table.
    additionalFields: {
      role: {
        type: [...ROLES],
        required: true,
        defaultValue: "cab_driver", // guests start as cab drivers (changeable in settings)
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
  plugins: [
    // Guest mode: "Try without an account" creates a real (anonymous) user
    // with a session, so every screen works unchanged. If the guest later
    // creates an account, their data moves to it; the guest user is then
    // deleted by the plugin. Logging in to an EXISTING account from guest
    // mode discards the guest's data (no merging into an existing account).
    anonymous({
      generateName: () => "Guest",
      onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
        if (ctx.path !== "/sign-up/email") return;
        const from = anonymousUser.user.id;
        const to = newUser.user.id;
        const guest = await prisma.user.findUnique({
          where: { id: from },
          select: { weeklyTarget: true, daysOff: true },
        });
        await prisma.$transaction([
          prisma.incomeEntry.updateMany({ where: { userId: from }, data: { userId: to } }),
          prisma.expense.updateMany({ where: { userId: from }, data: { userId: to } }),
          prisma.pot.updateMany({ where: { userId: from }, data: { userId: to } }),
          prisma.daySkip.updateMany({ where: { userId: from }, data: { userId: to } }),
          prisma.user.update({
            where: { id: to },
            data: { weeklyTarget: guest?.weeklyTarget ?? null, daysOff: guest?.daysOff ?? [] },
          }),
        ]);
      },
    }),
  ],
  // Only accept auth requests coming from our own frontend (CSRF protection).
  trustedOrigins: frontendUrl ? [frontendUrl] : [],
  telemetry: { enabled: false },
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
