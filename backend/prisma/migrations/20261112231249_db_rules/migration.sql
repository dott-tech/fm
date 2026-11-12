/*
  Warnings:

  - You are about to drop the column `user_id` on the `pot_transfers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "pot_transfers" DROP CONSTRAINT "pot_transfers_user_id_fkey";

-- DropIndex
DROP INDEX "pot_transfers_pot_id_idx";

-- DropIndex
DROP INDEX "pot_transfers_user_id_date_idx";

-- AlterTable
ALTER TABLE "pot_transfers" DROP COLUMN "user_id";

-- CreateIndex
CREATE INDEX "pot_transfers_pot_id_date_idx" ON "pot_transfers"("pot_id", "date");

-- =====================================================================
-- Business rules enforced by the database itself.
-- The API checks the same rules first (with friendly messages); these are
-- the last line of defence: no bug, script or manual SQL can store bad data.
-- Money limits: whole IQD, 1 .. 100,000,000 per row.
-- =====================================================================

-- users ---------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_name_not_blank"        CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "users_currency_iso"          CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "users_weekly_target_range"   CHECK ("weekly_target" IS NULL OR "weekly_target" BETWEEN 0 AND 100000000);

-- income_entries ------------------------------------------------------
ALTER TABLE "income_entries"
  ADD CONSTRAINT "income_amount_range"         CHECK ("amount" BETWEEN 1 AND 100000000),
  ADD CONSTRAINT "income_tips_within_amount"   CHECK ("tips" IS NULL OR ("tips" >= 0 AND "tips" <= "amount")),
  ADD CONSTRAINT "income_hours_range"          CHECK ("hours" IS NULL OR ("hours" > 0 AND "hours" <= 24)),
  ADD CONSTRAINT "income_order_count_range"    CHECK ("order_count" IS NULL OR "order_count" BETWEEN 0 AND 1000),
  ADD CONSTRAINT "income_platform_not_blank"   CHECK ("platform" IS NULL OR length(btrim("platform")) > 0),
  ADD CONSTRAINT "income_note_not_blank"       CHECK ("note" IS NULL OR length(btrim("note")) > 0),
  ADD CONSTRAINT "income_note_length"          CHECK ("note" IS NULL OR length("note") <= 500);

-- expenses ------------------------------------------------------------
ALTER TABLE "expenses"
  ADD CONSTRAINT "expense_amount_range"        CHECK ("amount" BETWEEN 1 AND 100000000),
  ADD CONSTRAINT "expense_note_not_blank"      CHECK ("note" IS NULL OR length(btrim("note")) > 0),
  ADD CONSTRAINT "expense_note_length"         CHECK ("note" IS NULL OR length("note") <= 500);

-- pots ----------------------------------------------------------------
ALTER TABLE "pots"
  ADD CONSTRAINT "pot_name_not_blank"          CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "pot_icon_not_blank"          CHECK ("icon" IS NULL OR length(btrim("icon")) > 0),
  ADD CONSTRAINT "pot_target_range"            CHECK ("target_amount" BETWEEN 1 AND 100000000),
  ADD CONSTRAINT "pot_daily_range"             CHECK ("daily_amount" IS NULL OR "daily_amount" BETWEEN 1 AND 100000000),
  ADD CONSTRAINT "pot_repeat_range"            CHECK ("repeat_every" IS NULL OR "repeat_every" BETWEEN 1 AND 365),
  -- "every N units": both set or both empty
  ADD CONSTRAINT "pot_repeat_complete"         CHECK (("repeat_every" IS NULL) = ("repeat_unit" IS NULL)),
  -- a bill has a due date and gets its daily amount from it
  ADD CONSTRAINT "pot_bill_shape"              CHECK ("kind" <> 'bill' OR ("due_date" IS NOT NULL AND "daily_amount" IS NULL)),
  -- a goal never repeats, and needs a deadline or a chosen daily amount
  ADD CONSTRAINT "pot_goal_shape"              CHECK ("kind" <> 'goal' OR ("repeat_every" IS NULL AND ("due_date" IS NOT NULL OR "daily_amount" IS NOT NULL)));

-- pot_transfers -------------------------------------------------------
ALTER TABLE "pot_transfers"
  ADD CONSTRAINT "transfer_amount_not_zero"    CHECK ("amount" <> 0 AND abs("amount") <= 100000000),
  ADD CONSTRAINT "transfer_note_not_blank"     CHECK ("note" IS NULL OR length(btrim("note")) > 0);

-- A pot's balance (sum of its transfers) can never go below zero, and closed
-- (archived) pots can't receive money. A CHECK can't look at other rows, so
-- this is a trigger. It locks the pot row first, so two withdrawals at the
-- same moment are checked one after the other and can't both slip through.
CREATE FUNCTION "pot_transfer_rules"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  pot_archived timestamp;
  balance bigint;
BEGIN
  SELECT "archived_at" INTO pot_archived FROM "pots" WHERE "id" = NEW."pot_id" FOR UPDATE;

  IF pot_archived IS NOT NULL AND NEW."amount" > 0 THEN
    RAISE EXCEPTION 'pot % is closed', NEW."pot_id" USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO balance FROM "pot_transfers" WHERE "pot_id" = NEW."pot_id";
  IF balance < 0 THEN
    RAISE EXCEPTION 'pot % balance cannot go below zero', NEW."pot_id" USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "pot_transfer_rules"
  AFTER INSERT OR UPDATE ON "pot_transfers"
  FOR EACH ROW EXECUTE FUNCTION "pot_transfer_rules"();
