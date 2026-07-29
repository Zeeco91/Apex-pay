-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "waitingSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: for existing rows, "joined" is a far better proxy for "waiting since" than "right
-- now" (which the column default would otherwise apply to every historical row). A follow-up
-- one-time script corrects the handful of entries currently WAITING_FOR_PAYOUT on a second (or
-- later) round, whose true wait started more recently than their original join.
UPDATE "QueueEntry" SET "waitingSince" = "joinedAt";
