-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('PENDING_JOIN_PAYMENT', 'WAITING_FOR_PAYOUT', 'MATCHED_AS_PAYEE', 'COMPLETED', 'CANCELLED', 'ADMIN_HOLD');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('AWAITING_PAYER_PROOF', 'PROOF_SUBMITTED', 'PRINCIPAL_RECEIVED', 'PENDING_DISBURSEMENT', 'DISBURSED', 'CONFIRMED', 'DISPUTED', 'ADMIN_RESOLVED_CONFIRMED', 'ADMIN_RESOLVED_REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('AUTOMATIC_FIFO', 'MANUAL_ADMIN');

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "queueSequence" SERIAL NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING_FOR_PAYOUT',
    "outgoingTransactionId" TEXT,
    "incomingTransactionId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutDueEstimateAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "payerQueueEntryId" TEXT NOT NULL,
    "payeeQueueEntryId" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "payeeUserId" TEXT NOT NULL,
    "principalAmount" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "payeeDisbursedAmount" INTEGER NOT NULL,
    "matchType" "MatchType" NOT NULL DEFAULT 'AUTOMATIC_FIFO',
    "status" "TransactionStatus" NOT NULL DEFAULT 'AWAITING_PAYER_PROOF',
    "payerProofImageKey" TEXT,
    "payerProofUploadedAt" TIMESTAMP(3),
    "principalReceivedAt" TIMESTAMP(3),
    "principalConfirmedByAdminId" TEXT,
    "payeeBankDetailsSnapshot" JSONB,
    "disbursedAt" TIMESTAMP(3),
    "disbursedByAdminId" TEXT,
    "disbursementReference" TEXT,
    "disbursementProofKey" TEXT,
    "payeeConfirmedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeRaisedByUserId" TEXT,
    "disputeRaisedAt" TIMESTAMP(3),
    "adminResolutionNotes" TEXT,
    "adminResolvedByAdminId" TEXT,
    "adminResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueEntry_levelId_status_queueSequence_idx" ON "QueueEntry"("levelId", "status", "queueSequence");

-- CreateIndex
CREATE INDEX "QueueEntry_userId_idx" ON "QueueEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_payerQueueEntryId_key" ON "Transaction"("payerQueueEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_payeeQueueEntryId_key" ON "Transaction"("payeeQueueEntryId");

-- CreateIndex
CREATE INDEX "Transaction_levelId_status_idx" ON "Transaction"("levelId", "status");

-- CreateIndex
CREATE INDEX "Transaction_payerUserId_idx" ON "Transaction"("payerUserId");

-- CreateIndex
CREATE INDEX "Transaction_payeeUserId_idx" ON "Transaction"("payeeUserId");

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payerQueueEntryId_fkey" FOREIGN KEY ("payerQueueEntryId") REFERENCES "QueueEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payeeQueueEntryId_fkey" FOREIGN KEY ("payeeQueueEntryId") REFERENCES "QueueEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payeeUserId_fkey" FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: a user may have at most one non-terminal QueueEntry per level.
-- This is the DB-level backstop for the matching engine's "no existing active entry" check —
-- a double-submit race (double-click, retried request) hits this constraint instead of
-- creating two active entries for the same user in the same level.
CREATE UNIQUE INDEX "QueueEntry_userId_levelId_active_unique" ON "QueueEntry"("userId", "levelId")
WHERE "status" IN ('PENDING_JOIN_PAYMENT', 'WAITING_FOR_PAYOUT', 'MATCHED_AS_PAYEE');
