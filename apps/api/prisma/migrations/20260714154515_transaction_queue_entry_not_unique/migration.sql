-- DropIndex
DROP INDEX "Transaction_payeeQueueEntryId_key";

-- DropIndex
DROP INDEX "Transaction_payerQueueEntryId_key";

-- CreateIndex
CREATE INDEX "Transaction_payerQueueEntryId_idx" ON "Transaction"("payerQueueEntryId");

-- CreateIndex
CREATE INDEX "Transaction_payeeQueueEntryId_idx" ON "Transaction"("payeeQueueEntryId");
