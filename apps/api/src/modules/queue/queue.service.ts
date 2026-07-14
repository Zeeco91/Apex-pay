import {
  ConflictException,
  ForbiddenException,
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

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async joinQueue(userId: string, levelId: string): Promise<JoinQueueResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.kycStatus !== 'APPROVED') {
          throw new ForbiddenException(
            'Identity verification must be approved before you can join a queue.',
          );
        }

        const level = await tx.level.findUnique({ where: { id: levelId } });
        if (!level || !level.isActive) {
          throw new NotFoundException('Level not found');
        }

        const existing = await tx.queueEntry.findFirst({
          where: {
            userId,
            levelId,
            status: { in: ACTIVE_QUEUE_ENTRY_STATUSES },
          },
        });
        if (existing) {
          throw new ConflictException(
            'You already have an active queue entry in this level.',
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

        const principalAmount = level.contributionAmount;
        const platformFeeAmount = Math.round(
          (principalAmount * level.feePercent) / 100,
        );
        const payeeDisbursedAmount = principalAmount - platformFeeAmount;

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
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE
      ) {
        throw new ConflictException(
          'You already have an active queue entry in this level.',
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
