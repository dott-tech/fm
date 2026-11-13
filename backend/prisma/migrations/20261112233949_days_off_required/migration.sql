-- Prisma creates list columns as nullable; a NULL days_off would skip the
-- users_days_off_valid check. Expressed as a CHECK (not SET NOT NULL) so
-- Prisma's schema diff doesn't try to undo it.
UPDATE "users" SET "days_off" = ARRAY[]::INTEGER[] WHERE "days_off" IS NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_days_off_required" CHECK ("days_off" IS NOT NULL);
