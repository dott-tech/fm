import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

// Wraps zod validation for Hono routes. Bad input -> 400 with a message that
// can be shown to the user as-is, plus which field it's about:
// { "error": "Amount must be at least 1", "field": "amount" }
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      return c.json({ error: issue?.message ?? "Invalid input", field: issue?.path.join(".") || null }, 400);
    }
  });
}
