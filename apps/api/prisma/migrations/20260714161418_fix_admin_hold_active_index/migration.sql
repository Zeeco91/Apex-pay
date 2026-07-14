-- ADMIN_HOLD is now a reachable state (disputes, added in this phase) and must count as
-- "active" for the one-entry-per-user-per-level rule — otherwise a user with a disputed,
-- on-hold entry could join the same level again mid-dispute.
DROP INDEX "QueueEntry_userId_levelId_active_unique";

CREATE UNIQUE INDEX "QueueEntry_userId_levelId_active_unique" ON "QueueEntry"("userId", "levelId")
WHERE "status" IN ('PENDING_JOIN_PAYMENT', 'WAITING_FOR_PAYOUT', 'MATCHED_AS_PAYEE', 'ADMIN_HOLD');
