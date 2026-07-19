import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ReconciliationRun, ReconciliationTrigger } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Entry types that move real cash in or out of the pot (see writeLedgerEntry's affectsBalance
// doc) — the running TreasuryBalance.balance is the sum of exactly these entries' amounts.
const BALANCE_AFFECTING_ENTRY_TYPES = [
  'PRINCIPAL_COLLECTED',
  'DISBURSED',
  'REFERRAL_BONUS_PAID',
  'LEVEL_INCENTIVE_BONUS_PAID',
  'PLATFORM_REVENUE_WITHDRAWN',
] as const;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runScheduled(): Promise<void> {
    const run = await this.run('SCHEDULED');
    if (run.hasDiscrepancy) {
      this.logger.error(
        `Reconciliation drift detected: treasury=${run.treasuryDrift}, referralPool=${run.referralPoolDrift}, incentivePool=${run.incentivePoolDrift}`,
      );
    }
  }

  async run(triggeredBy: ReconciliationTrigger): Promise<ReconciliationRun> {
    const [
      treasuryBalanceSum,
      treasuryBalance,
      referralPoolSum,
      referralPool,
      incentivePoolSum,
      incentivePool,
    ] = await Promise.all([
      this.prisma.treasuryLedgerEntry.aggregate({
        where: { entryType: { in: [...BALANCE_AFFECTING_ENTRY_TYPES] } },
        _sum: { amount: true },
      }),
      this.prisma.treasuryBalance.findUniqueOrThrow({ where: { id: 1 } }),
      this.prisma.treasuryLedgerEntry.aggregate({
        where: {
          entryType: {
            in: ['FEE_ALLOCATED_REFERRAL_POOL', 'REFERRAL_BONUS_PAID'],
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.feePool.findUniqueOrThrow({
        where: { poolType: 'REFERRAL' },
      }),
      this.prisma.treasuryLedgerEntry.aggregate({
        where: {
          entryType: {
            in: ['FEE_ALLOCATED_INCENTIVE_POOL', 'LEVEL_INCENTIVE_BONUS_PAID'],
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.feePool.findUniqueOrThrow({
        where: { poolType: 'LEVEL_INCENTIVE' },
      }),
    ]);

    const treasuryBalanceExpected = treasuryBalanceSum._sum.amount ?? 0;
    const referralPoolExpected = referralPoolSum._sum.amount ?? 0;
    const incentivePoolExpected = incentivePoolSum._sum.amount ?? 0;

    const treasuryDrift = treasuryBalanceExpected - treasuryBalance.balance;
    const referralPoolDrift =
      referralPoolExpected - referralPool.currentBalance;
    const incentivePoolDrift =
      incentivePoolExpected - incentivePool.currentBalance;

    const hasDiscrepancy =
      treasuryDrift !== 0 ||
      referralPoolDrift !== 0 ||
      incentivePoolDrift !== 0;

    return this.prisma.reconciliationRun.create({
      data: {
        treasuryBalanceExpected,
        treasuryBalanceActual: treasuryBalance.balance,
        treasuryDrift,
        referralPoolExpected,
        referralPoolActual: referralPool.currentBalance,
        referralPoolDrift,
        incentivePoolExpected,
        incentivePoolActual: incentivePool.currentBalance,
        incentivePoolDrift,
        hasDiscrepancy,
        triggeredBy,
      },
    });
  }

  async list(limit = 30): Promise<ReconciliationRun[]> {
    return this.prisma.reconciliationRun.findMany({
      orderBy: { runAt: 'desc' },
      take: limit,
    });
  }
}
