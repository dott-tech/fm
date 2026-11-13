-- AlterTable
ALTER TABLE "income_entries" ADD COLUMN     "platform_fee" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "days_off" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "day_skips" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_skips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_skips_user_id_date_key" ON "day_skips"("user_id", "date");

-- AddForeignKey
ALTER TABLE "day_skips" ADD CONSTRAINT "day_skips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules (see the db_rules migration for the pattern) --------------------
ALTER TABLE "income_entries"
  -- the platform's cut is part of the fare, never more than it
  ADD CONSTRAINT "income_platform_fee_range" CHECK ("platform_fee" IS NULL OR ("platform_fee" >= 0 AND "platform_fee" <= "amount"));

ALTER TABLE "users"
  -- weekday numbers 0..6 only, and at least one working day left
  ADD CONSTRAINT "users_days_off_valid" CHECK ("days_off" <@ ARRAY[0,1,2,3,4,5,6] AND cardinality("days_off") <= 6);
