-- Members could previously hold an active QueueEntry in every level at once — the old
-- constraint only prevented duplicate entries within the SAME level. Tighten to one active
-- entry per user across ALL levels, so joining a level is only possible when the member has
-- no other active entry anywhere.
DROP INDEX "QueueEntry_userId_levelId_active_unique";

CREATE UNIQUE INDEX "QueueEntry_userId_active_unique" ON "QueueEntry"("userId")
WHERE "status" IN ('PENDING_JOIN_PAYMENT', 'WAITING_FOR_PAYOUT', 'MATCHED_AS_PAYEE', 'ADMIN_HOLD');
