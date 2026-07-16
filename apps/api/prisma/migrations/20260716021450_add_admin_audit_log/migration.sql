-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('USER_SUSPENDED', 'USER_BANNED', 'USER_REINSTATED', 'KYC_APPROVED', 'KYC_REJECTED', 'QUEUE_ENTRY_HELD', 'QUEUE_ENTRY_RELEASED', 'QUEUE_MANUAL_MATCH', 'LEVEL_UPDATED');

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetEntityType_targetEntityId_idx" ON "AdminAuditLog"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
