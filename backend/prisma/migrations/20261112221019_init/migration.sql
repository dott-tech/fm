-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cab_driver', 'delivery_rider');

-- CreateEnum
CREATE TYPE "IncomeSource" AS ENUM ('cab', 'delivery', 'freelance', 'other');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('fuel', 'oil_change', 'repairs', 'tyres', 'phone_data', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'cab_driver',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IQD',
    "weekly_target" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "hours" DECIMAL(4,2),
    "order_count" INTEGER,
    "tips" INTEGER,
    "platform" VARCHAR(50),
    "source" "IncomeSource" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "income_entries_user_id_date_idx" ON "income_entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "expenses_user_id_date_idx" ON "expenses"("user_id", "date");

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
