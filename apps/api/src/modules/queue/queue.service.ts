import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Level,
  type QueueEntryStatus,
  type TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EXTENDED_TX_OPTIONS } from '../../common/prisma/transaction-options.util';
import { AuditLogService } from '../../common/audit-log/audit-log.service';

const ACTIVE_QUEUE_ENTRY_STATUSES: QueueEntryStatus[] = [
  'PENDING_JOIN_PAYMENT',
  'WAITING_FOR_PAYOUT',
  'MATCHED_AS_PAYEE',
  'ADMIN_HOLD',
];

const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';

export interface QueueEntrySummary {
  id: string;
  levelId: string;
  levelName: string;
  contributionAmount: number;
  status: QueueEntryStatus;
  queueSequence: number;
  joinedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
  payersRequired: number;
  payersConfirmedCount: number;
}

export interface JoinQueueResult {
  matched: boolean;
  entry: QueueEntrySummary;
}

export interface QueueStats {
  levelId: string;
  levelName: string;
  contributionAmount: number;
  queueLive: true;
  waitingCount: number;
  yourEntry: {
    id: string;
    status: QueueEntryStatus;
    position: number | null;
  } | null;
  message: string;
}

export interface AdminQueueEntryView {
  id: string;
  userId: string;
  userFullName: string;
  userPhone: string;
  status: QueueEntryStatus;
  queueSequence: number;
  // How long this entry has actually been waiting for its CURRENT match — this, not
  // queueSequence, is what FIFO matching orders by (see joinQueue).
  waitingSince: Date;
  joinedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
  payersRequired: number;
  payersConfirmedCount: number;
}

