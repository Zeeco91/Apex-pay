import type { Prisma, PrismaClient, TreasuryEntryType } from '@prisma/client';

type TreasuryClient = PrismaClient | Prisma.TransactionClient;

/**
 * Atomically increments the singleton TreasuryBalance (the real pot cash) and appends the
 * matching TreasuryLedgerEntry row. Shared by TransactionsService (principal/disbursement) and
 * ReferralsService (fee allocation, bonus payouts) — every write to the pot's running balance
 * must go through this one function so balanceAfter stays race-safe and auditable.
 *
 * Pass `affectsBalance: false` for entries that re-categorize money already inside the pot
 * (e.g. fee allocation into a sub-pool) rather than moving cash in or out of it.
 */
export async function writeLedgerEntry(
  tx: TreasuryClient,
  params: {
    entryType: TreasuryEntryType;
    amount: number;
    relatedTransactionId: string;
    affectsBalance?: boolean;
  },
): Promise<void> {
  const affectsBalance = params.affectsBalance ?? true;
  const balance = affectsBalance
    ? await tx.treasuryBalance.update({
        where: { id: 1 },
        data: { balance: { increment: params.amount } },
      })
    : await tx.treasuryBalance.findUniqueOrThrow({ where: { id: 1 } });

  await tx.treasuryLedgerEntry.create({
    data: {
      entryType: params.entryType,
      amount: params.amount,
      relatedTransactionId: params.relatedTransactionId,
      balanceAfter: balance.balance,
    },
  });
}
