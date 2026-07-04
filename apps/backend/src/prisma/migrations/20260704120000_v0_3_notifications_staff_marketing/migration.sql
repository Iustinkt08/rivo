-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "discountAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "email" TEXT,
ADD COLUMN     "publicSettings" JSONB,
ADD COLUMN     "socials" JSONB;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onAccepted" BOOLEAN NOT NULL DEFAULT true,
    "onRejected" BOOLEAN NOT NULL DEFAULT true,
    "onCancelled" BOOLEAN NOT NULL DEFAULT true,
    "onRescheduled" BOOLEAN NOT NULL DEFAULT true,
    "onPriceChange" BOOLEAN NOT NULL DEFAULT true,
    "onDurationChange" BOOLEAN NOT NULL DEFAULT true,
    "onReview" BOOLEAN NOT NULL DEFAULT true,
    "onReminder" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_photo_categories" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_photo_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_photos" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "categoryId" TEXT,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerClient" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_redemptions" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amountApplied" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_card_configs" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "requiredVisits" INTEGER NOT NULL,
    "rewardType" "DiscountType" NOT NULL,
    "rewardValue" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "punch_card_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_redemptions" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "amountApplied" DECIMAL(10,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punch_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "staff_photo_categories_staffId_idx" ON "staff_photo_categories"("staffId");

-- CreateIndex
CREATE INDEX "staff_photos_staffId_idx" ON "staff_photos"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_salonId_code_key" ON "discount_codes"("salonId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "discount_redemptions_appointmentId_key" ON "discount_redemptions"("appointmentId");

-- CreateIndex
CREATE INDEX "discount_redemptions_codeId_clientId_idx" ON "discount_redemptions"("codeId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "punch_card_configs_salonId_key" ON "punch_card_configs"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "punch_redemptions_appointmentId_key" ON "punch_redemptions"("appointmentId");

-- CreateIndex
CREATE INDEX "punch_redemptions_salonId_clientId_idx" ON "punch_redemptions"("salonId", "clientId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_photo_categories" ADD CONSTRAINT "staff_photo_categories_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "staff_photo_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_card_configs" ADD CONSTRAINT "punch_card_configs_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_redemptions" ADD CONSTRAINT "punch_redemptions_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_redemptions" ADD CONSTRAINT "punch_redemptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_redemptions" ADD CONSTRAINT "punch_redemptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense-in-depth: enable RLS on all new tables (matches the existing tables'
-- posture). The backend connects via a privileged role and is unaffected;
-- this blocks direct PostgREST access with the anon key.
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_photo_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "punch_card_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "punch_redemptions" ENABLE ROW LEVEL SECURITY;
