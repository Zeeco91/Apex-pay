-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contributionAmount" INTEGER NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "referralPoolAllocationPercentOfFee" DOUBLE PRECISION NOT NULL,
    "incentivePoolAllocationPercentOfFee" DOUBLE PRECISION NOT NULL,
    "platformRevenuePercentOfFee" DOUBLE PRECISION NOT NULL,
    "incentiveBonusRateOfPrincipal" DOUBLE PRECISION NOT NULL,
    "stalledThresholdDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Level_sortOrder_key" ON "Level"("sortOrder");

-- CreateIndex
CREATE INDEX "Level_isActive_sortOrder_idx" ON "Level"("isActive", "sortOrder");
