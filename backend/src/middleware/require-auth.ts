import { createMiddleware } from "hono/factory";
import { getAuth, type AuthSession, type AuthUser } from "../auth.js";

export type AuthEnv = {
  Variables: { user: AuthUser; session: AuthSession };
};

// Put this in front of any route that needs a logged-in user.
// It reads the session cookie, returns 401 if there is none, and otherwise
// makes the user available to the route as c.get("user").
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    return c.json({ error: "Not logged in" }, 401);
  }
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});
