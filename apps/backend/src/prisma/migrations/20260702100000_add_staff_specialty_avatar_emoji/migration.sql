-- Add client-facing staff profile fields used by the mobile apps
ALTER TABLE "staff" ADD COLUMN "specialty" TEXT;
ALTER TABLE "staff" ADD COLUMN "avatarEmoji" TEXT;