const MANUAL_MATCH_ELIGIBLE_STATUSES: QueueEntryStatus[] = [
  'WAITING_FOR_PAYOUT',
];

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async joinQueue(userId: string, levelId: string): Promise<JoinQueueResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [level, joiningUser, platformSettings] = await Promise.all([
          tx.level.findUnique({ where: { id: levelId } }),
          tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { isTestAccount: true },
          }),
          tx.platformSettings.findUnique({ where: { id: 1 } }),
        ]);
        if (!level || !level.isActive) {
          throw new NotFoundException('Level not found');
        }
        // Admin can pause automatic FIFO matching platform-wide (see setAutoMatchEnabled) to do
        // manual matches without new joins auto-matching out from under them — missing row
        // defaults to enabled, so the feature works before the singleton row is ever written.
        const autoMatchEnabled = platformSettings?.autoMatchEnabled ?? true;

        // Members can only be in one level's payout queue at a time — checked across ALL
        // levels, not just this one, so joining Gold while already waiting in Bronze is
        // rejected the same as double-joining Bronze itself.
        const existing = await tx.queueEntry.findFirst({
          where: {
            userId,
            status: { in: ACTIVE_QUEUE_ENTRY_STATUSES },
          },
          include: { level: true },
        });
        if (existing) {
          throw new ConflictException(
            `You already have an active entry in ${existing.level.name} — finish or cancel it before joining another level.`,
          );
        }

        // Lock the entry that's been waiting longest for ITS CURRENT match — waitingSince, not
        // queueSequence, since an entry needing a second payer re-enters WAITING_FOR_PAYOUT
        // keeping its original (low) queueSequence, which would otherwise let it wrongly cut
        // ahead of entries still waiting for their very first match. SKIP LOCKED lets a second
        // concurrent joiner fall through to the next-oldest entry (or "no match") instead of
        // blocking on this one. Test accounts (internal/QA click-through accounts) only ever
        // match other test accounts — never a real member, in either direction — enforced by
        // requiring the candidate's isTestAccount to equal the joining user's. Skipped entirely
        // while auto-match is paused — the new entry just joins WAITING_FOR_PAYOUT below for
        // admin to pair manually.
        const locked = autoMatchEnabled
          ? await tx.$queryRaw<{ id: string; userId: string }[]>(Prisma.sql`
              SELECT qe."id", qe."userId" FROM "QueueEntry" qe
              JOIN "User" u ON u."id" = qe."userId"
              WHERE qe."levelId" = ${levelId} AND qe."status" = 'WAITING_FOR_PAYOUT' AND qe."userId" != ${userId}
                AND u."isTestAccount" = ${joiningUser.isTestAccount}
              ORDER BY qe."waitingSince" ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            `)
          : [];
        const matchedEntry = locked[0] ?? null;

        const newEntry = await tx.queueEntry.create({
          data: {
            userId,
            levelId,
            status: matchedEntry
              ? 'PENDING_JOIN_PAYMENT'
              : 'WAITING_FOR_PAYOUT',
          },
        });

        if (!matchedEntry) {
          // Brand new entry, just created — provably has no transaction history yet.
          return {
            matched: false,
            entry: toSummary(newEntry, level, null, null),
          };
        }

        // Direct peer-to-peer payment: the payer pays the payee's full contribution amount
        // directly, no platform pot in the middle and no fee taken for now.
        const principalAmount = level.contributionAmount;
        const platformFeeAmount = 0;
        const payeeDisbursedAmount = principalAmount;

        const transaction = await tx.transaction.create({
          data: {
            levelId,
            payerQueueEntryId: newEntry.id,
            payeeQueueEntryId: matchedEntry.id,
            payerUserId: userId,
            payeeUserId: matchedEntry.userId,
            principalAmount,
            platformFeeAmount,
            payeeDisbursedAmount,
            matchType: 'AUTOMATIC_FIFO',
            status: 'AWAITING_PAYER_PROOF',
          },
        });

        const updatedEntry = await tx.queueEntry.update({
          where: { id: newEntry.id },
          data: { outgoingTransactionId: transaction.id },
        });

        await tx.queueEntry.update({
          where: { id: matchedEntry.id },
          data: {
            status: 'MATCHED_AS_PAYEE',
            incomingTransactionId: transaction.id,
          },
        });

        return {
          matched: true,
          entry: toSummary(
            updatedEntry,
            level,
            transaction.id,
            transaction.status,
          ),
        };
      }, EXTENDED_TX_OPTIONS);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE
      ) {
        throw new ConflictException(
          'You already have an active queue entry — finish or cancel it before joining another level.',
        );
      }
      throw error;
    }
  }

  async cancelEntry(
    userId: string,
    entryId: string,
  ): Promise<QueueEntrySummary> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({
        where: { id: entryId },
        include: { level: true },
      });
      if (!entry || entry.userId !== userId) {
        throw new NotFoundException('Queue entry not found');
      }

      if (entry.status === 'WAITING_FOR_PAYOUT') {
        const cancelled = await tx.queueEntry.update({
          where: { id: entry.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        // This entry may carry prior transaction history (matched, then unmatched, before
        // landing back at WAITING_FOR_PAYOUT) — look up the true most-recent one rather than
        // guessing from the denormalized pointers.
        const latest = await this.latestTransactionForEntry(tx, entry.id);
        return toSummary(
          cancelled,
          entry.level,
          latest?.id ?? null,
          latest?.status ?? null,
        );
      }

      if (entry.status === 'PENDING_JOIN_PAYMENT') {
        const transaction = entry.outgoingTransactionId
          ? await tx.transaction.findUnique({
              where: { id: entry.outgoingTransactionId },
            })
          : null;

        if (!transaction || transaction.status !== 'AWAITING_PAYER_PROOF') {
          throw new ConflictException(
            "Can't cancel — proof of payment has already been submitted for this entry.",
          );
        }

        const cancelled = await tx.queueEntry.update({
          where: { id: entry.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'CANCELLED' },
        });

        // The payee did nothing wrong — restore them to WAITING_FOR_PAYOUT rather than the
        // back of the line. waitingSince is deliberately left untouched (their wait was only
        // ever interrupted, not restarted) so they don't lose their place to someone who's
        // joined more recently. incomingTransactionId is left pointing at the cancelled
        // transaction as a historical record; it'll be overwritten the next time this entry
        // gets matched.
        await tx.queueEntry.update({
          where: { id: transaction.payeeQueueEntryId },
          data: { status: 'WAITING_FOR_PAYOUT' },
        });

        return toSummary(cancelled, entry.level, transaction.id, 'CANCELLED');
      }

      throw new ConflictException(describeUncancellable(entry.status));
    });
  }

  async listForUser(userId: string): Promise<QueueEntrySummary[]> {
    const entries = await this.prisma.queueEntry.findMany({
      where: { userId },
      include: { level: true },
      orderBy: { joinedAt: 'desc' },
    });
    const latestById = await this.latestTransactionsForEntries(
      this.prisma,
      entries.map((entry) => entry.id),
    );
    return entries.map((entry) => {
      const latest = latestById.get(entry.id);
      return toSummary(
        entry,
        entry.level,
        latest?.id ?? null,
        latest?.status ?? null,
      );
    });
  }

  async getById(userId: string, entryId: string): Promise<QueueEntrySummary> {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: { level: true },
    });
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Queue entry not found');
    }
    const latest = await this.latestTransactionForEntry(this.prisma, entry.id);
    return toSummary(
      entry,
      entry.level,
      latest?.id ?? null,
      latest?.status ?? null,
    );
  }

  private async latestTransactionForEntry(
    client: PrismaService | Prisma.TransactionClient,
    entryId: string,
  ): Promise<{ id: string; status: TransactionStatus } | null> {
    const map = await this.latestTransactionsForEntries(client, [entryId]);
    return map.get(entryId) ?? null;
  }

  /**
   * A QueueEntry can accumulate more than one Transaction over its lifetime (matched, unmatched
   * by a payer cancellation, matched again as either payer or payee) — the entry's own
   * outgoing/incomingTransactionId pointers aren't reliable for finding "the current one" once
   * an entry has been both a payer and a payee at different points, since both fields end up
   * set and a naive fallback picks whichever was written first rather than most recently. This
   * looks up every Transaction where the entry appears in either role and keeps the newest.
   */
  private async latestTransactionsForEntries(
    client: PrismaService | Prisma.TransactionClient,
    entryIds: string[],
  ): Promise<Map<string, { id: string; status: TransactionStatus }>> {
    if (entryIds.length === 0) return new Map();

    const transactions = await client.transaction.findMany({
      where: {
        OR: [
          { payerQueueEntryId: { in: entryIds } },
          { payeeQueueEntryId: { in: entryIds } },
        ],
      },
      select: {
        id: true,
        status: true,
        payerQueueEntryId: true,
        payeeQueueEntryId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Ascending order means each overwrite is more recent than the last, so the final value
    // per entryId after the loop is the most recent transaction for that entry.
    const latestByEntryId = new Map<
      string,
      { id: string; status: TransactionStatus }
    >();
    for (const txn of transactions) {
      const value = { id: txn.id, status: txn.status };
      latestByEntryId.set(txn.payerQueueEntryId, value);
      latestByEntryId.set(txn.payeeQueueEntryId, value);
    }
    return latestByEntryId;
  }

  async getQueueStats(userId: string, levelId: string): Promise<QueueStats> {
    const [level, requestingUser] = await Promise.all([
      this.prisma.level.findUnique({ where: { id: levelId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { isTestAccount: true },
      }),
    ]);
    if (!level || !level.isActive) {
      throw new NotFoundException('Level not found');
    }

    // Test accounts and real members are separate matching pools (see joinQueue) — counted
    // separately here too, so a real member's "position in line" isn't skewed by test accounts
    // they'll never actually be matched with.
    const [waitingCount, yourEntry] = await Promise.all([
      this.prisma.queueEntry.count({
        where: {
          levelId,
          status: 'WAITING_FOR_PAYOUT',
          user: { isTestAccount: requestingUser.isTestAccount },
        },
      }),
      this.prisma.queueEntry.findFirst({
        where: { userId, levelId, status: { in: ACTIVE_QUEUE_ENTRY_STATUSES } },
      }),
    ]);

    let position: number | null = null;
    if (yourEntry && yourEntry.status === 'WAITING_FOR_PAYOUT') {
      position =
        (await this.prisma.queueEntry.count({
          where: {
            levelId,
            status: 'WAITING_FOR_PAYOUT',
            waitingSince: { lt: yourEntry.waitingSince },
            user: { isTestAccount: requestingUser.isTestAccount },
          },
        })) + 1;
    }

    return {
      levelId: level.id,
      levelName: level.name,
      contributionAmount: level.contributionAmount,
      queueLive: true,
      waitingCount,
      yourEntry: yourEntry
        ? { id: yourEntry.id, status: yourEntry.status, position }
        : null,
      message: buildQueueStatsMessage(
        waitingCount,
        yourEntry?.status ?? null,
        position,
        yourEntry?.payersConfirmedCount ?? 0,
        yourEntry?.payersRequired ?? 2,
      ),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  /**
   * Platform-wide switch checked by joinQueue on every new join. Missing row (nobody has ever
   * toggled it) defaults to enabled, matching the schema default and normal pre-feature behavior.
   */
  async getAutoMatchEnabled(): Promise<boolean> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
    });
    return settings?.autoMatchEnabled ?? true;
  }

  /**
   * Lets admin pause automatic FIFO matching platform-wide to do manual matches without new
   * joins auto-matching out from under them, then resume it — upserts the singleton row since
   * it may not exist yet the first time anyone toggles this.
   */
  async setAutoMatchEnabled(
    adminId: string,
    enabled: boolean,
    reason?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.platformSettings.findUnique({
        where: { id: 1 },
      });

      await tx.platformSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          autoMatchEnabled: enabled,
          autoMatchToggledAt: new Date(),
          autoMatchToggledByAdminId: adminId,
        },
        update: {
          autoMatchEnabled: enabled,
          autoMatchToggledAt: new Date(),
          autoMatchToggledByAdminId: adminId,
        },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'AUTO_MATCH_TOGGLED',
          targetEntityType: 'PlatformSettings',
          targetEntityId: 'singleton',
          reason:
            reason?.trim() ||
            (enabled
              ? 'Resumed automatic matching'
              : 'Paused automatic matching'),
          beforeState: { autoMatchEnabled: before?.autoMatchEnabled ?? true },
          afterState: { autoMatchEnabled: enabled },
        },
        tx,
      );

      return enabled;
    });
  }

  async listForAdminByLevel(levelId: string): Promise<AdminQueueEntryView[]> {
    const entries = await this.prisma.queueEntry.findMany({
      where: { levelId },
      include: { user: true },
      orderBy: { queueSequence: 'asc' },
    });
    const latestById = await this.latestTransactionsForEntries(
      this.prisma,
      entries.map((entry) => entry.id),
    );
    return entries.map((entry) => {
      const latest = latestById.get(entry.id);
      return {
        id: entry.id,
        userId: entry.userId,
        userFullName: entry.user.fullName,
        userPhone: entry.user.phone,
        status: entry.status,
        queueSequence: entry.queueSequence,
        waitingSince: entry.waitingSince,
        joinedAt: entry.joinedAt,
        completedAt: entry.completedAt,
        cancelledAt: entry.cancelledAt,
        transactionId: latest?.id ?? null,
        transactionStatus: latest?.status ?? null,
        payersRequired: entry.payersRequired,
        payersConfirmedCount: entry.payersConfirmedCount,
      };
    });
  }

  /**
   * Force-pairs two entries that are both already WAITING_FOR_PAYOUT in the same level —
   * e.g. to unstick a level where automatic FIFO matching hasn't produced a pair for some
   * anomalous reason. Mirrors joinQueue's matched branch but both entries pre-exist and neither
   * is "new". matchType is MANUAL_ADMIN so it's distinguishable from automatic matches later.
   */
  async manualMatch(
    adminId: string,
    levelId: string,
    payerEntryId: string,
    payeeEntryId: string,
    reason: string,
  ): Promise<{ payerEntry: QueueEntrySummary; payeeEntry: QueueEntrySummary }> {
    if (payerEntryId === payeeEntryId) {
      throw new ConflictException(
        'Choose two different queue entries to match.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock both rows — in a fixed, sorted order so two concurrent manual matches over
      // overlapping entries can't deadlock each other — before reading them. This is what
      // stops a concurrent automatic FIFO match (joinQueue's SELECT ... FOR UPDATE SKIP
      // LOCKED) from grabbing either entry out from under this one: SKIP LOCKED just skips
      // past a row already locked here rather than racing it.
      const [firstId, secondId] = [payerEntryId, payeeEntryId].sort();
      await tx.$executeRaw`SELECT "id" FROM "QueueEntry" WHERE "id" IN (${firstId}, ${secondId}) FOR UPDATE`;

      const [payerEntry, payeeEntry] = await Promise.all([
        tx.queueEntry.findUnique({
          where: { id: payerEntryId },
          include: { level: true },
        }),
        tx.queueEntry.findUnique({
          where: { id: payeeEntryId },
          include: { level: true },
        }),
      ]);
      if (!payerEntry || !payeeEntry) {
        throw new NotFoundException('Queue entry not found');
      }
      if (payerEntry.levelId !== levelId || payeeEntry.levelId !== levelId) {
        throw new ConflictException('Both entries must belong to this level.');
      }
      if (payerEntry.userId === payeeEntry.userId) {
        throw new ConflictException(
          "A member can't be matched with themselves.",
        );
      }
      if (
        !MANUAL_MATCH_ELIGIBLE_STATUSES.includes(payerEntry.status) ||
        !MANUAL_MATCH_ELIGIBLE_STATUSES.includes(payeeEntry.status)
      ) {
        throw new ConflictException(
          'Both entries must currently be waiting for a payout to be manually matched.',
        );
      }

      const level = payerEntry.level;
      // Direct peer-to-peer payment: the payer pays the payee's full contribution amount
      // directly, no platform pot in the middle and no fee taken for now.
      const principalAmount = level.contributionAmount;
      const platformFeeAmount = 0;
      const payeeDisbursedAmount = principalAmount;

      const transaction = await tx.transaction.create({
        data: {
          levelId: level.id,
          payerQueueEntryId: payerEntry.id,
          payeeQueueEntryId: payeeEntry.id,
          payerUserId: payerEntry.userId,
          payeeUserId: payeeEntry.userId,
          principalAmount,
          platformFeeAmount,
          payeeDisbursedAmount,
          matchType: 'MANUAL_ADMIN',
          status: 'AWAITING_PAYER_PROOF',
        },
      });

      const updatedPayerEntry = await tx.queueEntry.update({
        where: { id: payerEntry.id },
        data: {
          status: 'PENDING_JOIN_PAYMENT',
          outgoingTransactionId: transaction.id,
        },
      });
      const updatedPayeeEntry = await tx.queueEntry.update({
        where: { id: payeeEntry.id },
        data: {
          status: 'MATCHED_AS_PAYEE',
          incomingTransactionId: transaction.id,
        },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'QUEUE_MANUAL_MATCH',
          targetEntityType: 'Transaction',
          targetEntityId: transaction.id,
          reason,
          beforeState: {
            payerEntryStatus: payerEntry.status,
            payeeEntryStatus: payeeEntry.status,
          },
          afterState: {
            payerEntryStatus: updatedPayerEntry.status,
            payeeEntryStatus: updatedPayeeEntry.status,
            transactionId: transaction.id,
          },
        },
        tx,
      );

      return {
        payerEntry: toSummary(
          updatedPayerEntry,
          level,
          transaction.id,
          transaction.status,
        ),
        payeeEntry: toSummary(
          updatedPayeeEntry,
          level,
          transaction.id,
          transaction.status,
        ),
      };
    }, EXTENDED_TX_OPTIONS);
  }

  /**
   * Admin override to void a live match (or pull an unmatched entry) so both parties are free
   * to be manually re-matched right away — unlike the member-facing cancelEntry, this works
   * regardless of whose entry it is and even after proof has been submitted. Mirrors
   * resolveDispute's REJECTED branch: the transaction is voided and both sides return to
   * WAITING_FOR_PAYOUT rather than being removed from the queue, so admin can immediately pair
   * them with someone else from the same Queues screen.
   */
  async adminCancelEntry(
    adminId: string,
    entryId: string,
    reason: string,
  ): Promise<QueueEntrySummary> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({
        where: { id: entryId },
        include: { level: true },
      });
      if (!entry) throw new NotFoundException('Queue entry not found');

      if (entry.status === 'WAITING_FOR_PAYOUT') {
        const cancelled = await tx.queueEntry.update({
          where: { id: entry.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await this.auditLog.record(
          {
            adminUserId: adminId,
            actionType: 'QUEUE_MATCH_CANCELLED',
            targetEntityType: 'QueueEntry',
            targetEntityId: entry.id,
            reason,
            beforeState: { status: entry.status },
            afterState: { status: cancelled.status },
          },
          tx,
        );
        return toSummary(cancelled, entry.level, null, null);
      }

      if (
        entry.status !== 'PENDING_JOIN_PAYMENT' &&
        entry.status !== 'MATCHED_AS_PAYEE'
      ) {
        throw new ConflictException(
          `Can't cancel — this entry is ${describeStatusForAdmin(entry.status)}.`,
        );
      }

      const transactionId =
        entry.status === 'PENDING_JOIN_PAYMENT'
          ? entry.outgoingTransactionId
          : entry.incomingTransactionId;
      const transaction = transactionId
        ? await tx.transaction.findUnique({ where: { id: transactionId } })
        : null;
      if (!transaction) {
        throw new ConflictException(
          'No active transaction found for this entry.',
        );
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'CANCELLED' },
      });
      await tx.queueEntry.updateMany({
        where: {
          id: {
            in: [transaction.payerQueueEntryId, transaction.payeeQueueEntryId],
          },
        },
        data: { status: 'WAITING_FOR_PAYOUT', waitingSince: new Date() },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'QUEUE_MATCH_CANCELLED',
          targetEntityType: 'Transaction',
          targetEntityId: transaction.id,
          reason,
          beforeState: {
            status: entry.status,
            transactionStatus: transaction.status,
          },
          afterState: {
            status: 'WAITING_FOR_PAYOUT',
            transactionStatus: 'CANCELLED',
          },
        },
        tx,
      );

      const updatedEntry = await tx.queueEntry.findUniqueOrThrow({
        where: { id: entry.id },
      });
      return toSummary(updatedEntry, entry.level, null, null);
    }, EXTENDED_TX_OPTIONS);
  }

  async holdEntry(
    adminId: string,
    entryId: string,
    reason: string,
  ): Promise<QueueEntrySummary> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({
        where: { id: entryId },
        include: { level: true },
      });
      if (!entry) throw new NotFoundException('Queue entry not found');
      if (
        !ACTIVE_QUEUE_ENTRY_STATUSES.includes(entry.status) ||
        entry.status === 'ADMIN_HOLD'
      ) {
        throw new ConflictException(
          `Can't hold — this entry is ${describeStatusForAdmin(entry.status)}.`,
        );
      }

      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: 'ADMIN_HOLD' },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'QUEUE_ENTRY_HELD',
          targetEntityType: 'QueueEntry',
          targetEntityId: entryId,
          reason,
          beforeState: { status: entry.status },
          afterState: { status: updated.status },
        },
        tx,
      );

      const latest = await this.latestTransactionForEntry(tx, entryId);
      return toSummary(
        updated,
        entry.level,
        latest?.id ?? null,
        latest?.status ?? null,
      );
    });
  }

  async releaseEntry(
    adminId: string,
    entryId: string,
    reason?: string,
  ): Promise<QueueEntrySummary> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({
        where: { id: entryId },
        include: { level: true },
      });
      if (!entry) throw new NotFoundException('Queue entry not found');
      if (entry.status !== 'ADMIN_HOLD') {
        throw new ConflictException('This entry is not currently on hold.');
      }

      const updated = await tx.queueEntry.update({
        where: { id: entryId },
        data: { status: 'WAITING_FOR_PAYOUT' },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'QUEUE_ENTRY_RELEASED',
          targetEntityType: 'QueueEntry',
          targetEntityId: entryId,
          reason: reason ?? 'No reason provided',
          beforeState: { status: entry.status },
          afterState: { status: updated.status },
        },
        tx,
      );

      const latest = await this.latestTransactionForEntry(tx, entryId);
      return toSummary(
        updated,
        entry.level,
        latest?.id ?? null,
        latest?.status ?? null,
      );
    });
  }
}

