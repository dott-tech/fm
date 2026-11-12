// Turns database rule violations into clean API errors.
//
// The API validates input first, so normally these never happen. If they do
// (a bug, or two requests racing each other) the database refuses the write,
// and the user gets a clear 400 instead of a crash.

type DbError = { code: string; message: string; constraint: string | null };

// Postgres error codes we care about (https://www.postgresql.org/docs/current/errcodes-appendix.html)
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";

// Friendly messages for specific rules (names from the *_db_rules migration).
const MESSAGES: Record<string, string> = {
  income_tips_within_amount: "Tips can't be more than the total amount",
  income_hours_range: "Hours must be more than 0 and at most 24",
  pot_bill_shape: "A bill needs a due date",
  pot_goal_shape: "A goal needs a deadline or a daily amount, and can't repeat",
  pot_repeat_complete: "Repeat needs both how often and the unit",
};

// Prisma wraps the Postgres error; dig out the code, message and rule name.
function extractDbError(err: unknown): DbError | null {
  const cause = (err as { meta?: { driverAdapterError?: { cause?: { code?: string; message?: string } } } })?.meta
    ?.driverAdapterError?.cause;
  if (!cause?.code) return null;
  const message = cause.message ?? "";
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1] ?? null;
  return { code: cause.code, message, constraint };
}

export function dbErrorResponse(err: unknown): { status: 400 | 409; body: { error: string; rule?: string } } | null {
  const db = extractDbError(err);
  if (!db) return null;

  if (db.code === CHECK_VIOLATION) {
    if (db.message.includes("below zero")) {
      return { status: 400, body: { error: "You can't take out more than is in the pot" } };
    }
    if (db.message.includes("is closed")) {
      return { status: 400, body: { error: "This bill or goal is closed" } };
    }
    const friendly = db.constraint ? MESSAGES[db.constraint] : undefined;
    return {
      status: 400,
      body: { error: friendly ?? "That value isn't allowed", ...(db.constraint && { rule: db.constraint }) },
    };
  }
  if (db.code === UNIQUE_VIOLATION) return { status: 409, body: { error: "That already exists" } };
  if (db.code === FOREIGN_KEY_VIOLATION || db.code === NOT_NULL_VIOLATION) {
    return { status: 400, body: { error: "Missing or invalid reference" } };
  }
  return null;
}
