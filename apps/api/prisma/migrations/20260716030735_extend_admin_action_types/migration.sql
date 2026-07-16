-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminActionType" ADD VALUE 'TRANSACTION_PRINCIPAL_CONFIRMED';
ALTER TYPE "AdminActionType" ADD VALUE 'TRANSACTION_DISBURSED';
ALTER TYPE "AdminActionType" ADD VALUE 'TRANSACTION_DISPUTE_RESOLVED';
ALTER TYPE "AdminActionType" ADD VALUE 'WITHDRAWAL_APPROVED';
ALTER TYPE "AdminActionType" ADD VALUE 'WITHDRAWAL_REJECTED';
ALTER TYPE "AdminActionType" ADD VALUE 'WITHDRAWAL_PAID';
