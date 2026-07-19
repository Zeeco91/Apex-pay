-- CreateEnum
CREATE TYPE "ReconciliationTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treasuryBalanceExpected" INTEGER NOT NULL,
    "treasuryBalanceActual" INTEGER NOT NULL,
    "treasuryDrift" INTEGER NOT NULL,
    "referralPoolExpected" INTEGER NOT NULL,
    "referralPoolActual" INTEGER NOT NULL,
    "referralPoolDrift" INTEGER NOT NULL,
    "incentivePoolExpected" INTEGER NOT NULL,
    "incentivePoolActual" INTEGER NOT NULL,
    "incentivePoolDrift" INTEGER NOT NULL,
    "hasDiscrepancy" BOOLEAN NOT NULL,
    "triggeredBy" "ReconciliationTrigger" NOT NULL,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_runAt_idx" ON "ReconciliationRun"("runAt");