function toSummary(
  entry: {
    id: string;
    levelId: string;
    status: QueueEntryStatus;
    queueSequence: number;
    joinedAt: Date;
    completedAt: Date | null;
    cancelledAt: Date | null;
    payersRequired: number;
    payersConfirmedCount: number;
  },
  level: Pick<Level, 'name' | 'contributionAmount'>,
  transactionId: string | null,
  transactionStatus: TransactionStatus | null,
): QueueEntrySummary {
  return {
    id: entry.id,
    levelId: entry.levelId,
    levelName: level.name,
    contributionAmount: level.contributionAmount,
    status: entry.status,
    queueSequence: entry.queueSequence,
    joinedAt: entry.joinedAt,
    completedAt: entry.completedAt,
    cancelledAt: entry.cancelledAt,
    transactionId,
    transactionStatus,
    payersRequired: entry.payersRequired,
    payersConfirmedCount: entry.payersConfirmedCount,
  };
}

function describeStatusForAdmin(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

function describeUncancellable(status: QueueEntryStatus): string {
  switch (status) {
    case 'MATCHED_AS_PAYEE':
      return "You're currently matched to receive a payout and can't cancel from here — contact support if you need help.";
    case 'ADMIN_HOLD':
      return 'This queue entry is on hold — contact support.';
    case 'COMPLETED':
      return 'This queue entry has already been completed.';
    case 'CANCELLED':
      return 'This queue entry has already been cancelled.';
    default:
      return "This queue entry can't be cancelled right now.";
  }
}

function buildQueueStatsMessage(
  waitingCount: number,
  entryStatus: QueueEntryStatus | null,
  position: number | null,
  payersConfirmedCount: number,
  payersRequired: number,
): string {
  const memberWord = waitingCount === 1 ? 'member' : 'members';

  if (entryStatus === 'WAITING_FOR_PAYOUT' && position !== null) {
    if (payersConfirmedCount > 0) {
      return `You've received ${payersConfirmedCount} of ${payersRequired} payments for this payout. You're #${position} in line for your next match. ${waitingCount} ${memberWord} waiting in this level right now.`;
    }
    return `You're #${position} in line. ${waitingCount} ${memberWord} waiting in this level right now.`;
  }
  if (entryStatus === 'PENDING_JOIN_PAYMENT') {
    return "You've been matched with a member ahead of you — complete your contribution to keep your place.";
  }
  if (entryStatus === 'MATCHED_AS_PAYEE') {
    return `You're matched to receive payment ${payersConfirmedCount + 1} of ${payersRequired} once it's confirmed.`;
  }
  if (waitingCount === 0) {
    return "No one is waiting yet in this level — you'd be the first in the queue.";
  }
  return `${waitingCount} ${memberWord} currently waiting for a payout in this level.`;
}
