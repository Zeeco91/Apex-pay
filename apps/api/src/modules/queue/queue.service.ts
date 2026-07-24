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
  joinedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
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
        const level = await tx.level.findUnique({ where: { id: levelId } });
        if (!level || !level.isActive) {
          throw new NotFoundException('Level not found');
        }

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

        // Lock the oldest waiting entry so two concurrent joins can never match the same
        // payee — SKIP LOCKED lets a second concurrent joiner fall through to the next oldest
        // entry (or "no match") instead of blocking on this one.
        const locked = await tx.$queryRaw<
          { id: string; userId: string }[]
        >(Prisma.sql`
          SELECT "id", "userId" FROM "QueueEntry"
          WHERE "levelId" = ${levelId} AND "status" = 'WAITING_FOR_PAYOUT' AND "userId" != ${userId}
          ORDER BY "queueSequence" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `);
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
        // back of the line. Their original queueSequence is untouched, so they keep their place.
        // incomingTransactionId is left pointing at the cancelled transaction as a historical
        // record; it'll be overwritten the next time this entry gets matched.
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
    const level = await this.prisma.level.findUnique({
      where: { id: levelId },
    });
    if (!level || !level.isActive) {
      throw new NotFoundException('Level not found');
    }

    const [waitingCount, yourEntry] = await Promise.all([
      this.prisma.queueEntry.count({
        where: { levelId, status: 'WAITING_FOR_PAYOUT' },
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
            queueSequence: { lt: yourEntry.queueSequence },
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
      ),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

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
        joinedAt: entry.joinedAt,
        completedAt: entry.completedAt,
        cancelledAt: entry.cancelledAt,
        transactionId: latest?.id ?? null,
        transactionStatus: latest?.status ?? null,
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
): string {
  const memberWord = waitingCount === 1 ? 'member' : 'members';

  if (entryStatus === 'WAITING_FOR_PAYOUT' && position !== null) {
    return `You're #${position} in line. ${waitingCount} ${memberWord} waiting in this level right now.`;
  }
  if (entryStatus === 'PENDING_JOIN_PAYMENT') {
    return "You've been matched with a member ahead of you — complete your contribution to keep your place.";
  }
  if (entryStatus === 'MATCHED_AS_PAYEE') {
    return "You're matched to receive a payout once the incoming contribution is confirmed.";
  }
  if (waitingCount === 0) {
    return "No one is waiting yet in this level — you'd be the first in the queue.";
  }
  return `${waitingCount} ${memberWord} currently waiting for a payout in this level.`;
}
