-- AlterEnum
ALTER TYPE "AdminActionType" ADD VALUE 'AUTO_MATCH_TOGGLED';

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "autoMatchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoMatchToggledAt" TIMESTAMP(3),
    "autoMatchToggledByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
