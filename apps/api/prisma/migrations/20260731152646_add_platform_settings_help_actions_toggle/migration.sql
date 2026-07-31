-- AlterEnum
ALTER TYPE "AdminActionType" ADD VALUE 'HELP_ACTIONS_TOGGLED';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "helpActionsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "helpActionsToggledAt" TIMESTAMP(3),
ADD COLUMN     "helpActionsToggledByAdminId" TEXT;
