-- Backend-issued staff login credentials (salon-scoped accounts)
ALTER TABLE "staff" ADD COLUMN "username" TEXT;
ALTER TABLE "staff" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");
