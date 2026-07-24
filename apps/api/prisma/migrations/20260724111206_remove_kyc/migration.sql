-- Backfill: KYC is no longer a requirement, so anyone still gated on it becomes active.
UPDATE "User" SET status = 'ACTIVE' WHERE status = 'PENDING_KYC';

-- DropForeignKey
ALTER TABLE "KycRecord" DROP CONSTRAINT "KycRecord_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "kycStatus",
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "KycRecord";

-- DropEnum
DROP TYPE "KycStatus";
