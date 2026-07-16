-- CreateEnum
CREATE TYPE "FeePoolType" AS ENUM ('REFERRAL', 'LEVEL_INCENTIVE');

-- CreateEnum
CREATE TYPE "ReferralBonusStatus" AS ENUM ('HOLD', 'ELIGIBLE_FOR_WITHDRAWAL', 'WITHDRAWN', 'FORFEITED');

-- CreateEnum
CREATE TYPE "LevelIncentiveBonusStatus" AS ENUM ('PAID_IN_FULL', 'PARTIALLY_PAID', 'SKIPPED_INSUFFICIENT_POOL');

-- CreateEnum
CREATE TYPE "WithdrawalType" AS ENUM ('REFERRAL_BONUS');

-- CreateEnum
CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "FeePool" (
    "id" TEXT NOT NULL,
    "poolType" "FeePoolType" NOT NULL,
    "currentBalance" INTEGER NOT NULL DEFAULT 0,
    "totalAllocatedLifetime" INTEGER NOT NULL DEFAULT 0,
    "totalPaidLifetime" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralBonus" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "triggerTransactionId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "grossFeeAmount" INTEGER NOT NULL,
    "bonusAmount" INTEGER NOT NULL,
    "status" "ReferralBonusStatus" NOT NULL DEFAULT 'HOLD',
    "holdStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holdReleaseAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "forfeitedAt" TIMESTAMP(3),
    "forfeitedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelIncentiveBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "triggerTransactionId" TEXT NOT NULL,
    "entitlementAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "status" "LevelIncentiveBonusStatus" NOT NULL,
    "poolBalanceBefore" INTEGER NOT NULL,
    "poolBalanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelIncentiveBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "WithdrawalType" NOT NULL DEFAULT 'REFERRAL_BONUS',
    "referralBonusId" TEXT NOT NULL,
    "bankDetailsSnapshot" JSONB NOT NULL,
    "status" "WithdrawalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeePool_poolType_key" ON "FeePool"("poolType");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_key" ON "PublicHoliday"("date");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralBonus_referredUserId_key" ON "ReferralBonus"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralBonus_referrerUserId_status_idx" ON "ReferralBonus"("referrerUserId", "status");

-- CreateIndex
CREATE INDEX "ReferralBonus_status_holdReleaseAt_idx" ON "ReferralBonus"("status", "holdReleaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "LevelIncentiveBonus_triggerTransactionId_key" ON "LevelIncentiveBonus"("triggerTransactionId");

-- CreateIndex
CREATE INDEX "LevelIncentiveBonus_userId_idx" ON "LevelIncentiveBonus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_referralBonusId_key" ON "WithdrawalRequest"("referralBonusId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_idx" ON "WithdrawalRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_triggerTransactionId_fkey" FOREIGN KEY ("triggerTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralBonus" ADD CONSTRAINT "ReferralBonus_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelIncentiveBonus" ADD CONSTRAINT "LevelIncentiveBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelIncentiveBonus" ADD CONSTRAINT "LevelIncentiveBonus_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelIncentiveBonus" ADD CONSTRAINT "LevelIncentiveBonus_triggerTransactionId_fkey" FOREIGN KEY ("triggerTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_referralBonusId_fkey" FOREIGN KEY ("referralBonusId") REFERENCES "ReferralBonus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
