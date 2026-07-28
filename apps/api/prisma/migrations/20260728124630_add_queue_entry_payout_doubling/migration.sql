-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "payersConfirmedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payersRequired" INTEGER NOT NULL DEFAULT 2;
