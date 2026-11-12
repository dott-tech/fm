import { z } from "zod";
import { isoDate } from "./dates.js";

// Validation rules shared by the income and expense routes.

// Money is whole IQD. The upper bound just catches typos (an extra few zeros).
export const money = z.number().int("Must be a whole number").min(0).max(100_000_000);

export const positiveAmount = money.min(1, "Amount must be at least 1");

export const optionalNote = z.string().trim().max(500).nullish();

// ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
export const listQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const idParamSchema = z.object({ id: z.uuid() });
