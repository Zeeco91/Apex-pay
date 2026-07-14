-- CreateEnum
CREATE TYPE "TreasuryEntryType" AS ENUM ('PRINCIPAL_COLLECTED', 'DISBURSED', 'FEE_COLLECTED', 'FEE_ALLOCATED_REFERRAL_POOL', 'FEE_ALLOCATED_INCENTIVE_POOL', 'FEE_ALLOCATED_PLATFORM_REVENUE', 'REFERRAL_BONUS_PAID', 'LEVEL_INCENTIVE_BONUS_PAID', 'PLATFORM_REVENUE_WITHDRAWN');

-- CreateTable
CREATE TABLE "TreasuryLedgerEntry" (
    "id" TEXT NOT NULL,
    "entryType" "TreasuryEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "relatedTransactionId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryBalance" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TreasuryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryLedgerEntry_entryType_createdAt_idx" ON "TreasuryLedgerEntry"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryLedgerEntry_relatedTransactionId_idx" ON "TreasuryLedgerEntry"("relatedTransactionId");

-- AddForeignKey
ALTER TABLE "TreasuryLedgerEntry" ADD CONSTRAINT "TreasuryLedgerEntry_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
