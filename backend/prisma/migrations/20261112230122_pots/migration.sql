-- CreateEnum
CREATE TYPE "PotKind" AS ENUM ('bill', 'goal');

-- CreateEnum
CREATE TYPE "RepeatUnit" AS ENUM ('day', 'week', 'month', 'year');

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'bills';

-- CreateTable
CREATE TABLE "pots" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "PotKind" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "icon" VARCHAR(16),
    "target_amount" INTEGER NOT NULL,
    "due_date" DATE,
    "repeat_every" INTEGER,
    "repeat_unit" "RepeatUnit",
    "daily_amount" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pot_transfers" (
    "id" UUID NOT NULL,
    "pot_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pot_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pots_user_id_archived_at_idx" ON "pots"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "pot_transfers_pot_id_idx" ON "pot_transfers"("pot_id");

-- CreateIndex
CREATE INDEX "pot_transfers_user_id_date_idx" ON "pot_transfers"("user_id", "date");

-- AddForeignKey
ALTER TABLE "pots" ADD CONSTRAINT "pots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pot_transfers" ADD CONSTRAINT "pot_transfers_pot_id_fkey" FOREIGN KEY ("pot_id") REFERENCES "pots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pot_transfers" ADD CONSTRAINT "pot_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
